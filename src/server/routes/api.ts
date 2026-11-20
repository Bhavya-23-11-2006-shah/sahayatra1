import express from 'express';
import jwt from 'jsonwebtoken';
import {and, desc, eq, lt} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../../db/index.ts';
import {
  auditLogs,
  bookings,
  buses,
  conductorAcks,
  emergencyContacts,
  notifications,
  routes,
  sosEvents,
  stops,
  trips,
  users,
  waitlistEntries,
} from '../../db/schema.ts';
import {
  dispatchNotification,
  TEMPLATES,
  udidVerifier,
} from '../adapters/notifications.ts';
import {
  issueAccessAndRefreshTokens,
  optionalAuth,
  otpLimiter,
  requireAuth,
  requireRole,
  voiceLimiter,
  type AuthedRequest,
} from '../middleware/security.ts';
import {getSocketIO} from '../realtime/socket.ts';
import {seedDatabase} from '../seed.ts';
import {buildSmartAlternatives, type TripCandidate} from '../services/alternatives.ts';
import {
  BookingConflictError,
  cancelBookingAndPromoteWaitlist,
  createBookingTransaction,
} from '../services/bookingService.ts';
import {
  formatSsmlFriendlyText,
  processVoiceIntent,
} from '../services/voiceService.ts';
import {cache} from '../utils/cache.ts';
import {decryptPii, encryptPii} from '../utils/crypto.ts';
import {logger, writeAuditLog} from '../utils/logger.ts';

export const apiRouter = express.Router();

// Wrap Express 4 router methods so async errors flow cleanly to error middleware
const methods = ['get', 'post', 'patch', 'put', 'delete'] as const;
for (const method of methods) {
  const orig = apiRouter[method].bind(apiRouter);
  (apiRouter[method] as unknown) = (path: string, ...handlers: express.RequestHandler[]) => {
    const wrapped = handlers.map((fn) => {
      if (fn.length === 4) return fn;
      return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      };
    });
    return orig(path, ...wrapped);
  };
}

// In-memory OTP store (Redis-compatible fallback)
const otpStore = new Map<string, {code: string; expiresAt: number}>();

function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

apiRouter.get('/health', (_req, res) => {
  res.json({status: 'ok', service: 'sahayyatra-api', ts: new Date().toISOString()});
});

/* ============================================================
 * AUTHENTICATION & GUEST/COMPANION ACCESS
 * ============================================================ */

const otpRequestSchema = z.object({
  phone: z.string().min(8).max(20),
});

apiRouter.post('/auth/otp/request', otpLimiter, validateBody(otpRequestSchema), async (req, res) => {
  const normalizedPhone = req.body.phone.replace(/\s+/g, '');
  const code = process.env.NODE_ENV === 'test' ? '123456' : String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalizedPhone, {code, expiresAt: Date.now() + 5 * 60 * 1000});

  logger.info('Mock SMS OTP generated', {phone: normalizedPhone, code});
  res.json({
    sent: true,
    phone: normalizedPhone,
    expiresInSeconds: 300,
    demoOtpHint: process.env.NODE_ENV !== 'production' ? code : undefined,
  });
});

const otpVerifySchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().length(6),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['PASSENGER', 'CONDUCTOR', 'ADMIN']).optional(),
});

apiRouter.post('/auth/otp/verify', validateBody(otpVerifySchema), async (req, res) => {
  const normalizedPhone = req.body.phone.replace(/\s+/g, '');
  const entry = otpStore.get(normalizedPhone);
  const isDemoBypass = req.body.code === '123456' && process.env.NODE_ENV !== 'production';

  if (!isDemoBypass && (!entry || entry.expiresAt < Date.now() || entry.code !== req.body.code)) {
    res.status(401).json({error: 'Invalid or expired OTP code.'});
    return;
  }
  otpStore.delete(normalizedPhone);

  let userRow = await db.query.users.findFirst({where: eq(users.phone, normalizedPhone)});
  if (!userRow) {
    const uid = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        phone: normalizedPhone,
        name: req.body.name || 'SahayYatra Commuter',
        role: req.body.role || 'PASSENGER',
        language: 'en',
      })
      .returning();
    userRow = inserted;
  }

  const tokens = issueAccessAndRefreshTokens({
    id: userRow.id,
    uid: userRow.uid,
    role: userRow.role as 'PASSENGER' | 'CONDUCTOR' | 'ADMIN',
    name: userRow.name,
    language: userRow.language,
    isGuest: userRow.isGuest,
  });

  await writeAuditLog({
    actorUserId: userRow.id,
    actorRole: userRow.role,
    action: 'AUTH_LOGIN_OTP',
    resourceType: 'user',
    resourceId: String(userRow.id),
    ipAddress: req.ip,
  });

  res.json({
    ...tokens,
    user: {
      id: userRow.id,
      uid: userRow.uid,
      name: userRow.name,
      role: userRow.role,
      language: userRow.language,
      udidVerified: userRow.udidVerified,
      concessionEligible: userRow.concessionEligible,
    },
  });
});

const refreshSchema = z.object({refreshToken: z.string().min(10)});
apiRouter.post('/auth/refresh', validateBody(refreshSchema), async (req, res) => {
  try {
    const secret = process.env.JWT_SECRET || 'sahayyatra-dev-jwt-secret-change-in-prod';
    const decoded = jwt.verify(req.body.refreshToken, secret) as {
      id: number;
      type?: string;
    };
    if (decoded.type !== 'refresh') {
      res.status(401).json({error: 'Invalid refresh token type'});
      return;
    }
    const userRow = await db.query.users.findFirst({where: eq(users.id, decoded.id)});
    if (!userRow || userRow.deletedAt) {
      res.status(401).json({error: 'User not found or deleted'});
      return;
    }
    const tokens = issueAccessAndRefreshTokens({
      id: userRow.id,
      uid: userRow.uid,
      role: userRow.role as 'PASSENGER' | 'CONDUCTOR' | 'ADMIN',
      name: userRow.name,
      language: userRow.language,
      isGuest: userRow.isGuest,
    });
    res.json(tokens);
  } catch {
    res.status(401).json({error: 'Invalid or expired refresh token'});
  }
});

const guestSchema = z.object({
  name: z.string().min(1).max(80).default('Guest Companion'),
  language: z.enum(['en', 'hi', 'bn']).default('en'),
  needs: z.array(z.string()).default([]),
});

apiRouter.post('/auth/guest', validateBody(guestSchema), async (req, res) => {
  const uid = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [guest] = await db
    .insert(users)
    .values({
      uid,
      name: req.body.name,
      role: 'PASSENGER',
      language: req.body.language,
      needTypesEncrypted: encryptPii(JSON.stringify(req.body.needs)),
      hasAccessibilityNeed: req.body.needs.length > 0,
      isGuest: true,
    })
    .returning();

  const tokens = issueAccessAndRefreshTokens({
    id: guest.id,
    uid: guest.uid,
    role: 'PASSENGER',
    name: guest.name,
    language: guest.language,
    isGuest: true,
  });

  res.status(201).json({...tokens, user: {id: guest.id, uid: guest.uid, name: guest.name, isGuest: true}});
});

/* ============================================================
 * PROFILE, UDID VERIFICATION & DPDP PRIVACY RIGHTS
 * ============================================================ */

apiRouter.get('/profile', requireAuth, async (req: AuthedRequest, res) => {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, req.authUser!.id),
    with: {emergencyContacts: true},
  });
  if (!userRow || userRow.deletedAt) {
    res.status(404).json({error: 'Profile not found'});
    return;
  }

  let needs: string[] = [];
  if (userRow.needTypesEncrypted) {
    try {
      needs = JSON.parse(decryptPii(userRow.needTypesEncrypted) || '[]');
    } catch {
      needs = [];
    }
  }

  res.json({
    id: userRow.id,
    uid: userRow.uid,
    name: userRow.name,
    phone: userRow.phone,
    email: userRow.email,
    role: userRow.role,
    language: userRow.language,
    needs,
    consent: {
      shareNeedWithConductor: userRow.consentShareNeed,
      shareLiveLocation: userRow.consentLiveLocation,
      smsFallbackAlerts: userRow.consentSmsFallback,
    },
    udidNumber: userRow.udidNumber,
    udidVerified: userRow.udidVerified,
    concessionEligible: userRow.concessionEligible,
    emergencyContacts: userRow.emergencyContacts,
  });
});

const profilePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  language: z.enum(['en', 'hi', 'bn']).optional(),
  needs: z.array(z.string()).optional(),
  consentShareNeed: z.boolean().optional(),
  consentLiveLocation: z.boolean().optional(),
  consentSmsFallback: z.boolean().optional(),
  emergencyContact: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(8),
      relationship: z.string().default('Family'),
    })
    .optional(),
});

apiRouter.patch('/profile', requireAuth, validateBody(profilePatchSchema), async (req: AuthedRequest, res) => {
  const updates: Record<string, unknown> = {};
  if (req.body.name !== undefined) updates.name = req.body.name;
  if (req.body.language !== undefined) updates.language = req.body.language;
  if (req.body.needs !== undefined) {
    updates.needTypesEncrypted = encryptPii(JSON.stringify(req.body.needs));
    updates.hasAccessibilityNeed = req.body.needs.length > 0;
  }
  if (req.body.consentShareNeed !== undefined) updates.consentShareNeed = req.body.consentShareNeed;
  if (req.body.consentLiveLocation !== undefined) updates.consentLiveLocation = req.body.consentLiveLocation;
  if (req.body.consentSmsFallback !== undefined) updates.consentSmsFallback = req.body.consentSmsFallback;

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, req.authUser!.id));
  }

  if (req.body.emergencyContact) {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.userId, req.authUser!.id));
    await db.insert(emergencyContacts).values({
      userId: req.authUser!.id,
      name: req.body.emergencyContact.name,
      phone: req.body.emergencyContact.phone,
      relationship: req.body.emergencyContact.relationship,
    });
  }

  await writeAuditLog({
    actorUserId: req.authUser!.id,
    actorRole: req.authUser!.role,
    action: 'PROFILE_UPDATED',
    resourceType: 'user',
    resourceId: String(req.authUser!.id),
    ipAddress: req.ip,
  });

  res.json({updated: true});
});

const udidSchema = z.object({udidNumber: z.string().min(3).max(40)});

apiRouter.post('/profile/udid/verify', requireAuth, validateBody(udidSchema), async (req: AuthedRequest, res) => {
  const result = await udidVerifier.verify(req.body.udidNumber);
  await db
    .update(users)
    .set({
      udidNumber: req.body.udidNumber.trim().toUpperCase(),
      udidVerified: result.verified,
      concessionEligible: result.concessionEligible,
    })
    .where(eq(users.id, req.authUser!.id));

  await writeAuditLog({
    actorUserId: req.authUser!.id,
    actorRole: req.authUser!.role,
    action: 'UDID_VERIFIED',
    resourceType: 'user',
    resourceId: String(req.authUser!.id),
    metadata: {verified: result.verified},
  });

  res.json(result);
});

apiRouter.get('/profile/export', requireAuth, async (req: AuthedRequest, res) => {
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, req.authUser!.id),
    with: {emergencyContacts: true, bookings: true},
  });
  if (!userRow) {
    res.status(404).json({error: 'User not found'});
    return;
  }

  let needs: string[] = [];
  try {
    needs = JSON.parse(decryptPii(userRow.needTypesEncrypted) || '[]');
  } catch {
    needs = [];
  }

  await writeAuditLog({
    actorUserId: req.authUser!.id,
    actorRole: req.authUser!.role,
    action: 'DPDP_DATA_EXPORTED',
    resourceType: 'user',
    resourceId: String(req.authUser!.id),
  });

  res.json({
    exportedAt: new Date().toISOString(),
    dpdpCompliance: 'Digital Personal Data Protection Act Export',
    user: {
      uid: userRow.uid,
      name: userRow.name,
      phone: userRow.phone,
      email: userRow.email,
      language: userRow.language,
      needs,
      udidNumber: userRow.udidNumber,
      udidVerified: userRow.udidVerified,
    },
    emergencyContacts: userRow.emergencyContacts,
    bookings: userRow.bookings,
  });
});

apiRouter.delete('/profile', requireAuth, async (req: AuthedRequest, res) => {
  await db
    .update(users)
    .set({
      name: 'Deleted User',
      phone: null,
      email: '',
      needTypesEncrypted: '',
      udidNumber: '',
      udidVerified: false,
      concessionEligible: false,
      deletedAt: new Date(),
    })
    .where(eq(users.id, req.authUser!.id));

  await db.delete(emergencyContacts).where(eq(emergencyContacts.userId, req.authUser!.id));

  await writeAuditLog({
    actorUserId: req.authUser!.id,
    actorRole: req.authUser!.role,
    action: 'DPDP_ACCOUNT_ERASED',
    resourceType: 'user',
    resourceId: String(req.authUser!.id),
  });

  res.json({deleted: true, message: 'Personal data erased under DPDP Act right-to-erasure.'});
});

/* ============================================================
 * DISCOVERY & SMART TIME ALTERNATIVES
 * ============================================================ */

apiRouter.get('/stops', async (_req, res) => {
  const cached = await cache.get('stops:all');
  if (cached) {
    res.json({stops: cached});
    return;
  }
  const rows = await db.select().from(stops);
  await cache.set('stops:all', rows, 30);
  res.json({stops: rows});
});

apiRouter.get('/routes', async (_req, res) => {
  const cached = await cache.get('routes:all');
  if (cached) {
    res.json({routes: cached});
    return;
  }
  const rows = await db.select().from(routes);
  await cache.set('routes:all', rows, 30);
  res.json({routes: rows});
});

apiRouter.get('/trips/search', async (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  const time = String(req.query.time || '09:15');
  const needs = String(req.query.needs || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const cacheKey = `search:${from}:${to}:${time}:${needs.join('|')}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const allRoutes = await db.select().from(routes);
  const matchingRouteIds = new Set(
    allRoutes
      .filter((r) => {
        if (!from && !to) return true;
        const stopsList = r.stopIds || [];
        const hasFrom = !from || stopsList.includes(from);
        const hasTo = !to || stopsList.includes(to);
        return hasFrom && hasTo;
      })
      .map((r) => r.id),
  );

  const joined = await db
    .select({
      trip: trips,
      route: routes,
      bus: buses,
    })
    .from(trips)
    .innerJoin(routes, eq(trips.routeId, routes.id))
    .innerJoin(buses, eq(trips.busId, buses.id));

  const candidateRows = joined.filter((row) =>
    matchingRouteIds.size > 0 ? matchingRouteIds.has(row.route.id) : true,
  );

  const candidates: TripCandidate[] = candidateRows.map(({trip, route, bus}) => ({
    id: trip.id,
    routeId: route.id,
    routeNumber: route.number,
    routeName: route.name,
    scheduledTime: trip.scheduledTime,
    status: trip.status,
    delayMinutes: trip.delayMinutes,
    crowdLevel: trip.crowdLevel,
    wheelchairBaysFree: trip.wheelchairBaysFree,
    prioritySeatsFree: trip.prioritySeatsFree,
    baseFareInr: route.baseFareInr,
    bus: {
      id: bus.id,
      vehicleNumber: bus.vehicleNumber,
      ramp: bus.ramp,
      lowFloor: bus.lowFloor,
      audioAnnouncer: bus.audioAnnouncer,
      brailleSignage: bus.brailleSignage,
      visualDisplay: bus.visualDisplay,
      wheelchairBays: bus.wheelchairBays,
      prioritySeats: bus.prioritySeats,
    },
  }));

  const smartResult = buildSmartAlternatives({
    candidates,
    requestedTime: time,
    needs,
  });

  await cache.set(cacheKey, smartResult, 15);
  res.json(smartResult);
});

/* ============================================================
 * BOOKINGS, WAITLIST & IN-JOURNEY CONTROLS
 * ============================================================ */

const createBookingSchema = z.object({
  tripId: z.string().min(1),
  originStopId: z.string().min(1),
  destinationStopId: z.string().min(1),
  assistance: z.record(z.string(), z.boolean()).default({}),
  needsWheelchairBay: z.boolean().default(false),
  conductorNotes: z.string().max(400).optional(),
  idempotencyKey: z.string().min(4).max(120).optional(),
});

apiRouter.post('/bookings', requireAuth, validateBody(createBookingSchema), async (req: AuthedRequest, res) => {
  try {
    const result = await createBookingTransaction({
      userId: req.authUser!.id,
      tripId: req.body.tripId,
      originStopId: req.body.originStopId,
      destinationStopId: req.body.destinationStopId,
      assistance: req.body.assistance,
      needsWheelchairBay: req.body.needsWheelchairBay,
      conductorNotes: req.body.conductorNotes,
      idempotencyKey: req.body.idempotencyKey,
    });

    getSocketIO()?.to(`trip:${req.body.tripId}`).emit('booking:created', {
      tripId: req.body.tripId,
      bookingId: result.booking.id,
      pnr: result.booking.pnr,
      needsWheelchairBay: result.booking.needsWheelchairBay,
    });

    await cache.flush();
    res.status(result.replayed ? 200 : 201).json(result);
  } catch (err) {
    if (err instanceof BookingConflictError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 : err.code === 'NO_WHEELCHAIR_BAY' ? 409 : 400;
      res.status(status).json({error: err.message, code: err.code});
      return;
    }
    logger.error('Create booking error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({error: 'Unable to process booking transaction.'});
  }
});

apiRouter.post('/bookings/:id/confirm', requireAuth, async (req: AuthedRequest, res) => {
  const [updated] = await db
    .update(bookings)
    .set({status: 'CONFIRMED', updatedAt: new Date()})
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  res.json({booking: updated});
});

const modifyBookingSchema = z.object({
  originStopId: z.string().optional(),
  destinationStopId: z.string().optional(),
  conductorNotes: z.string().max(400).optional(),
  assistance: z.record(z.string(), z.boolean()).optional(),
});

apiRouter.patch('/bookings/:id', requireAuth, validateBody(modifyBookingSchema), async (req: AuthedRequest, res) => {
  const updates: Record<string, unknown> = {updatedAt: new Date()};
  if (req.body.originStopId) updates.originStopId = req.body.originStopId;
  if (req.body.destinationStopId) updates.destinationStopId = req.body.destinationStopId;
  if (req.body.conductorNotes !== undefined) updates.conductorNotes = req.body.conductorNotes;
  if (req.body.assistance) updates.assistanceJson = req.body.assistance;

  const [updated] = await db
    .update(bookings)
    .set(updates)
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  res.json({booking: updated});
});

apiRouter.post('/bookings/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const outcome = await cancelBookingAndPromoteWaitlist({
      bookingId: String(req.params.id),
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
    });
    await cache.flush();
    res.json(outcome);
  } catch (err) {
    if (err instanceof BookingConflictError && err.code === 'NOT_FOUND') {
      res.status(404).json({error: err.message});
      return;
    }
    res.status(500).json({error: 'Failed to cancel booking'});
  }
});

apiRouter.post('/bookings/:id/undo', requireAuth, async (req: AuthedRequest, res) => {
  const [existing] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)));
  if (!existing) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  if (new Date() > existing.undoDeadline) {
    res.status(400).json({error: '30-second instant undo window has expired. Use standard cancel instead.'});
    return;
  }
  const outcome = await cancelBookingAndPromoteWaitlist({
    bookingId: existing.id,
    actorUserId: req.authUser!.id,
    actorRole: req.authUser!.role,
    isUndo: true,
  });
  await cache.flush();
  res.json(outcome);
});

apiRouter.post('/bookings/:id/check-in', requireAuth, async (req: AuthedRequest, res) => {
  const [updated] = await db
    .update(bookings)
    .set({status: 'CHECKED_IN', autoReleaseAt: null, updatedAt: new Date()})
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  getSocketIO()?.to(`trip:${updated.tripId}`).emit('passenger:checked-in', {
    bookingId: updated.id,
    pnr: updated.pnr,
  });
  res.json({booking: updated});
});

const runningLateSchema = z.object({extraMinutes: z.number().int().min(1).max(3).default(2)});

apiRouter.post('/bookings/:id/running-late', requireAuth, validateBody(runningLateSchema), async (req: AuthedRequest, res) => {
  const [updated] = await db
    .update(bookings)
    .set({runningLateMinutes: req.body.extraMinutes, updatedAt: new Date()})
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  getSocketIO()?.to(`trip:${updated.tripId}`).emit('passenger:running-late', {
    bookingId: updated.id,
    pnr: updated.pnr,
    extraMinutes: req.body.extraMinutes,
  });
  res.json({booking: updated, policyMaxMinutes: 3});
});

apiRouter.post('/bookings/:id/request-stop', requireAuth, async (req: AuthedRequest, res) => {
  const [updated] = await db
    .update(bookings)
    .set({stopRequested: true, updatedAt: new Date()})
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  getSocketIO()?.to(`trip:${updated.tripId}`).emit('passenger:stop-requested', {
    bookingId: updated.id,
    pnr: updated.pnr,
    destinationStopId: updated.destinationStopId,
  });
  res.json({booking: updated, signaled: true});
});

const msgConductorSchema = z.object({message: z.string().min(1).max(240)});

apiRouter.post('/bookings/:id/message-conductor', requireAuth, validateBody(msgConductorSchema), async (req: AuthedRequest, res) => {
  const [existing] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, String(req.params.id)), eq(bookings.userId, req.authUser!.id)));
  if (!existing) {
    res.status(404).json({error: 'Booking not found'});
    return;
  }
  getSocketIO()?.to(`trip:${existing.tripId}`).emit('passenger:message', {
    bookingId: existing.id,
    pnr: existing.pnr,
    message: req.body.message,
  });
  res.json({delivered: true, message: req.body.message});
});

const waitlistSchema = z.object({
  tripId: z.string().min(1),
  originStopId: z.string().min(1),
  destinationStopId: z.string().min(1),
  needsWheelchairBay: z.boolean().default(true),
});

apiRouter.post('/waitlist', requireAuth, validateBody(waitlistSchema), async (req: AuthedRequest, res) => {
  const [entry] = await db
    .insert(waitlistEntries)
    .values({
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tripId: req.body.tripId,
      userId: req.authUser!.id,
      originStopId: req.body.originStopId,
      destinationStopId: req.body.destinationStopId,
      needsWheelchairBay: req.body.needsWheelchairBay,
      status: 'WAITING',
    })
    .returning();
  res.status(201).json({waitlistEntry: entry});
});

apiRouter.post('/bookings/auto-release', async (_req, res) => {
  const now = new Date();
  const expired = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, 'CONFIRMED'), lt(bookings.autoReleaseAt, now)));

  const releasedIds: string[] = [];
  for (const b of expired) {
    await cancelBookingAndPromoteWaitlist({
      bookingId: b.id,
      actorUserId: b.userId,
      actorRole: 'SYSTEM',
    });
    releasedIds.push(b.id);
  }
  res.json({releasedCount: releasedIds.length, releasedIds});
});

/* ============================================================
 * CONDUCTOR PORTAL (CONSENT-RESPECTING MANIFEST)
 * ============================================================ */

apiRouter.get(
  '/conductor/manifest/:tripId',
  requireAuth,
  requireRole('CONDUCTOR', 'ADMIN'),
  async (req, res) => {
    const tripId = String(req.params.tripId);
    const rows = await db
      .select({
        booking: bookings,
        passenger: users,
        ack: conductorAcks,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .leftJoin(conductorAcks, eq(conductorAcks.bookingId, bookings.id))
      .where(eq(bookings.tripId, tripId));

    const manifest = rows.map(({booking, passenger, ack}) => {
      // Respect DPDP consent flag: hide specific disability types if consentShareNeed is false
      let disclosedNeeds: string[] | null = null;
      if (passenger.consentShareNeed && passenger.needTypesEncrypted) {
        try {
          disclosedNeeds = JSON.parse(decryptPii(passenger.needTypesEncrypted) || '[]');
        } catch {
          disclosedNeeds = [];
        }
      }

      return {
        bookingId: booking.id,
        pnr: booking.pnr,
        status: booking.status,
        originStopId: booking.originStopId,
        destinationStopId: booking.destinationStopId,
        passengerName: passenger.name,
        assistanceNeeded: passenger.hasAccessibilityNeed || booking.needsWheelchairBay,
        disclosedNeeds, // null when passenger declined sharing specific disability type
        assistanceChecklist: booking.assistanceJson,
        conductorNotes: booking.conductorNotes,
        acknowledged: ack?.acknowledged ?? false,
        escalatedToDepot: ack?.escalatedToDepot ?? false,
      };
    });

    res.json({tripId, count: manifest.length, manifest});
  },
);

apiRouter.post(
  '/conductor/ack/:bookingId',
  requireAuth,
  requireRole('CONDUCTOR', 'ADMIN'),
  async (req: AuthedRequest, res) => {
    const bookingId = String(req.params.bookingId);
    const [updated] = await db
      .update(conductorAcks)
      .set({acknowledged: true, acknowledgedAt: new Date()})
      .where(eq(conductorAcks.bookingId, bookingId))
      .returning();

    if (!updated) {
      res.status(404).json({error: 'Conductor acknowledgement record not found'});
      return;
    }

    getSocketIO()?.to(`trip:${updated.tripId}`).emit('conductor:acknowledged', {
      bookingId,
      conductorId: req.authUser!.id,
    });
    res.json({ack: updated});
  },
);

apiRouter.post(
  '/conductor/board/:bookingId',
  requireAuth,
  requireRole('CONDUCTOR', 'ADMIN'),
  async (req, res) => {
    const [updated] = await db
      .update(bookings)
      .set({status: 'BOARDED', updatedAt: new Date()})
      .where(eq(bookings.id, String(req.params.bookingId)))
      .returning();
    if (!updated) {
      res.status(404).json({error: 'Booking not found'});
      return;
    }
    res.json({booking: updated});
  },
);

apiRouter.post(
  '/conductor/no-show/:bookingId',
  requireAuth,
  requireRole('CONDUCTOR', 'ADMIN'),
  async (req: AuthedRequest, res) => {
    const bookingId = String(req.params.bookingId);
    const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!existing) {
      res.status(404).json({error: 'Booking not found'});
      return;
    }
    const outcome = await cancelBookingAndPromoteWaitlist({
      bookingId,
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
    });
    await db.update(bookings).set({status: 'NO_SHOW'}).where(eq(bookings.id, bookingId));
    res.json({noShowRecorded: true, promotedBooking: outcome.promotedBooking});
  },
);

/* ============================================================
 * SOS EMERGENCY DISPATCH
 * ============================================================ */

const sosSchema = z.object({
  bookingId: z.string().optional(),
  tripId: z.string().optional(),
  lat: z.number().default(12.9756),
  lng: z.number().default(77.6066),
  locationText: z.string().default('MG Road Transit Corridor'),
});

apiRouter.post('/sos', optionalAuth, validateBody(sosSchema), async (req: AuthedRequest, res) => {
  const userId = req.authUser?.id;
  const userRow = userId
    ? await db.query.users.findFirst({where: eq(users.id, userId), with: {emergencyContacts: true}})
    : await db.query.users.findFirst({with: {emergencyContacts: true}});

  if (!userRow) {
    res.status(404).json({error: 'No passenger profile found for SOS'});
    return;
  }

  const [event] = await db
    .insert(sosEvents)
    .values({
      id: `sos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: userRow.id,
      bookingId: req.body.bookingId ?? null,
      tripId: req.body.tripId ?? null,
      lat: req.body.lat,
      lng: req.body.lng,
      locationText: req.body.locationText,
      status: 'ACTIVE',
      escalatedToControl: true,
    })
    .returning();

  const lang = (userRow.language as 'en' | 'hi' | 'bn') || 'en';
  const tpl = TEMPLATES.sosDispatched[lang] || TEMPLATES.sosDispatched.en;
  const msg = tpl(userRow.name, req.body.locationText);

  await Promise.all([
    dispatchNotification({userId: userRow.id, channel: 'SMS', language: lang, ...msg}),
    dispatchNotification({userId: userRow.id, channel: 'WHATSAPP', language: lang, ...msg}),
    dispatchNotification({userId: userRow.id, channel: 'EMAIL', language: lang, ...msg}),
    dispatchNotification({userId: userRow.id, channel: 'PUSH', language: lang, ...msg}),
  ]);

  if (req.body.tripId) {
    getSocketIO()?.to(`trip:${req.body.tripId}`).emit('sos:triggered', {
      sosId: event.id,
      passengerName: userRow.name,
      locationText: req.body.locationText,
      lat: req.body.lat,
      lng: req.body.lng,
    });
  }

  await writeAuditLog({
    actorUserId: userRow.id,
    actorRole: userRow.role,
    action: 'SOS_TRIGGERED',
    resourceType: 'sos_event',
    resourceId: event.id,
    metadata: {locationText: req.body.locationText},
  });

  res.status(201).json({sosEvent: event, notifiedChannels: ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH']});
});

apiRouter.post('/sos/:id/resolve', optionalAuth, async (req: AuthedRequest, res) => {
  const [updated] = await db
    .update(sosEvents)
    .set({
      status: 'RESOLVED',
      resolvedBy: req.authUser?.name || 'Depot Control',
      resolutionNotes: String(req.body?.notes || 'Passenger confirmed safe.'),
      resolvedAt: new Date(),
    })
    .where(eq(sosEvents.id, String(req.params.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'SOS event not found'});
    return;
  }
  res.json({sosEvent: updated});
});

apiRouter.post('/sos/:id/cancel', optionalAuth, async (req, res) => {
  const [updated] = await db
    .update(sosEvents)
    .set({status: 'CANCELLED', resolvedAt: new Date()})
    .where(eq(sosEvents.id, String(req.params.id)))
    .returning();
  if (!updated) {
    res.status(404).json({error: 'SOS event not found'});
    return;
  }
  res.json({sosEvent: updated});
});

/* ============================================================
 * VOICE ASSISTANT (GEMINI + SSE STREAM + SSML + SLOT MEMORY)
 * ============================================================ */

const voiceIntentSchema = z.object({
  transcript: z.string().min(1).max(1000),
  language: z.enum(['en', 'hi', 'bn']).default('en'),
  sessionId: z.string().optional(),
  currentPath: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

apiRouter.post('/voice/intent', voiceLimiter, validateBody(voiceIntentSchema), async (req, res) => {
  const {transcript, language, sessionId, currentPath, context} = req.body;
  const result = await processVoiceIntent({
    transcript,
    language,
    sessionId,
    currentPath,
    profile: context,
  });

  res.json({
    ...result.response,
    source: result.source,
  });
});

apiRouter.post('/voice/stream', voiceLimiter, validateBody(voiceIntentSchema), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const result = await processVoiceIntent({
    transcript: req.body.transcript,
    language: req.body.language,
    sessionId: req.body.sessionId,
    currentPath: req.body.currentPath,
    profile: req.body.context,
  });

  const words = result.response.spokenReply.split(' ');
  for (const word of words) {
    res.write(`event: token\ndata: ${JSON.stringify({token: `${word} `})}\n\n`);
  }
  res.write(
    `event: complete\ndata: ${JSON.stringify({...result.response, source: result.source})}\n\n`,
  );
  res.end();
});

const ttsSchema = z.object({
  text: z.string().min(1).max(2000),
  language: z.enum(['en', 'hi', 'bn']).default('en'),
});

apiRouter.post('/voice/tts-text', validateBody(ttsSchema), (req, res) => {
  const ssml = formatSsmlFriendlyText(req.body.text, req.body.language);
  res.json({ssml, language: req.body.language});
});

/* ============================================================
 * FALLBACK CHANNELS (SMS COMMANDS & IVR DTMF/SPEECH)
 * ============================================================ */

const smsWebhookSchema = z.object({
  fromPhone: z.string().min(8),
  body: z.string().min(1).max(300),
});

apiRouter.post('/channels/sms', validateBody(smsWebhookSchema), async (req, res) => {
  const text = req.body.body.trim();
  const upper = text.toUpperCase();

  if (upper.startsWith('STATUS')) {
    const pnr = upper.replace('STATUS', '').trim();
    const booking = pnr
      ? await db.query.bookings.findFirst({where: eq(bookings.pnr, pnr)})
      : null;
    if (!booking) {
      res.json({
        reply: 'SahayYatra: Ticket PNR not found. Send BOOK <FROM> <TO> <TIME> or call 1800-425-7242.',
      });
      return;
    }
    res.json({
      reply: `SahayYatra: Ticket ${booking.pnr} is ${booking.status} on trip ${booking.tripId}.`,
    });
    return;
  }

  if (upper.startsWith('BOOK')) {
    const parts = text.split(/\s+/);
    const time = parts[3] || '09:15';
    const allTrips = await db.select({trip: trips, route: routes, bus: buses}).from(trips).innerJoin(routes, eq(trips.routeId, routes.id)).innerJoin(buses, eq(trips.busId, buses.id));
    const smart = buildSmartAlternatives({
      candidates: allTrips.map(({trip, route, bus}) => ({
        id: trip.id,
        routeId: route.id,
        routeNumber: route.number,
        routeName: route.name,
        scheduledTime: trip.scheduledTime,
        status: trip.status,
        delayMinutes: trip.delayMinutes,
        crowdLevel: trip.crowdLevel,
        wheelchairBaysFree: trip.wheelchairBaysFree,
        prioritySeatsFree: trip.prioritySeatsFree,
        baseFareInr: route.baseFareInr,
        bus: {
          id: bus.id,
          vehicleNumber: bus.vehicleNumber,
          ramp: bus.ramp,
          lowFloor: bus.lowFloor,
          audioAnnouncer: bus.audioAnnouncer,
          brailleSignage: bus.brailleSignage,
          visualDisplay: bus.visualDisplay,
          wheelchairBays: bus.wheelchairBays,
          prioritySeats: bus.prioritySeats,
        },
      })),
      requestedTime: time,
      needs: ['wheelchair'],
    });
    const best = smart.exactMatch || smart.nearestLater || smart.nearestEarlier;
    res.json({
      reply: best
        ? `SahayYatra: Accessible bus ${best.trip.routeNumber} departs ${best.trip.scheduledTime} (${best.trip.wheelchairBaysFree} wheelchair bays free). Reply CONFIRM ${best.trip.id} to issue QR/SMS pass.`
        : 'SahayYatra: No accessible buses found for that window.',
      tripId: best?.trip.id ?? null,
    });
    return;
  }

  res.json({
    reply: 'SahayYatra SMS Help: Send "BOOK <FROM> <TO> <HH:MM>" or "STATUS <PNR>".',
  });
});

const ivrSchema = z.object({
  callerPhone: z.string().min(8),
  digit: z.string().optional(),
  speechText: z.string().optional(),
  language: z.enum(['en', 'hi', 'bn']).default('en'),
});

apiRouter.post('/channels/ivr', validateBody(ivrSchema), async (req, res) => {
  if (req.body.digit === '9') {
    res.json({
      action: 'TRIGGER_SOS',
      prompt: 'Emergency SOS activated. Connecting you to depot control room.',
    });
    return;
  }
  if (req.body.digit === '2') {
    res.json({
      action: 'TRACK_BUS',
      prompt: 'Your next accessible bus 305-R is 6 minutes away with the left ramp ready.',
    });
    return;
  }
  if (req.body.speechText) {
    const voiceRes = await processVoiceIntent({
      transcript: req.body.speechText,
      language: req.body.language,
      sessionId: `ivr-${req.body.callerPhone}`,
    });
    res.json({
      action: voiceRes.response.intent,
      prompt: voiceRes.response.spokenReply,
      ssml: formatSsmlFriendlyText(voiceRes.response.spokenReply, req.body.language),
    });
    return;
  }
  res.json({
    action: 'MENU',
    prompt: 'Welcome to SahayYatra Helpline. Press 1 to book an accessible bus, press 2 to track your bus, or press 9 for SOS emergency.',
  });
});

/* ============================================================
 * ADMIN DEMO SIMULATOR & ANALYTICS
 * ============================================================ */

apiRouter.post('/admin/simulate/delay', async (req, res) => {
  const tripId = String(req.body?.tripId || 'trip-bus-1');
  const delayMinutes = Number(req.body?.delayMinutes ?? 18);
  await db
    .update(trips)
    .set({delayMinutes, status: delayMinutes > 0 ? 'DELAYED' : 'ON_TIME'})
    .where(eq(trips.id, tripId));
  await cache.flush();
  getSocketIO()?.to(`trip:${tripId}`).emit('trip:delayed', {tripId, delayMinutes});
  res.json({tripId, delayMinutes, status: delayMinutes > 0 ? 'DELAYED' : 'ON_TIME'});
});

apiRouter.post('/admin/simulate/cancel', async (req, res) => {
  const tripId = String(req.body?.tripId || 'trip-bus-1');
  await db.update(trips).set({status: 'CANCELLED'}).where(eq(trips.id, tripId));
  await cache.flush();
  getSocketIO()?.to(`trip:${tripId}`).emit('trip:cancelled', {tripId});
  res.json({tripId, status: 'CANCELLED'});
});

apiRouter.post('/admin/simulate/fill', async (req, res) => {
  const tripId = String(req.body?.tripId || 'trip-bus-1');
  await db
    .update(trips)
    .set({wheelchairBaysFree: 0, status: 'FULL'})
    .where(eq(trips.id, tripId));
  await cache.flush();
  res.json({tripId, wheelchairBaysFree: 0, status: 'FULL'});
});

apiRouter.post('/admin/simulate/sos', async (_req, res) => {
  const userRow = await db.query.users.findFirst();
  if (!userRow) {
    res.status(404).json({error: 'Run /api/admin/reset first to seed demo users.'});
    return;
  }
  const [event] = await db
    .insert(sosEvents)
    .values({
      id: `sos-sim-${Date.now()}`,
      userId: userRow.id,
      lat: 12.9756,
      lng: 77.6066,
      locationText: 'MG Road Metro Gate 2 (Simulated SOS)',
      status: 'ACTIVE',
      escalatedToControl: true,
    })
    .returning();
  res.status(201).json({sosEvent: event});
});

apiRouter.post('/admin/reset', async (_req, res) => {
  await seedDatabase({reset: true});
  await cache.flush();
  res.json({reset: true, message: 'SahayYatra database re-seeded to initial accessible transit state.'});
});

apiRouter.get('/admin/analytics', async (_req, res) => {
  const [allBookings, allTrips, allSos, allAudit, allNotifs] = await Promise.all([
    db.select().from(bookings),
    db.select().from(trips),
    db.select().from(sosEvents),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(25),
    db.select().from(notifications).limit(50),
  ]);

  res.json({
    summary: {
      totalBookings: allBookings.length,
      wheelchairBookings: allBookings.filter((b) => b.needsWheelchairBay).length,
      concessionBookings: allBookings.filter((b) => b.concessionApplied).length,
      activeTrips: allTrips.filter((t) => t.status !== 'CANCELLED').length,
      delayedTrips: allTrips.filter((t) => t.delayMinutes > 0).length,
      activeSosEvents: allSos.filter((s) => s.status === 'ACTIVE').length,
      notificationsDispatched: allNotifs.length,
    },
    recentAuditLogs: allAudit,
  });
});

apiRouter.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error('Unhandled API error', {
      path: req.path,
      method: req.method,
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
);


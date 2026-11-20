import {and, asc, eq, ne, sql} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {
  bookings,
  conductorAcks,
  routes,
  trips,
  users,
  waitlistEntries,
} from '../../db/schema.ts';
import {dispatchNotification, TEMPLATES} from '../adapters/notifications.ts';
import {signQrToken} from '../utils/crypto.ts';
import {writeAuditLog} from '../utils/logger.ts';
import {timeStringToMinutes} from './alternatives.ts';

export interface CreateBookingInput {
  userId: number;
  tripId: string;
  originStopId: string;
  destinationStopId: string;
  assistance: Record<string, boolean>;
  needsWheelchairBay: boolean;
  conductorNotes?: string;
  idempotencyKey?: string;
}

export class BookingConflictError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'IDEMPOTENT_REPLAY'
      | 'DOUBLE_BOOKING'
      | 'TIME_OVERLAP'
      | 'NO_WHEELCHAIR_BAY'
      | 'TRIP_CANCELLED'
      | 'NOT_FOUND',
  ) {
    super(message);
  }
}

export async function createBookingTransaction(input: CreateBookingInput) {
  // 1. Idempotency check
  if (input.idempotencyKey) {
    const existing = await db.query.bookings.findFirst({
      where: eq(bookings.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      return {booking: existing, replayed: true};
    }
  }

  const result = await db.transaction(async (tx) => {
    // 2. Row-level lock on trip to prevent concurrent last-wheelchair-bay race condition
    const lockedRows = await tx.execute(
      sql`SELECT id, route_id, bus_id, conductor_id, scheduled_time, travel_date, status, wheelchair_bays_free, priority_seats_free FROM trips WHERE id = ${input.tripId} FOR UPDATE`,
    );
    const tripRow = lockedRows.rows[0] as
      | {
          id: string;
          route_id: string;
          bus_id: string;
          conductor_id: number;
          scheduled_time: string;
          travel_date: string;
          status: string;
          wheelchair_bays_free: number;
          priority_seats_free: number;
        }
      | undefined;

    if (!tripRow) {
      throw new BookingConflictError('Trip not found.', 'NOT_FOUND');
    }
    if (tripRow.status === 'CANCELLED') {
      throw new BookingConflictError(
        'This bus trip was cancelled. Please select a smart alternative.',
        'TRIP_CANCELLED',
      );
    }

    // 3. Double-booking & time-overlap prevention (within 30 min on same travelDate)
    const activeUserBookings = await tx
      .select({
        id: bookings.id,
        pnr: bookings.pnr,
        tripId: bookings.tripId,
        scheduledTime: trips.scheduledTime,
        travelDate: trips.travelDate,
      })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.id))
      .where(
        and(
          eq(bookings.userId, input.userId),
          ne(bookings.status, 'CANCELLED'),
          ne(bookings.status, 'NO_SHOW'),
        ),
      );

    for (const existing of activeUserBookings) {
      if (existing.tripId === input.tripId) {
        throw new BookingConflictError(
          `Double booking prevented: you already hold active ticket ${existing.pnr} for this trip.`,
          'DOUBLE_BOOKING',
        );
      }
      if (existing.travelDate === tripRow.travel_date) {
        const diff = Math.abs(
          timeStringToMinutes(existing.scheduledTime) -
            timeStringToMinutes(tripRow.scheduled_time),
        );
        if (diff < 30) {
          throw new BookingConflictError(
            `Time overlap prevented: ticket ${existing.pnr} departs at ${existing.scheduledTime}, within 30 minutes of ${tripRow.scheduled_time}.`,
            'TIME_OVERLAP',
          );
        }
      }
    }

    // 4. Capacity check under lock
    if (input.needsWheelchairBay) {
      if (tripRow.wheelchair_bays_free <= 0) {
        throw new BookingConflictError(
          'All wheelchair bays are occupied on this bus. Join the waitlist to be auto-promoted if a bay opens.',
          'NO_WHEELCHAIR_BAY',
        );
      }
      await tx
        .update(trips)
        .set({wheelchairBaysFree: tripRow.wheelchair_bays_free - 1})
        .where(eq(trips.id, tripRow.id));
    } else if (tripRow.priority_seats_free > 0) {
      await tx
        .update(trips)
        .set({prioritySeatsFree: tripRow.priority_seats_free - 1})
        .where(eq(trips.id, tripRow.id));
    }

    const userRow = await tx.query.users.findFirst({where: eq(users.id, input.userId)});
    const routeRow = await tx.query.routes.findFirst({
      where: eq(routes.id, tripRow.route_id),
    });

    const baseFare = routeRow?.baseFareInr ?? 20;
    const concessionApplied = Boolean(userRow?.concessionEligible);
    const fareInr = concessionApplied ? Math.ceil(baseFare * 0.5) : baseFare;

    const id = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pnr = `SY-${Math.floor(10000 + Math.random() * 89999)}`;
    const qrToken = signQrToken(`${pnr}|${tripRow.id}|${input.originStopId}`);
    const undoDeadline = new Date(Date.now() + 30 * 1000);
    const autoReleaseAt = new Date(Date.now() + 15 * 60 * 1000);

    const [created] = await tx
      .insert(bookings)
      .values({
        id,
        pnr,
        idempotencyKey: input.idempotencyKey ?? null,
        userId: input.userId,
        tripId: tripRow.id,
        originStopId: input.originStopId,
        destinationStopId: input.destinationStopId,
        status: 'CONFIRMED',
        assistanceJson: input.assistance,
        needsWheelchairBay: input.needsWheelchairBay,
        qrToken,
        fareInr,
        concessionApplied,
        conductorNotes: input.conductorNotes ?? '',
        undoDeadline,
        autoReleaseAt,
      })
      .returning();

    await tx.insert(conductorAcks).values({
      id: `ack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bookingId: created.id,
      tripId: tripRow.id,
      conductorId: tripRow.conductor_id,
      acknowledged: false,
      escalatedToDepot: false,
    });

    return {booking: created, tripRow, routeNumber: routeRow?.number ?? 'BUS', userRow};
  });

  if ('replayed' in result) {
    return result;
  }

  const lang = ((result.userRow?.language as 'en' | 'hi' | 'bn') || 'en');
  const tpl = TEMPLATES.bookingConfirmed[lang] || TEMPLATES.bookingConfirmed.en;
  const msg = tpl(result.booking.pnr, result.routeNumber, result.tripRow.scheduled_time);

  await dispatchNotification({
    userId: input.userId,
    channel: 'PUSH',
    language: lang,
    title: msg.title,
    body: msg.body,
  });

  await writeAuditLog({
    actorUserId: input.userId,
    actorRole: result.userRow?.role || 'PASSENGER',
    action: 'BOOKING_CREATED',
    resourceType: 'booking',
    resourceId: result.booking.id,
    metadata: {pnr: result.booking.pnr, tripId: result.booking.tripId},
  });

  return {booking: result.booking, replayed: false};
}

export async function cancelBookingAndPromoteWaitlist(params: {
  bookingId: string;
  actorUserId: number;
  actorRole: string;
  isUndo?: boolean;
}) {
  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, params.bookingId));
    if (!existing) {
      throw new BookingConflictError('Booking not found.', 'NOT_FOUND');
    }
    if (existing.status === 'CANCELLED') {
      return {booking: existing, refundInr: existing.fareInr, promotedBooking: null};
    }

    const now = new Date();
    const withinUndo = params.isUndo && now <= existing.undoDeadline;
    const refundInr = existing.fareInr; // 100% refund up to 5 min before departure or within 30s undo

    const [updated] = await tx
      .update(bookings)
      .set({status: 'CANCELLED', updatedAt: now})
      .where(eq(bookings.id, existing.id))
      .returning();

    let promotedBooking: typeof existing | null = null;

    // Release capacity & promote earliest waiting waitlist user if wheelchair bay freed
    if (existing.needsWheelchairBay) {
      const [nextWaiter] = await tx
        .select()
        .from(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.tripId, existing.tripId),
            eq(waitlistEntries.status, 'WAITING'),
            eq(waitlistEntries.needsWheelchairBay, true),
          ),
        )
        .orderBy(asc(waitlistEntries.createdAt))
        .limit(1);

      if (nextWaiter) {
        await tx
          .update(waitlistEntries)
          .set({status: 'PROMOTED'})
          .where(eq(waitlistEntries.id, nextWaiter.id));

        const pnr = `SY-${Math.floor(10000 + Math.random() * 89999)}`;
        const [promoted] = await tx
          .insert(bookings)
          .values({
            id: `bk-wl-${Date.now()}`,
            pnr,
            userId: nextWaiter.userId,
            tripId: nextWaiter.tripId,
            originStopId: nextWaiter.originStopId,
            destinationStopId: nextWaiter.destinationStopId,
            status: 'CONFIRMED',
            assistanceJson: {needRamp: true, needBoardingHelp: true},
            needsWheelchairBay: true,
            qrToken: signQrToken(`${pnr}|${nextWaiter.tripId}|${nextWaiter.originStopId}`),
            fareInr: existing.fareInr,
            concessionApplied: true,
            conductorNotes: 'Auto-promoted from wheelchair bay waitlist.',
            undoDeadline: new Date(Date.now() + 30 * 1000),
          })
          .returning();
        promotedBooking = promoted;
      } else {
        await tx.execute(
          sql`UPDATE trips SET wheelchair_bays_free = wheelchair_bays_free + 1 WHERE id = ${existing.tripId}`,
        );
      }
    } else {
      await tx.execute(
        sql`UPDATE trips SET priority_seats_free = priority_seats_free + 1 WHERE id = ${existing.tripId}`,
      );
    }

    return {booking: updated, refundInr, promotedBooking, withinUndo};
  });

  if (outcome.promotedBooking) {
    const tpl = TEMPLATES.waitlistPromoted.en(
      outcome.promotedBooking.tripId,
      outcome.promotedBooking.pnr,
    );
    await dispatchNotification({
      userId: outcome.promotedBooking.userId,
      channel: 'SMS',
      language: 'en',
      title: tpl.title,
      body: tpl.body,
    });
  }

  await writeAuditLog({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: params.isUndo ? 'BOOKING_UNDONE' : 'BOOKING_CANCELLED',
    resourceType: 'booking',
    resourceId: params.bookingId,
    metadata: {refundInr: outcome.refundInr, promotedId: outcome.promotedBooking?.id ?? null},
  });

  return outcome;
}

/**
 * Pure concurrency + waitlist simulation engine (exported for deterministic Jest unit testing)
 */
export interface MemoryTripSlot {
  id: string;
  wheelchairBaysFree: number;
}

export class AtomicBayAllocator {
  private locks = new Map<string, Promise<void>>();

  async withTripLock<T>(tripId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(tripId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((res) => {
      release = res;
    });
    this.locks.set(tripId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async reserveLastBay(
    trip: MemoryTripSlot,
    userId: string,
    waitlist: Array<{userId: string; createdAt: number}>,
  ): Promise<{status: 'CONFIRMED' | 'WAITLISTED'; userId: string}> {
    return this.withTripLock(trip.id, async () => {
      // Simulate async DB read/write latency
      await new Promise((r) => setTimeout(r, 5));
      if (trip.wheelchairBaysFree > 0) {
        trip.wheelchairBaysFree -= 1;
        return {status: 'CONFIRMED', userId};
      }
      waitlist.push({userId, createdAt: Date.now()});
      return {status: 'WAITLISTED', userId};
    });
  }

  async releaseAndPromote(
    trip: MemoryTripSlot,
    waitlist: Array<{userId: string; createdAt: number}>,
  ): Promise<{promotedUserId: string | null}> {
    return this.withTripLock(trip.id, async () => {
      if (waitlist.length > 0) {
        waitlist.sort((a, b) => a.createdAt - b.createdAt);
        const next = waitlist.shift()!;
        return {promotedUserId: next.userId};
      }
      trip.wheelchairBaysFree += 1;
      return {promotedUserId: null};
    });
  }
}

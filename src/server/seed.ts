import {eq} from 'drizzle-orm';
import {BUSES, CONDUCTORS, ROUTES, STOPS} from '../data/seed.ts';
import {db} from '../db/index.ts';
import {
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
} from '../db/schema.ts';
import {encryptPii, signQrToken} from './utils/crypto.ts';
import {logger} from './utils/logger.ts';

export async function seedDatabase(options: {reset?: boolean} = {}) {
  if (options.reset) {
    await db.delete(sosEvents);
    await db.delete(waitlistEntries);
    await db.delete(conductorAcks);
    await db.delete(notifications);
    await db.delete(bookings);
    await db.delete(trips);
  }

  // 1. Seed 25 stops
  for (const s of STOPS) {
    await db
      .insert(stops)
      .values({
        id: s.id,
        code: s.code,
        name: s.name,
        area: s.area,
        lat: s.lat,
        lng: s.lng,
        tactilePaving: s.tactilePaving,
        rampFriendly: true,
        rampSide: s.rampSide,
        shelterSeating: s.shelterSeating,
        audioBeacon: s.audioBeacon,
      })
      .onConflictDoUpdate({
        target: stops.id,
        set: {
          name: s.name,
          tactilePaving: s.tactilePaving,
          rampSide: s.rampSide,
          audioBeacon: s.audioBeacon,
        },
      });
  }

  // 2. Seed 8 routes
  for (const r of ROUTES) {
    await db
      .insert(routes)
      .values({
        id: r.id,
        number: r.number,
        name: r.name,
        corridor: r.corridor,
        stopIds: r.stopIds,
        frequencyMinutes: r.frequencyMinutes,
        baseFareInr: r.baseFareInr,
        isExpress: r.isExpress,
      })
      .onConflictDoUpdate({
        target: routes.id,
        set: {
          name: r.name,
          stopIds: r.stopIds,
          baseFareInr: r.baseFareInr,
        },
      });
  }

  // 3. Seed 12 buses
  for (const b of BUSES) {
    await db
      .insert(buses)
      .values({
        id: b.id,
        vehicleNumber: b.vehicleNumber,
        ramp: b.features.ramp,
        lowFloor: b.features.lowFloor,
        audioAnnouncer: b.features.audioAnnouncer,
        brailleSignage: b.features.brailleSignage,
        visualDisplay: b.features.visualDisplay,
        wheelchairBays: b.wheelchairBaysTotal,
        prioritySeats: b.prioritySeatsTotal,
      })
      .onConflictDoUpdate({
        target: buses.id,
        set: {
          ramp: b.features.ramp,
          lowFloor: b.features.lowFloor,
          wheelchairBays: b.wheelchairBaysTotal,
        },
      });
  }

  // 4. Seed 3 conductors, 3 demo passengers, 1 admin
  const conductorIdMap = new Map<string, number>();
  for (const c of CONDUCTORS) {
    const [row] = await db
      .insert(users)
      .values({
        uid: `uid-${c.id}`,
        phone: c.phone.replace(/\s+/g, ''),
        name: c.name,
        role: 'CONDUCTOR',
        language: 'en',
        badgeId: c.badgeId,
        photoUrl: c.photoUrl,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {name: c.name, photoUrl: c.photoUrl, badgeId: c.badgeId},
      })
      .returning();
    conductorIdMap.set(c.id, row.id);
  }

  const demoPassengers = [
    {
      uid: 'demo-passenger-blind',
      phone: '+919900011101',
      name: 'Aarav Verma',
      language: 'en',
      needs: ['blind'],
      udidNumber: 'UDID-KA-2024-88421',
      ecName: 'Sunita Verma',
      ecPhone: '+919845055443',
    },
    {
      uid: 'demo-passenger-wheelchair',
      phone: '+919900011102',
      name: 'Meera Nair',
      language: 'en',
      needs: ['wheelchair'],
      udidNumber: 'UDID-KA-2025-19034',
      ecName: 'Priya Nair',
      ecPhone: '+919845090123',
    },
    {
      uid: 'demo-passenger-deaf',
      phone: '+919900011103',
      name: 'Kabir Sen',
      language: 'bn',
      needs: ['deaf'],
      udidNumber: 'UDID-WB-2023-44910',
      ecName: 'Ritu Sen',
      ecPhone: '+919830011224',
    },
  ];

  const passengerIds: number[] = [];
  for (const p of demoPassengers) {
    const [u] = await db
      .insert(users)
      .values({
        uid: p.uid,
        phone: p.phone,
        name: p.name,
        role: 'PASSENGER',
        language: p.language,
        needTypesEncrypted: encryptPii(JSON.stringify(p.needs)),
        hasAccessibilityNeed: true,
        consentShareNeed: true,
        consentLiveLocation: true,
        consentSmsFallback: true,
        udidNumber: p.udidNumber,
        udidVerified: true,
        concessionEligible: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          name: p.name,
          needTypesEncrypted: encryptPii(JSON.stringify(p.needs)),
        },
      })
      .returning();
    passengerIds.push(u.id);

    const existingEc = await db.query.emergencyContacts.findFirst({
      where: eq(emergencyContacts.userId, u.id),
    });
    if (!existingEc) {
      await db.insert(emergencyContacts).values({
        userId: u.id,
        name: p.ecName,
        phone: p.ecPhone,
        relationship: 'Family',
      });
    }
  }

  await db
    .insert(users)
    .values({
      uid: 'demo-admin-1',
      phone: '+919900099999',
      name: 'Depot Operations Admin',
      role: 'ADMIN',
      language: 'en',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {role: 'ADMIN'},
    });

  // 5. Seed trips throughout the day
  for (const b of BUSES) {
    const condDbId = conductorIdMap.get(b.conductorId) ?? conductorIdMap.get('cond-1')!;
    const tripId = `trip-${b.id}`;
    await db
      .insert(trips)
      .values({
        id: tripId,
        routeId: b.routeId,
        busId: b.id,
        conductorId: condDbId,
        scheduledTime: b.departureTime,
        travelDate: 'Today',
        status: b.status === 'delayed' ? 'DELAYED' : 'ON_TIME',
        delayMinutes: b.delayMinutes,
        crowdLevel: b.crowdLevel.toUpperCase(),
        wheelchairBaysFree: b.wheelchairBaysFree,
        prioritySeatsFree: b.prioritySeatsFree,
        currentStopIndex: b.currentStopIndex,
        lat: 12.9756,
        lng: 77.6066,
      })
      .onConflictDoUpdate({
        target: trips.id,
        set: {
          status: b.status === 'delayed' ? 'DELAYED' : 'ON_TIME',
          delayMinutes: b.delayMinutes,
          wheelchairBaysFree: b.wheelchairBaysFree,
          prioritySeatsFree: b.prioritySeatsFree,
        },
      });
  }

  // 6. Seed sample bookings
  const meeraId = passengerIds[1];
  const aaravId = passengerIds[0];
  const cond1Id = conductorIdMap.get('cond-1')!;

  const sampleBookings: Array<{
    id: string;
    pnr: string;
    userId: number;
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    needsWheelchairBay: boolean;
    assistance: Record<string, boolean>;
    notes: string;
  }> = [
    {
      id: 'bk-seed-1',
      pnr: 'SY-94218',
      userId: meeraId,
      tripId: 'trip-bus-1',
      originStopId: 'stop-2',
      destinationStopId: 'stop-1',
      needsWheelchairBay: true,
      assistance: {needRamp: true, needBoardingHelp: true, largeMobilityAid: true},
      notes: 'Power wheelchair — please deploy left ramp at MG Road Gate 2.',
    },
    {
      id: 'bk-seed-2',
      pnr: 'SY-77304',
      userId: aaravId,
      tripId: 'trip-bus-1',
      originStopId: 'stop-4',
      destinationStopId: 'stop-1',
      needsWheelchairBay: false,
      assistance: {needRamp: false, needBoardingHelp: true, guideDog: true},
      notes: 'Traveling with guide dog; audio stop callout requested.',
    },
  ];

  for (const sb of sampleBookings) {
    await db
      .insert(bookings)
      .values({
        id: sb.id,
        pnr: sb.pnr,
        userId: sb.userId,
        tripId: sb.tripId,
        originStopId: sb.originStopId,
        destinationStopId: sb.destinationStopId,
        status: 'CONFIRMED',
        assistanceJson: sb.assistance,
        needsWheelchairBay: sb.needsWheelchairBay,
        qrToken: signQrToken(`${sb.pnr}|${sb.tripId}|${sb.originStopId}`),
        fareInr: 11,
        concessionApplied: true,
        conductorNotes: sb.notes,
        undoDeadline: new Date(Date.now() + 30 * 1000),
      })
      .onConflictDoNothing();

    await db
      .insert(conductorAcks)
      .values({
        id: `ack-${sb.id}`,
        bookingId: sb.id,
        tripId: sb.tripId,
        conductorId: cond1Id,
        acknowledged: true,
        escalatedToDepot: false,
        acknowledgedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  logger.info('SahayYatra PostgreSQL seed complete', {
    stops: STOPS.length,
    routes: ROUTES.length,
    buses: BUSES.length,
  });
}

// Allow CLI execution: npx tsx src/server/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

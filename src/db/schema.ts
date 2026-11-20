import {relations} from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    phone: text('phone').unique(),
    email: text('email').notNull().default(''),
    name: text('name').notNull(),
    role: text('role').notNull().default('PASSENGER'), // PASSENGER | CONDUCTOR | ADMIN
    language: text('language').notNull().default('en'),
    needTypesEncrypted: text('need_types_encrypted').notNull().default(''),
    hasAccessibilityNeed: boolean('has_accessibility_need').notNull().default(false),
    consentShareNeed: boolean('consent_share_need').notNull().default(true),
    consentLiveLocation: boolean('consent_live_location').notNull().default(true),
    consentSmsFallback: boolean('consent_sms_fallback').notNull().default(true),
    udidNumber: text('udid_number').notNull().default(''),
    udidVerified: boolean('udid_verified').notNull().default(false),
    concessionEligible: boolean('concession_eligible').notNull().default(false),
    badgeId: text('badge_id').notNull().default(''),
    photoUrl: text('photo_url').notNull().default(''),
    isGuest: boolean('is_guest').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

export const emergencyContacts = pgTable('emergency_contacts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, {onDelete: 'cascade'})
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  relationship: text('relationship').notNull().default('Family'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stops = pgTable(
  'stops',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    area: text('area').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    tactilePaving: boolean('tactile_paving').notNull().default(true),
    rampFriendly: boolean('ramp_friendly').notNull().default(true),
    rampSide: text('ramp_side').notNull().default('left'),
    shelterSeating: boolean('shelter_seating').notNull().default(true),
    audioBeacon: boolean('audio_beacon').notNull().default(true),
  },
  (t) => [index('stops_area_idx').on(t.area), index('stops_code_idx').on(t.code)],
);

export const routes = pgTable('routes', {
  id: text('id').primaryKey(),
  number: text('number').notNull().unique(),
  name: text('name').notNull(),
  corridor: text('corridor').notNull(),
  stopIds: jsonb('stop_ids').$type<string[]>().notNull(),
  frequencyMinutes: integer('frequency_minutes').notNull().default(15),
  baseFareInr: integer('base_fare_inr').notNull().default(20),
  isExpress: boolean('is_express').notNull().default(false),
});

export const buses = pgTable('buses', {
  id: text('id').primaryKey(),
  vehicleNumber: text('vehicle_number').notNull().unique(),
  ramp: boolean('ramp').notNull().default(true),
  lowFloor: boolean('low_floor').notNull().default(true),
  audioAnnouncer: boolean('audio_announcer').notNull().default(true),
  brailleSignage: boolean('braille_signage').notNull().default(true),
  visualDisplay: boolean('visual_display').notNull().default(true),
  wheelchairBays: integer('wheelchair_bays').notNull().default(2),
  prioritySeats: integer('priority_seats').notNull().default(8),
});

export const trips = pgTable(
  'trips',
  {
    id: text('id').primaryKey(),
    routeId: text('route_id')
      .references(() => routes.id)
      .notNull(),
    busId: text('bus_id')
      .references(() => buses.id)
      .notNull(),
    conductorId: integer('conductor_id')
      .references(() => users.id)
      .notNull(),
    scheduledTime: text('scheduled_time').notNull(), // HH:mm
    travelDate: text('travel_date').notNull().default('Today'),
    status: text('status').notNull().default('ON_TIME'), // ON_TIME | DELAYED | CANCELLED | FULL
    delayMinutes: integer('delay_minutes').notNull().default(0),
    crowdLevel: text('crowd_level').notNull().default('LOW'), // LOW | MODERATE | HIGH
    wheelchairBaysFree: integer('wheelchair_bays_free').notNull().default(2),
    prioritySeatsFree: integer('priority_seats_free').notNull().default(6),
    currentStopIndex: integer('current_stop_index').notNull().default(0),
    lat: doublePrecision('lat').notNull().default(12.9756),
    lng: doublePrecision('lng').notNull().default(77.6066),
  },
  (t) => [
    index('trips_route_date_time_idx').on(t.routeId, t.travelDate, t.scheduledTime),
    index('trips_status_idx').on(t.status),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    pnr: text('pnr').notNull().unique(),
    idempotencyKey: text('idempotency_key').unique(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    tripId: text('trip_id')
      .references(() => trips.id)
      .notNull(),
    originStopId: text('origin_stop_id')
      .references(() => stops.id)
      .notNull(),
    destinationStopId: text('destination_stop_id')
      .references(() => stops.id)
      .notNull(),
    status: text('status').notNull().default('CONFIRMED'),
    assistanceJson: jsonb('assistance_json').$type<Record<string, boolean>>().notNull(),
    needsWheelchairBay: boolean('needs_wheelchair_bay').notNull().default(false),
    qrToken: text('qr_token').notNull(),
    fareInr: integer('fare_inr').notNull(),
    concessionApplied: boolean('concession_applied').notNull().default(false),
    conductorNotes: text('conductor_notes').notNull().default(''),
    undoDeadline: timestamp('undo_deadline').notNull(),
    autoReleaseAt: timestamp('auto_release_at'),
    runningLateMinutes: integer('running_late_minutes').notNull().default(0),
    stopRequested: boolean('stop_requested').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('bookings_user_idx').on(t.userId),
    index('bookings_trip_status_idx').on(t.tripId, t.status),
  ],
);

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .references(() => trips.id)
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    originStopId: text('origin_stop_id').notNull(),
    destinationStopId: text('destination_stop_id').notNull(),
    needsWheelchairBay: boolean('needs_wheelchair_bay').notNull().default(true),
    notifyOnOpen: boolean('notify_on_open').notNull().default(true),
    status: text('status').notNull().default('WAITING'), // WAITING | PROMOTED | EXPIRED
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('waitlist_trip_status_idx').on(t.tripId, t.status, t.createdAt)],
);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  channel: text('channel').notNull(), // PUSH | SMS | VOICE | WHATSAPP
  language: text('language').notNull().default('en'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('SENT'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sosEvents = pgTable('sos_events', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  bookingId: text('booking_id').references(() => bookings.id),
  tripId: text('trip_id').references(() => trips.id),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  locationText: text('location_text').notNull(),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE | ESCALATED | RESOLVED | CANCELLED
  escalatedToControl: boolean('escalated_to_control').notNull().default(false),
  resolvedBy: text('resolved_by').notNull().default(''),
  resolutionNotes: text('resolution_notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const conductorAcks = pgTable('conductor_acks', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id')
    .references(() => bookings.id)
    .notNull()
    .unique(),
  tripId: text('trip_id')
    .references(() => trips.id)
    .notNull(),
  conductorId: integer('conductor_id')
    .references(() => users.id)
    .notNull(),
  acknowledged: boolean('acknowledged').notNull().default(false),
  escalatedToDepot: boolean('escalated_to_depot').notNull().default(false),
  reassignedConductorId: integer('reassigned_conductor_id'),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id'),
    actorRole: text('actor_role').notNull().default('SYSTEM'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull(),
    ipAddress: text('ip_address').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('audit_action_idx').on(t.action, t.createdAt)],
);

export const usersRelations = relations(users, ({many}) => ({
  emergencyContacts: many(emergencyContacts),
  bookings: many(bookings),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({one}) => ({
  user: one(users, {fields: [emergencyContacts.userId], references: [users.id]}),
}));

export const bookingsRelations = relations(bookings, ({one}) => ({
  user: one(users, {fields: [bookings.userId], references: [users.id]}),
  trip: one(trips, {fields: [bookings.tripId], references: [trips.id]}),
}));

export const tripsRelations = relations(trips, ({one, many}) => ({
  route: one(routes, {fields: [trips.routeId], references: [routes.id]}),
  bus: one(buses, {fields: [trips.busId], references: [buses.id]}),
  conductor: one(users, {fields: [trips.conductorId], references: [users.id]}),
  bookings: many(bookings),
}));

import {CONDUCTORS, ROUTES, STOPS} from '../data/seed';
import {useAppStore} from '../store/useAppStore';
import type {
  AppLanguage,
  AssistanceChecklist,
  Booking,
  Bus,
  SOSAlert,
  VoiceIntentResponse,
  WaitlistEntry,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertNetworkHealthy() {
  const {adminSim} = useAppStore.getState();
  if (adminSim.simulateNetworkFailure) {
    throw new Error('Network request timed out. Please check your connection and retry.');
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export interface BusSearchResult {
  primaryBuses: Bus[];
  earlierAlternative: {bus: Bus; diffMinutes: number; reason: string} | null;
  laterAlternative: {bus: Bus; diffMinutes: number; reason: string} | null;
  cancelledWarning?: string;
}

export async function searchAccessibleBuses(params: {
  originStopId: string;
  destinationStopId: string;
  timePeriod: string;
  customTime: string;
  wheelchairOnly: boolean;
}): Promise<BusSearchResult> {
  await delay(280);
  assertNetworkHealthy();

  const state = useAppStore.getState();
  const {buses, adminSim} = state;

  if (adminSim.simulateNoBusesRoute) {
    return {
      primaryBuses: [],
      earlierAlternative: null,
      laterAlternative: null,
    };
  }

  // Find routes serving origin or fallback to corridors
  const matchingRoutes = ROUTES.filter(
    (r) =>
      r.stopIds.includes(params.originStopId) &&
      r.stopIds.includes(params.destinationStopId),
  );
  const candidateRouteIds =
    matchingRoutes.length > 0
      ? matchingRoutes.map((r) => r.id)
      : ROUTES.filter(
          (r) =>
            r.stopIds.includes(params.originStopId) ||
            r.stopIds.includes(params.destinationStopId),
        ).map((r) => r.id);

  let pool = buses
    .filter((b) =>
      candidateRouteIds.length > 0 ? candidateRouteIds.includes(b.routeId) : true,
    )
    .map((b) => {
      const updated = {...b};
      if (adminSim.delayAllBusesMin > 0) {
        updated.delayMinutes = b.delayMinutes + adminSim.delayAllBusesMin;
        updated.etaMinutes = b.etaMinutes + adminSim.delayAllBusesMin;
        updated.status = 'delayed';
      }
      if (adminSim.forceWheelchairFull) {
        updated.wheelchairBaysFree = 0;
      }
      return updated;
    });

  if (params.wheelchairOnly) {
    pool = pool.filter((b) => b.features.ramp && b.features.lowFloor);
  }

  const targetMinutes =
    params.timePeriod === 'morning'
      ? timeToMinutes('09:15')
      : params.timePeriod === 'afternoon'
      ? timeToMinutes('14:00')
      : params.timePeriod === 'evening'
      ? timeToMinutes('18:00')
      : params.timePeriod === 'custom'
      ? timeToMinutes(params.customTime || '09:15')
      : timeToMinutes('09:15');

  const sorted = [...pool].sort(
    (a, b) =>
      Math.abs(timeToMinutes(a.departureTime) - targetMinutes) -
      Math.abs(timeToMinutes(b.departureTime) - targetMinutes),
  );

  let cancelledWarning: string | undefined;
  if (adminSim.simulateBusCancelledMidBooking && sorted.length > 0) {
    sorted[0] = {...sorted[0], status: 'cancelled'};
    cancelledWarning = `Bus ${sorted[0].routeNumber} (${sorted[0].departureTime}) was just cancelled due to a mechanical ramp check. Smart alternatives are highlighted below.`;
  }

  const primary = sorted.slice(0, 4);

  // Smart Time Alternatives (nearest earlier & nearest later with free bay or healthy status)
  const earlierPool = pool
    .filter(
      (b) =>
        timeToMinutes(b.departureTime) < targetMinutes &&
        b.status !== 'cancelled' &&
        b.wheelchairBaysFree > 0,
    )
    .sort((a, b) => timeToMinutes(b.departureTime) - timeToMinutes(a.departureTime));

  const laterPool = pool
    .filter(
      (b) =>
        timeToMinutes(b.departureTime) > targetMinutes &&
        b.status !== 'cancelled' &&
        b.wheelchairBaysFree > 0,
    )
    .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));

  const fallbackEarlier =
    earlierPool[0] ||
    pool.find((b) => timeToMinutes(b.departureTime) < targetMinutes) ||
    null;
  const fallbackLater =
    laterPool[0] ||
    pool.find((b) => timeToMinutes(b.departureTime) > targetMinutes) ||
    null;

  const earlierAlternative = fallbackEarlier
    ? {
        bus: fallbackEarlier,
        diffMinutes: Math.max(
          4,
          targetMinutes - timeToMinutes(fallbackEarlier.departureTime),
        ),
        reason:
          fallbackEarlier.wheelchairBaysFree > 0
            ? `${fallbackEarlier.wheelchairBaysFree} wheelchair bay free · low crowd · on-time ramp bus`
            : 'Nearest earlier accessible departure',
      }
    : null;

  const laterAlternative = fallbackLater
    ? {
        bus: fallbackLater,
        diffMinutes: Math.max(
          6,
          timeToMinutes(fallbackLater.departureTime) - targetMinutes,
        ),
        reason:
          laterPool[0]
            ? `${fallbackLater.wheelchairBaysFree} wheelchair bays free · guaranteed level boarding`
            : 'Next available route departure',
      }
    : null;

  return {
    primaryBuses: primary,
    earlierAlternative,
    laterAlternative,
    cancelledWarning,
  };
}

export async function createBusBooking(input: {
  bus: Bus;
  originStopId: string;
  destinationStopId: string;
  travelDate: string;
  assistance: AssistanceChecklist;
  conductorNotes: string;
}): Promise<Booking> {
  await delay(300);
  assertNetworkHealthy();

  const store = useAppStore.getState();
  const {profile, bookings, adminSim} = store;

  // Check double booking edge case
  const duplicate = bookings.find(
    (b) =>
      b.status !== 'cancelled' &&
      b.busId === input.bus.id &&
      b.travelDate === input.travelDate,
  );
  if (duplicate) {
    throw new Error(
      `You already hold an active booking (${duplicate.pnr}) on bus ${input.bus.routeNumber} at ${input.bus.departureTime}.`,
    );
  }

  if (input.bus.status === 'cancelled') {
    throw new Error(
      `Bus ${input.bus.routeNumber} (${input.bus.departureTime}) was cancelled mid-booking. Please choose one of the Smart Time Alternatives.`,
    );
  }

  const booking: Booking = {
    id: `bk-${Date.now()}`,
    pnr: `SY-${Math.floor(10000 + Math.random() * 89999)}`,
    passengerName: profile.name || 'SahayYatra Passenger',
    passengerNeeds: profile.needs,
    routeId: input.bus.routeId,
    routeNumber: input.bus.routeNumber,
    busId: input.bus.id,
    vehicleNumber: input.bus.vehicleNumber,
    conductorId: input.bus.conductorId,
    originStopId: input.originStopId,
    destinationStopId: input.destinationStopId,
    travelDate: input.travelDate,
    departureTime: input.bus.departureTime,
    farePaidInr: profile.udidVerified ? input.bus.concessionFareInr : input.bus.fareInr,
    concessionApplied: profile.udidVerified,
    assistance: input.assistance,
    emergencyContact: `${profile.emergencyContactName} (${profile.emergencyContactPhone})`,
    conductorNotes: input.conductorNotes,
    status: 'confirmed',
    conductorAcknowledged: !adminSim.simulateConductorUnacknowledged,
    conductorEscalated: adminSim.simulateConductorUnacknowledged,
    runningLateRequested: false,
    atStopCheckedIn: false,
    createdAt: new Date().toISOString(),
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    store.enqueueOfflineAction({
      id: `q-${Date.now()}`,
      label: `Sync booking ${booking.pnr} (${booking.routeNumber})`,
      createdAt: new Date().toISOString(),
      payload: {bookingId: booking.id},
    });
  }

  store.addBooking(booking);
  return booking;
}

export async function joinWheelchairWaitlist(bus: Bus, originStopId: string, destinationStopId: string): Promise<WaitlistEntry> {
  await delay(200);
  assertNetworkHealthy();
  const origin = STOPS.find((s) => s.id === originStopId)?.name || 'Origin Stop';
  const dest = STOPS.find((s) => s.id === destinationStopId)?.name || 'Destination Stop';
  const entry: WaitlistEntry = {
    id: `wl-${Date.now()}`,
    busId: bus.id,
    routeNumber: bus.routeNumber,
    departureTime: bus.departureTime,
    originStopName: origin,
    destinationStopName: dest,
    notifyOnOpen: true,
    createdAt: new Date().toISOString(),
  };
  useAppStore.getState().addWaitlist(entry);
  return entry;
}

export async function sendSOSAlert(ticket?: Booking | null): Promise<SOSAlert> {
  await delay(150);
  const {profile} = useAppStore.getState();
  const stop = ticket ? STOPS.find((s) => s.id === ticket.originStopId) : STOPS[1];
  const alert: SOSAlert = {
    id: `sos-${Date.now()}`,
    passengerName: profile.name,
    needs: profile.needs,
    ticketPnr: ticket?.pnr,
    busNumber: ticket?.vehicleNumber,
    locationText: stop ? `Near ${stop.name} (${stop.area})` : 'MG Road Transit Corridor',
    lat: stop?.lat ?? 12.9756,
    lng: stop?.lng ?? 77.6066,
    triggeredAt: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    resolved: false,
  };
  useAppStore.getState().addSOSAlert(alert);
  return alert;
}

export async function verifyUdidNumber(udid: string): Promise<{valid: boolean; concessionPercent: number; holderType: string}> {
  await delay(350);
  assertNetworkHealthy();
  const clean = udid.trim().toUpperCase();
  if (clean.length < 6) {
    return {valid: false, concessionPercent: 0, holderType: 'Invalid UDID format'};
  }
  return {
    valid: true,
    concessionPercent: 50,
    holderType: 'Verified Govt PwD Concession Pass (50% Fare Waiver)',
  };
}

export async function parseVoiceIntent(params: {
  transcript: string;
  language: AppLanguage;
  currentPath: string;
  context?: Record<string, unknown>;
}): Promise<VoiceIntentResponse> {
  const {adminSim} = useAppStore.getState();

  if (adminSim.simulateNoisyEnvironment) {
    return {
      intent: 'UNKNOWN',
      spokenReply:
        'Background traffic noise detected. Did you mean: book a bus to Majestic Railway Station tomorrow morning?',
      needsConfirmation: false,
      suggestedCorrection: 'Book a bus to Majestic Railway Station tomorrow morning',
    };
  }

  // Offline local NLU fallback when browser is offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return offlineVoiceFallback(params.transcript, params.language);
  }

  const response = await fetch(`${API_BASE}/api/voice/intent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error || `Voice assistant request failed (${response.status}).`,
    );
  }

  return (await response.json()) as VoiceIntentResponse;
}

export function offlineVoiceFallback(
  transcript: string,
  language: AppLanguage,
): VoiceIntentResponse {
  const lower = transcript.toLowerCase();
  if (lower.includes('sos') || lower.includes('emergency') || lower.includes('help me')) {
    return {
      intent: 'SOS_EMERGENCY',
      spokenReply: 'Opening emergency SOS controls now.',
      needsConfirmation: false,
      uiAction: {type: 'TRIGGER_SOS'},
    };
  }
  if (lower.includes('where') || lower.includes('track') || lower.includes('कहाँ') || lower.includes('কোথায়')) {
    return {
      intent: 'TRACK_BUS',
      spokenReply: 'Your bus 305-R is 6 minutes away and approaching MG Road Gate 2.',
      needsConfirmation: false,
      uiAction: {type: 'NAVIGATE', route: '/track'},
    };
  }
  if (lower.includes('cancel') || lower.includes('रद्द') || lower.includes('বাতিল')) {
    return {
      intent: 'CANCEL_BOOKING',
      spokenReply: 'Do you want to cancel your active ticket? Say confirm to cancel.',
      needsConfirmation: true,
      uiAction: {type: 'PROMPT_CANCEL'},
    };
  }
  if (lower.includes('confirm') || lower.includes('book it') || lower.includes('हाँ') || lower.includes('হ্যাঁ')) {
    return {
      intent: 'CONFIRM_BOOKING',
      spokenReply: 'Confirming your accessible bus booking now.',
      needsConfirmation: false,
      uiAction: {type: 'CONFIRM_BOOKING'},
    };
  }
  if (lower.includes('9:15') || lower.includes('first') || lower.includes('earlier')) {
    return {
      intent: 'SELECT_BUS',
      spokenReply: 'Selected bus 305-R at 09:15 with 1 wheelchair bay free. Say confirm to book.',
      needsConfirmation: true,
      entities: {busSelection: lower.includes('earlier') ? 'earlier' : '09:15'},
      uiAction: {type: 'SELECT_BUS', payloadJson: JSON.stringify({time: '09:15'})},
    };
  }
  if (lower.includes('railway') || lower.includes('station') || lower.includes('hospital') || lower.includes('book') || lower.includes('go to')) {
    const dest = lower.includes('hospital') ? 'AIIMS & Rehab Institute' : 'Majestic Central Railway Station';
    const reply =
      language === 'hi'
        ? `${dest} के लिए सुबह की सुगम बसें दिखा रहा हूँ।`
        : language === 'bn'
        ? `${dest}-এর জন্য সকালের সহজলভ্য বাস দেখাচ্ছি।`
        : `Showing morning accessible buses to ${dest}. Which pickup stop would you like?`;
    return {
      intent: 'SEARCH_BUS',
      spokenReply: reply,
      needsConfirmation: false,
      entities: {destination: dest, timePeriod: 'morning'},
      uiAction: {type: 'NAVIGATE', route: '/book'},
    };
  }
  return {
    intent: 'UNKNOWN',
    spokenReply: 'I did not catch that clearly. Did you mean: Book a bus to the railway station?',
    needsConfirmation: false,
    suggestedCorrection: 'Book a bus to the railway station tomorrow morning',
  };
}

export function getConductorById(id: string) {
  return CONDUCTORS.find((c) => c.id === id) || CONDUCTORS[0];
}

export function getStopById(id: string) {
  return STOPS.find((s) => s.id === id) || STOPS[0];
}

export function getRouteById(id: string) {
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}

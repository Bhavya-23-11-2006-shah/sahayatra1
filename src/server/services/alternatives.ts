export interface TripCandidate {
  id: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  scheduledTime: string; // HH:mm
  status: string; // ON_TIME | DELAYED | CANCELLED | FULL
  delayMinutes: number;
  crowdLevel: string; // LOW | MODERATE | HIGH
  wheelchairBaysFree: number;
  prioritySeatsFree: number;
  baseFareInr: number;
  bus: {
    id: string;
    vehicleNumber: string;
    ramp: boolean;
    lowFloor: boolean;
    audioAnnouncer: boolean;
    brailleSignage: boolean;
    visualDisplay: boolean;
    wheelchairBays: number;
    prioritySeats: number;
  };
}

export interface RankedTripAlternative {
  trip: TripCandidate;
  diffMinutes: number;
  direction: 'EXACT' | 'EARLIER' | 'LATER';
  adjustedEtaTime: string;
  rankingScore: number;
  reason: string;
}

export interface SmartSearchResult {
  requestedTime: string;
  exactMatch: RankedTripAlternative | null;
  nearestEarlier: RankedTripAlternative | null;
  nearestLater: RankedTripAlternative | null;
  trips: RankedTripAlternative[];
  autoPopulatedAlternatives: boolean;
  explanation: string;
}

export function timeStringToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 9 * 60 + 15;
  return h * 60 + m;
}

export function minutesToTimeString(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function scoreTripCandidate(
  trip: TripCandidate,
  requestedMinutes: number,
  needs: string[],
): number {
  if (trip.status === 'CANCELLED') return 0;

  const schedMin = timeStringToMinutes(trip.scheduledTime);
  const diffMin = Math.abs(schedMin - requestedMinutes);

  // Time proximity (max 45 pts)
  const timeScore = Math.max(0, 45 - diffMin * 0.8);

  // Wheelchair bay availability (max 30 pts)
  const needsWheelchair = needs.includes('wheelchair');
  let bayScore = 15;
  if (trip.wheelchairBaysFree >= 2) bayScore = 30;
  else if (trip.wheelchairBaysFree === 1) bayScore = 22;
  else if (needsWheelchair) bayScore = 0;

  // Crowd level (max 15 pts)
  const crowdScore =
    trip.crowdLevel === 'LOW' ? 15 : trip.crowdLevel === 'MODERATE' ? 9 : 3;

  // Delay penalty (max 10 pts)
  const delayScore = Math.max(0, 10 - trip.delayMinutes * 0.7);

  return Math.round((timeScore + bayScore + crowdScore + delayScore) * 10) / 10;
}

export function buildSmartAlternatives(params: {
  candidates: TripCandidate[];
  requestedTime: string;
  needs: string[];
  delayThresholdMinutes?: number;
}): SmartSearchResult {
  const delayThreshold = params.delayThresholdMinutes ?? 10;
  const reqMin = timeStringToMinutes(params.requestedTime);
  const needsWheelchair = params.needs.includes('wheelchair');

  // Accessibility filtering
  const filtered = params.candidates.filter((t) => {
    if (needsWheelchair && (!t.bus.ramp || !t.bus.lowFloor)) return false;
    return true;
  });

  const ranked: RankedTripAlternative[] = filtered
    .map((trip) => {
      const schedMin = timeStringToMinutes(trip.scheduledTime);
      const diff = schedMin - reqMin;
      const direction: 'EXACT' | 'EARLIER' | 'LATER' =
        diff === 0 ? 'EXACT' : diff < 0 ? 'EARLIER' : 'LATER';

      return {
        trip,
        diffMinutes: Math.abs(diff),
        direction,
        adjustedEtaTime: minutesToTimeString(schedMin + trip.delayMinutes),
        rankingScore: scoreTripCandidate(trip, reqMin, params.needs),
        reason: [
          `${trip.wheelchairBaysFree} wheelchair bay${trip.wheelchairBaysFree === 1 ? '' : 's'} free`,
          `${trip.crowdLevel.toLowerCase()} crowd`,
          trip.delayMinutes > 0 ? `delayed +${trip.delayMinutes}m` : 'on-time',
        ].join(' · '),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);

  const exactMatch =
    ranked.find((r) => r.direction === 'EXACT') ||
    ranked.find((r) => r.diffMinutes <= 3) ||
    null;

  const isTargetCompromised =
    !exactMatch ||
    exactMatch.trip.status === 'CANCELLED' ||
    exactMatch.trip.status === 'FULL' ||
    exactMatch.trip.delayMinutes > delayThreshold ||
    (needsWheelchair && exactMatch.trip.wheelchairBaysFree === 0);

  const viablePool = ranked.filter(
    (r) =>
      r.trip.id !== exactMatch?.trip.id &&
      r.trip.status !== 'CANCELLED' &&
      (!needsWheelchair || r.trip.wheelchairBaysFree > 0),
  );

  const nearestEarlier =
    viablePool
      .filter((r) => timeStringToMinutes(r.trip.scheduledTime) < reqMin)
      .sort(
        (a, b) =>
          timeStringToMinutes(b.trip.scheduledTime) -
          timeStringToMinutes(a.trip.scheduledTime),
      )[0] || null;

  const nearestLater =
    viablePool
      .filter((r) => timeStringToMinutes(r.trip.scheduledTime) > reqMin)
      .sort(
        (a, b) =>
          timeStringToMinutes(a.trip.scheduledTime) -
          timeStringToMinutes(b.trip.scheduledTime),
      )[0] || null;

  let explanation = 'Exact accessible departure available.';
  if (!exactMatch) {
    explanation = `No trip departs exactly at ${params.requestedTime}; showing nearest earlier and later accessible departures.`;
  } else if (exactMatch.trip.status === 'CANCELLED') {
    explanation = `The ${exactMatch.trip.scheduledTime} bus is cancelled. Smart earlier and later accessible alternatives are ready below.`;
  } else if (needsWheelchair && exactMatch.trip.wheelchairBaysFree === 0) {
    explanation = `All wheelchair bays on the ${exactMatch.trip.scheduledTime} bus are currently booked. Nearest alternatives with open bays are highlighted.`;
  } else if (exactMatch.trip.delayMinutes > delayThreshold) {
    explanation = `The ${exactMatch.trip.scheduledTime} bus is delayed by ${exactMatch.trip.delayMinutes} minutes; consider the faster alternatives below.`;
  }

  return {
    requestedTime: params.requestedTime,
    exactMatch,
    nearestEarlier,
    nearestLater,
    trips: ranked,
    autoPopulatedAlternatives: isTargetCompromised,
    explanation,
  };
}

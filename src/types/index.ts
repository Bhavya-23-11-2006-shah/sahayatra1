export type DisabilityNeed =
  | 'blind'
  | 'deaf'
  | 'wheelchair'
  | 'speech'
  | 'cognitive'
  | 'companion';

export type ThemeMode = 'light' | 'dark' | 'high-contrast';
export type AppLanguage = 'en' | 'hi' | 'bn';
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface AccessibilityProfile {
  name: string;
  needs: DisabilityNeed[];
  language: AppLanguage;
  theme: ThemeMode;
  dyslexiaFont: boolean;
  fontScale: number; // 1.0 to 2.0
  reduceMotion: boolean;
  voiceSpeed: number; // 0.7 to 1.5
  captionsEnabled: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  colorBlindSafe: boolean;
  screenReaderHints: boolean;
  voiceFirstMode: boolean;
  visualMode: boolean;
  simpleMode: boolean;
  tapToSpeakMode: boolean;
  companionMode: boolean;
  udidNumber: string;
  udidVerified: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  privacyConsent: {
    shareNeedWithConductor: boolean;
    shareLiveLocation: boolean;
    saveFrequentStops: boolean;
    smsFallbackAlerts: boolean;
  };
  notifications: {
    push: boolean;
    sms: boolean;
    vibration: boolean;
    voice: boolean;
  };
  onboardingCompleted: boolean;
}

export interface Stop {
  id: string;
  name: string;
  code: string;
  area: string;
  lat: number;
  lng: number;
  tactilePaving: boolean;
  rampSide: 'left' | 'right';
  shelterSeating: boolean;
  audioBeacon: boolean;
  distanceMeters?: number;
}

export interface Route {
  id: string;
  number: string;
  name: string;
  corridor: string;
  stopIds: string[];
  frequencyMinutes: number;
  baseFareInr: number;
  isExpress: boolean;
}

export interface Conductor {
  id: string;
  name: string;
  badgeId: string;
  phone: string;
  photoUrl: string;
  languages: string[];
  accessibilityCertified: boolean;
  rating: number;
}

export type CrowdLevel = 'low' | 'moderate' | 'high';
export type BusStatus = 'on-time' | 'delayed' | 'cancelled' | 'full';

export interface Bus {
  id: string;
  vehicleNumber: string;
  routeId: string;
  routeNumber: string;
  routeName: string;
  conductorId: string;
  departureTime: string; // "09:15"
  timePeriod: 'morning' | 'afternoon' | 'evening';
  etaMinutes: number;
  delayMinutes: number;
  status: BusStatus;
  crowdLevel: CrowdLevel;
  features: {
    ramp: boolean;
    lowFloor: boolean;
    audioAnnouncer: boolean;
    brailleSignage: boolean;
    visualDisplay: boolean;
  };
  wheelchairBaysTotal: number;
  wheelchairBaysFree: number;
  prioritySeatsTotal: number;
  prioritySeatsFree: number;
  currentStopIndex: number;
  fareInr: number;
  concessionFareInr: number;
}

export interface AssistanceChecklist {
  needRamp: boolean;
  needBoardingHelp: boolean;
  guideDog: boolean;
  companionTraveler: boolean;
  largeMobilityAid: boolean;
}

export type BookingStatus =
  | 'confirmed'
  | 'checked-in'
  | 'boarded'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export interface Booking {
  id: string;
  pnr: string;
  passengerName: string;
  passengerNeeds: DisabilityNeed[];
  routeId: string;
  routeNumber: string;
  busId: string;
  vehicleNumber: string;
  conductorId: string;
  originStopId: string;
  destinationStopId: string;
  travelDate: string;
  departureTime: string;
  farePaidInr: number;
  concessionApplied: boolean;
  assistance: AssistanceChecklist;
  emergencyContact: string;
  conductorNotes: string;
  status: BookingStatus;
  conductorAcknowledged: boolean;
  conductorEscalated: boolean;
  runningLateRequested: boolean;
  atStopCheckedIn: boolean;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  busId: string;
  routeNumber: string;
  departureTime: string;
  originStopName: string;
  destinationStopName: string;
  notifyOnOpen: boolean;
  createdAt: string;
}

export interface ServiceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  routeNumber?: string;
  timestamp: string;
}

export interface SOSAlert {
  id: string;
  passengerName: string;
  needs: DisabilityNeed[];
  ticketPnr?: string;
  busNumber?: string;
  locationText: string;
  lat: number;
  lng: number;
  triggeredAt: string;
  resolved: boolean;
}

export interface VoiceIntentResponse {
  intent:
    | 'SEARCH_BUS'
    | 'SEARCH_TRIP'
    | 'SELECT_BUS'
    | 'BOOK_TRIP'
    | 'CONFIRM_BOOKING'
    | 'CONFIRM'
    | 'CANCEL_BOOKING'
    | 'CANCEL'
    | 'CHANGE_BUS'
    | 'MODIFY'
    | 'TRACK_BUS'
    | 'CALL_CONDUCTOR'
    | 'SOS_EMERGENCY'
    | 'SOS'
    | 'REQUEST_STOP'
    | 'CHANGE_LANGUAGE'
    | 'HELP'
    | 'SMALLTALK_FALLBACK'
    | 'NAVIGATE'
    | 'ACCESSIBILITY_TOGGLE'
    | 'UNKNOWN';
  spokenReply: string;
  needsConfirmation: boolean;
  suggestedCorrection?: string;
  entities?: {
    origin?: string;
    destination?: string;
    timeText?: string;
    timePeriod?: 'now' | 'morning' | 'afternoon' | 'evening';
    busSelection?: string;
    targetRoute?: string;
    accessibilitySetting?: string;
  };
  uiAction?: {
    type: string;
    route?: string;
    payloadJson?: string;
  };
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
  undoLabel?: string;
  onUndo?: () => void;
  durationMs?: number;
}

export interface AdminSimState {
  delayAllBusesMin: number;
  forceWheelchairFull: boolean;
  simulateBusCancelledMidBooking: boolean;
  simulateNoBusesRoute: boolean;
  simulateConductorUnacknowledged: boolean;
  simulateNetworkFailure: boolean;
  simulateNoisyEnvironment: boolean;
}

export interface QueuedOfflineAction {
  id: string;
  label: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

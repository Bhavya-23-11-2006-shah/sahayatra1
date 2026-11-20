import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {
  BUSES,
  DEMO_PROFILE_PRESETS,
  INITIAL_ALERTS,
  INITIAL_BOOKINGS,
} from '../data/seed';
import i18n from '../i18n';
import type {
  AccessibilityProfile,
  AdminSimState,
  AppLanguage,
  AssistanceChecklist,
  Booking,
  Bus,
  DisabilityNeed,
  OrbState,
  QueuedOfflineAction,
  ServiceAlert,
  SOSAlert,
  ToastMessage,
  WaitlistEntry,
} from '../types';
import {triggerFeedback} from '../utils/haptics';

const DEFAULT_PROFILE: AccessibilityProfile = {
  name: 'Meera Nair',
  needs: ['wheelchair'],
  language: 'en',
  theme: 'light',
  dyslexiaFont: false,
  fontScale: 1,
  reduceMotion: false,
  voiceSpeed: 1,
  captionsEnabled: true,
  hapticsEnabled: true,
  soundEnabled: true,
  colorBlindSafe: false,
  screenReaderHints: true,
  voiceFirstMode: false,
  visualMode: false,
  simpleMode: false,
  tapToSpeakMode: false,
  companionMode: false,
  udidNumber: 'UDID-KA-2025-19034',
  udidVerified: true,
  emergencyContactName: 'Priya Nair (Sister)',
  emergencyContactPhone: '+91 98450 90123',
  privacyConsent: {
    shareNeedWithConductor: true,
    shareLiveLocation: true,
    saveFrequentStops: true,
    smsFallbackAlerts: true,
  },
  notifications: {
    push: true,
    sms: true,
    vibration: true,
    voice: true,
  },
  onboardingCompleted: false,
};

const DEFAULT_ADMIN_SIM: AdminSimState = {
  delayAllBusesMin: 0,
  forceWheelchairFull: false,
  simulateBusCancelledMidBooking: false,
  simulateNoBusesRoute: false,
  simulateConductorUnacknowledged: false,
  simulateNetworkFailure: false,
  simulateNoisyEnvironment: false,
};

export interface BookingDraft {
  originStopId: string;
  destinationStopId: string;
  travelDate: string;
  timePeriod: 'now' | 'morning' | 'afternoon' | 'evening' | 'custom';
  customTime: string;
  selectedBusId: string | null;
  assistance: AssistanceChecklist;
  conductorNotes: string;
}

const DEFAULT_DRAFT: BookingDraft = {
  originStopId: 'stop-2',
  destinationStopId: 'stop-1',
  travelDate: 'Today',
  timePeriod: 'morning',
  customTime: '09:15',
  selectedBusId: null,
  assistance: {
    needRamp: true,
    needBoardingHelp: true,
    guideDog: false,
    companionTraveler: false,
    largeMobilityAid: false,
  },
  conductorNotes: '',
};

interface AppState {
  profile: AccessibilityProfile;
  buses: Bus[];
  bookings: Booking[];
  activeTicketId: string | null;
  waitlist: WaitlistEntry[];
  serviceAlerts: ServiceAlert[];
  sosAlerts: SOSAlert[];
  offlineQueue: QueuedOfflineAction[];
  favorites: Array<{label: string; stopId: string}>;
  draft: BookingDraft;

  // Voice & UI states
  orbState: OrbState;
  micVolume: number;
  lastCaption: string;
  lastTranscript: string;
  voiceHistory: Array<{role: 'user' | 'assistant'; text: string; time: string}>;
  suggestedCorrection: string | null;
  pendingVoiceConfirm: {type: 'book' | 'cancel'; payload?: unknown} | null;

  accessibilityPanelOpen: boolean;
  toasts: ToastMessage[];
  adminSim: AdminSimState;
  conductorLoggedIn: boolean;
  activeConductorId: string;

  // Judge demo state
  judgeDemoActive: boolean;
  judgeDemoStep: number;
  judgeDemoSubtitle: string;

  // Actions
  updateProfile: (partial: Partial<AccessibilityProfile>) => void;
  toggleNeed: (need: DisabilityNeed) => void;
  applyDemoPreset: (presetKey: 'blind' | 'deaf' | 'wheelchair' | 'cognitive' | 'speech' | 'reset') => void;
  setLanguage: (lang: AppLanguage) => void;
  setAccessibilityPanelOpen: (open: boolean) => void;

  setOrbState: (state: OrbState) => void;
  setMicVolume: (vol: number) => void;
  setLastCaption: (text: string) => void;
  setLastTranscript: (text: string) => void;
  addVoiceTurn: (role: 'user' | 'assistant', text: string) => void;
  setSuggestedCorrection: (text: string | null) => void;
  setPendingVoiceConfirm: (pending: {type: 'book' | 'cancel'; payload?: unknown} | null) => void;

  updateDraft: (partial: Partial<BookingDraft>) => void;
  swapDraftStops: () => void;

  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, partial: Partial<Booking>) => void;
  cancelBooking: (id: string) => void;
  setActiveTicketId: (id: string | null) => void;
  addWaitlist: (entry: WaitlistEntry) => void;
  enqueueOfflineAction: (action: QueuedOfflineAction) => void;
  flushOfflineQueue: () => void;

  addSOSAlert: (alert: SOSAlert) => void;
  resolveSOSAlert: (id: string) => void;

  updateAdminSim: (partial: Partial<AdminSimState>) => void;
  resetDemoData: () => void;
  setConductorAuth: (loggedIn: boolean, conductorId?: string) => void;

  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;

  setJudgeDemo: (active: boolean, step?: number, subtitle?: string) => void;
}

function applyProfileDerivedModes(needs: DisabilityNeed[]): Partial<AccessibilityProfile> {
  return {
    voiceFirstMode: needs.includes('blind'),
    visualMode: needs.includes('deaf') || needs.includes('speech'),
    simpleMode: needs.includes('cognitive'),
    tapToSpeakMode: needs.includes('speech'),
    companionMode: needs.includes('companion'),
    captionsEnabled: needs.includes('deaf') ? true : undefined,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      buses: BUSES,
      bookings: INITIAL_BOOKINGS,
      activeTicketId: INITIAL_BOOKINGS[0].id,
      waitlist: [],
      serviceAlerts: INITIAL_ALERTS,
      sosAlerts: [],
      offlineQueue: [],
      favorites: [
        {label: 'Home · Indiranagar', stopId: 'stop-6'},
        {label: 'Hospital · AIIMS Rehab', stopId: 'stop-9'},
        {label: 'Rail · Majestic Station', stopId: 'stop-1'},
      ],
      draft: DEFAULT_DRAFT,

      orbState: 'idle',
      micVolume: 0,
      lastCaption: 'Tap the Voice Orb or say "Hey Bus" to plan your journey.',
      lastTranscript: '',
      voiceHistory: [],
      suggestedCorrection: null,
      pendingVoiceConfirm: null,

      accessibilityPanelOpen: false,
      toasts: [],
      adminSim: DEFAULT_ADMIN_SIM,
      conductorLoggedIn: true,
      activeConductorId: 'cond-1',

      judgeDemoActive: false,
      judgeDemoStep: 0,
      judgeDemoSubtitle: '',

      updateProfile: (partial) =>
        set((state) => ({
          profile: {...state.profile, ...partial},
        })),

      toggleNeed: (need) =>
        set((state) => {
          const exists = state.profile.needs.includes(need);
          const nextNeeds = exists
            ? state.profile.needs.filter((n) => n !== need)
            : [...state.profile.needs, need];
          const derived = applyProfileDerivedModes(nextNeeds);
          const cleanDerived = Object.fromEntries(
            Object.entries(derived).filter(([, v]) => v !== undefined),
          );
          return {
            profile: {
              ...state.profile,
              needs: nextNeeds,
              ...cleanDerived,
            },
            draft: {
              ...state.draft,
              assistance: {
                ...state.draft.assistance,
                needRamp: nextNeeds.includes('wheelchair'),
                guideDog: nextNeeds.includes('blind'),
                companionTraveler: nextNeeds.includes('companion'),
              },
            },
          };
        }),

      applyDemoPreset: (presetKey) => {
        if (presetKey === 'reset') {
          set({profile: {...DEFAULT_PROFILE, onboardingCompleted: true}});
          return;
        }
        const preset = DEMO_PROFILE_PRESETS[presetKey];
        if (!preset) return;
        set((state) => ({
          profile: {
            ...DEFAULT_PROFILE,
            ...preset,
            language: state.profile.language,
            onboardingCompleted: true,
          },
        }));
      },

      setLanguage: (lang) => {
        void i18n.changeLanguage(lang);
        set((state) => ({
          profile: {...state.profile, language: lang},
        }));
      },

      setAccessibilityPanelOpen: (open) => set({accessibilityPanelOpen: open}),

      setOrbState: (orbState) => set({orbState}),
      setMicVolume: (micVolume) => set({micVolume}),
      setLastCaption: (lastCaption) => set({lastCaption}),
      setLastTranscript: (lastTranscript) => set({lastTranscript}),
      addVoiceTurn: (role, text) =>
        set((state) => ({
          voiceHistory: [
            ...state.voiceHistory.slice(-12),
            {
              role,
              text,
              time: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            },
          ],
        })),
      setSuggestedCorrection: (suggestedCorrection) => set({suggestedCorrection}),
      setPendingVoiceConfirm: (pendingVoiceConfirm) => set({pendingVoiceConfirm}),

      updateDraft: (partial) =>
        set((state) => ({
          draft: {...state.draft, ...partial},
        })),

      swapDraftStops: () =>
        set((state) => ({
          draft: {
            ...state.draft,
            originStopId: state.draft.destinationStopId,
            destinationStopId: state.draft.originStopId,
          },
        })),

      addBooking: (booking) => {
        const {profile} = get();
        triggerFeedback('success', {
          hapticsEnabled: profile.hapticsEnabled,
          soundEnabled: profile.soundEnabled,
        });
        set((state) => ({
          bookings: [booking, ...state.bookings],
          activeTicketId: booking.id,
        }));
      },

      updateBooking: (id, partial) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === id ? {...b, ...partial} : b)),
        })),

      cancelBooking: (id) =>
        set((state) => ({
          bookings: state.bookings.map((b) =>
            b.id === id ? {...b, status: 'cancelled'} : b,
          ),
        })),

      setActiveTicketId: (activeTicketId) => set({activeTicketId}),

      addWaitlist: (entry) =>
        set((state) => ({
          waitlist: [entry, ...state.waitlist],
        })),

      enqueueOfflineAction: (action) =>
        set((state) => ({
          offlineQueue: [...state.offlineQueue, action],
        })),

      flushOfflineQueue: () => set({offlineQueue: []}),

      addSOSAlert: (alert) => {
        const {profile} = get();
        triggerFeedback('sos', {
          hapticsEnabled: profile.hapticsEnabled,
          soundEnabled: profile.soundEnabled,
        });
        set((state) => ({
          sosAlerts: [alert, ...state.sosAlerts],
        }));
      },

      resolveSOSAlert: (id) =>
        set((state) => ({
          sosAlerts: state.sosAlerts.map((a) => (a.id === id ? {...a, resolved: true} : a)),
        })),

      updateAdminSim: (partial) =>
        set((state) => ({
          adminSim: {...state.adminSim, ...partial},
        })),

      resetDemoData: () => {
        void i18n.changeLanguage('en');
        set({
          profile: DEFAULT_PROFILE,
          buses: BUSES,
          bookings: INITIAL_BOOKINGS,
          activeTicketId: INITIAL_BOOKINGS[0].id,
          waitlist: [],
          serviceAlerts: INITIAL_ALERTS,
          sosAlerts: [],
          offlineQueue: [],
          draft: DEFAULT_DRAFT,
          adminSim: DEFAULT_ADMIN_SIM,
          voiceHistory: [],
          suggestedCorrection: null,
          pendingVoiceConfirm: null,
          judgeDemoActive: false,
          judgeDemoStep: 0,
          judgeDemoSubtitle: '',
        });
      },

      setConductorAuth: (conductorLoggedIn, conductorId) =>
        set((state) => ({
          conductorLoggedIn,
          activeConductorId: conductorId ?? state.activeConductorId,
        })),

      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({
          toasts: [...state.toasts, {...toast, id}],
        }));
        const duration = toast.durationMs ?? (toast.onUndo ? 30000 : 5000);
        setTimeout(() => {
          get().removeToast(id);
        }, duration);
        return id;
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      setJudgeDemo: (active, step = 0, subtitle = '') =>
        set({
          judgeDemoActive: active,
          judgeDemoStep: step,
          judgeDemoSubtitle: subtitle,
        }),
    }),
    {
      name: 'sahayyatra-storage-v1',
      partialize: (state) => ({
        profile: state.profile,
        bookings: state.bookings,
        activeTicketId: state.activeTicketId,
        waitlist: state.waitlist,
        offlineQueue: state.offlineQueue,
        favorites: state.favorites,
        draft: state.draft,
      }),
    },
  ),
);

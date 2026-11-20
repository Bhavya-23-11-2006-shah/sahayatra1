import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {FastForward, Pause, Play, X} from 'lucide-react';
import {createBusBooking} from '../api/client';
import {useAppStore} from '../store/useAppStore';
import {speakText, stopSpeaking} from '../utils/speech';

const DEMO_STEPS = [
  {
    durationMs: 7000,
    route: '/home',
    speaker: 'System',
    subtitle: 'Activating Blind / Voice-First Profile for Aarav Verma (UDID 50% Concession verified).',
    orb: 'idle' as const,
  },
  {
    durationMs: 9000,
    route: '/home',
    speaker: 'Aarav (Voice)',
    subtitle: '“Hey Bus, I want to go to the railway station tomorrow morning.”',
    orb: 'listening' as const,
  },
  {
    durationMs: 9000,
    route: '/book?step=1',
    speaker: 'SahayYatra Assistant',
    subtitle:
      '“Showing accessible morning buses from MG Road Gate 2 to Majestic Central Railway Station. Bus 305-R at 09:15 has 1 wheelchair bay and audio announcements. Nearest earlier is 09:03, 12 minutes earlier.”',
    orb: 'speaking' as const,
  },
  {
    durationMs: 9000,
    route: '/book?step=2',
    speaker: 'Aarav (Voice)',
    subtitle: '“Book the 9:15 one.” — Reading summary: Bus 305-R at 09:15, ₹11 concession fare. Say CONFIRM to book.',
    orb: 'speaking' as const,
  },
  {
    durationMs: 11000,
    route: '/ticket',
    speaker: 'SahayYatra Assistant',
    subtitle: '“Confirmed! Ticket generated offline with QR code. Conductor Rajesh Kumar has been notified ✓.”',
    orb: 'speaking' as const,
  },
  {
    durationMs: 12000,
    route: '/conductor',
    speaker: 'Conductor Manifest',
    subtitle:
      'Live Conductor View lights up: Stop 2 MG Road Gate 2 — Aarav Verma (Blind / Guide Dog) · One-tap Acknowledge ready.',
    orb: 'idle' as const,
  },
];

export const JudgeDemoPlayer: React.FC = () => {
  const navigate = useNavigate();
  const judgeDemoActive = useAppStore((s) => s.judgeDemoActive);
  const judgeDemoStep = useAppStore((s) => s.judgeDemoStep);
  const judgeDemoSubtitle = useAppStore((s) => s.judgeDemoSubtitle);
  const setJudgeDemo = useAppStore((s) => s.setJudgeDemo);
  const applyDemoPreset = useAppStore((s) => s.applyDemoPreset);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setLastCaption = useAppStore((s) => s.setLastCaption);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const profile = useAppStore((s) => s.profile);

  const [paused, setPaused] = React.useState(false);

  useEffect(() => {
    if (!judgeDemoActive) return;

    const current = DEMO_STEPS[judgeDemoStep];
    if (!current) {
      setJudgeDemo(false, 0, '');
      setOrbState('idle');
      return;
    }

    setOrbState(current.orb);
    setLastCaption(current.subtitle);
    setJudgeDemo(true, judgeDemoStep, current.subtitle);

    if (judgeDemoStep === 0) {
      applyDemoPreset('blind');
    } else if (judgeDemoStep === 2) {
      updateDraft({
        originStopId: 'stop-2',
        destinationStopId: 'stop-1',
        timePeriod: 'morning',
        selectedBusId: 'bus-1',
      });
    } else if (judgeDemoStep === 4) {
      const state = useAppStore.getState();
      const targetBus = state.buses[0];
      void createBusBooking({
        bus: targetBus,
        originStopId: 'stop-2',
        destinationStopId: 'stop-1',
        travelDate: 'Tomorrow',
        assistance: {
          needRamp: false,
          needBoardingHelp: true,
          guideDog: true,
          companionTraveler: false,
          largeMobilityAid: false,
        },
        conductorNotes: 'Guide dog + audio stop callouts requested.',
      }).catch(() => {
        // Already exists if replayed
      });
    }

    navigate(current.route);

    if (profile.soundEnabled && !paused) {
      speakText(current.subtitle, {
        language: 'en',
        rate: 1.05,
        muted: !profile.soundEnabled,
      });
    }

    if (paused) return;

    const timer = setTimeout(() => {
      if (judgeDemoStep + 1 < DEMO_STEPS.length) {
        setJudgeDemo(true, judgeDemoStep + 1, DEMO_STEPS[judgeDemoStep + 1].subtitle);
      } else {
        setJudgeDemo(false, 0, '');
        setOrbState('idle');
      }
    }, current.durationMs);

    return () => clearTimeout(timer);
  }, [
    applyDemoPreset,
    judgeDemoActive,
    judgeDemoStep,
    navigate,
    paused,
    profile.soundEnabled,
    setJudgeDemo,
    setLastCaption,
    setOrbState,
    updateDraft,
  ]);

  if (!judgeDemoActive) return null;

  return (
    <aside
      aria-label="Automated Judge Demo Walkthrough"
      className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl rounded-3xl bg-[#0B1B3A] text-white border-2 border-[#00A3A3] p-4 sm:p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-bold tracking-wide text-[#45E6E6]">
          JUDGE WALKTHROUGH · STEP {judgeDemoStep + 1} OF {DEMO_STEPS.length} ·{' '}
          {DEMO_STEPS[judgeDemoStep]?.speaker}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setPaused((p) => !p);
            }}
            aria-label={paused ? 'Resume demo' : 'Pause demo'}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              if (judgeDemoStep + 1 < DEMO_STEPS.length) {
                setJudgeDemo(true, judgeDemoStep + 1, DEMO_STEPS[judgeDemoStep + 1].subtitle);
              } else {
                setJudgeDemo(false, 0, '');
              }
            }}
            aria-label="Next demo step"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <FastForward className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setOrbState('idle');
              setJudgeDemo(false, 0, '');
            }}
            aria-label="Stop judge demo"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm sm:text-base font-medium leading-snug text-white">
        {judgeDemoSubtitle}
      </p>

      {/* Progress track */}
      <div className="mt-3 grid grid-cols-6 gap-1.5" aria-hidden="true">
        {DEMO_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full ${
              idx <= judgeDemoStep ? 'bg-[#FF7A1A]' : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </aside>
  );
};

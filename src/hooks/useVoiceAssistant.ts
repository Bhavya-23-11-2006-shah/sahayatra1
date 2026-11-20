import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {createBusBooking, parseVoiceIntent, sendSOSAlert} from '../api/client';
import {STOPS} from '../data/seed';
import {useAppStore} from '../store/useAppStore';
import {triggerFeedback} from '../utils/haptics';
import {
  isSpeechRecognitionSupported,
  speakText,
  startListening,
  stopSpeaking,
  type SpeechRecognitionHandle,
} from '../utils/speech';

export function useVoiceAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAppStore((s) => s.profile);
  const orbState = useAppStore((s) => s.orbState);
  const setOrbState = useAppStore((s) => s.setOrbState);
  const setMicVolume = useAppStore((s) => s.setMicVolume);
  const setLastCaption = useAppStore((s) => s.setLastCaption);
  const setLastTranscript = useAppStore((s) => s.setLastTranscript);
  const addVoiceTurn = useAppStore((s) => s.addVoiceTurn);
  const setSuggestedCorrection = useAppStore((s) => s.setSuggestedCorrection);
  const pendingVoiceConfirm = useAppStore((s) => s.pendingVoiceConfirm);
  const setPendingVoiceConfirm = useAppStore((s) => s.setPendingVoiceConfirm);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const addToast = useAppStore((s) => s.addToast);

  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionHandle | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>('');

  const stopMicMeter = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setMicVolume(0);
  }, [setMicVolume]);

  const speakReply = useCallback(
    (text: string) => {
      setLastCaption(text);
      addVoiceTurn('assistant', text);
      setOrbState('speaking');
      speakText(text, {
        language: profile.language,
        rate: profile.voiceSpeed,
        muted: !profile.soundEnabled,
        onEnd: () => {
          setOrbState('idle');
        },
      });
    },
    [
      addVoiceTurn,
      profile.language,
      profile.soundEnabled,
      profile.voiceSpeed,
      setLastCaption,
      setOrbState,
    ],
  );

  const executeIntent = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) {
        setOrbState('error');
        setLastCaption('I did not catch that — please speak again or type below.');
        return;
      }

      addVoiceTurn('user', clean);
      setOrbState('thinking');
      setSuggestedCorrection(null);

      try {
        const res = await parseVoiceIntent({
          transcript: clean,
          language: profile.language,
          currentPath: location.pathname,
          context: {
            needs: profile.needs,
            pendingVoiceConfirm,
          },
        });

        if (res.suggestedCorrection) {
          setSuggestedCorrection(res.suggestedCorrection);
        }

        // Handle explicit confirmation flow
        if (
          pendingVoiceConfirm &&
          (res.intent === 'CONFIRM_BOOKING' || res.intent === 'CONFIRM')
        ) {
          if (pendingVoiceConfirm.type === 'book') {
            const state = useAppStore.getState();
            const selectedBus =
              state.buses.find((b) => b.id === state.draft.selectedBusId) || state.buses[0];
            try {
              const booking = await createBusBooking({
                bus: selectedBus,
                originStopId: state.draft.originStopId,
                destinationStopId: state.draft.destinationStopId,
                travelDate: state.draft.travelDate,
                assistance: state.draft.assistance,
                conductorNotes: state.draft.conductorNotes || 'Booked via Hey Bus voice assistant.',
              });
              setPendingVoiceConfirm(null);
              navigate(`/ticket/${booking.id}`);
              speakReply(
                `Confirmed! Ticket ${booking.pnr} booked on bus ${booking.routeNumber} at ${booking.departureTime}. Conductor ${booking.conductorId === 'cond-1' ? 'Rajesh Kumar' : 'Ananya Sharma'} has been notified.`,
              );
              return;
            } catch (err) {
              setPendingVoiceConfirm(null);
              const msg = err instanceof Error ? err.message : 'Unable to complete booking.';
              setOrbState('error');
              setLastCaption(msg);
              return;
            }
          } else if (pendingVoiceConfirm.type === 'cancel') {
            const state = useAppStore.getState();
            const active = state.bookings.find(
              (b) => b.id === state.activeTicketId && b.status !== 'cancelled',
            );
            if (active) {
              state.cancelBooking(active.id);
              addToast({
                type: 'warning',
                title: `Ticket ${active.pnr} cancelled`,
                description: 'Full concession fare refund initiated.',
                undoLabel: 'Undo cancel (30s)',
                onUndo: () => state.updateBooking(active.id, {status: 'confirmed'}),
                durationMs: 30000,
              });
              setPendingVoiceConfirm(null);
              speakReply(`Ticket ${active.pnr} has been cancelled. You can tap Undo for 30 seconds.`);
              return;
            }
          }
        }

        switch (res.intent) {
          case 'SEARCH_BUS':
          case 'SEARCH_TRIP': {
            const destText = res.entities?.destination?.toLowerCase() || '';
            const matchedDest = STOPS.find(
              (s) =>
                s.name.toLowerCase().includes(destText) ||
                (destText.includes('rail') && s.id === 'stop-1') ||
                (destText.includes('hospital') && s.id === 'stop-9') ||
                (destText.includes('metro') && s.id === 'stop-2'),
            );
            if (matchedDest) {
              updateDraft({destinationStopId: matchedDest.id});
            }
            if (res.entities?.timePeriod) {
              updateDraft({timePeriod: res.entities.timePeriod});
            }
            navigate('/book?step=1');
            break;
          }
          case 'SELECT_BUS':
          case 'BOOK_TRIP': {
            const state = useAppStore.getState();
            const targetBus =
              state.buses.find((b) =>
                res.entities?.busSelection
                  ? b.departureTime.includes(res.entities.busSelection)
                  : true,
              ) || state.buses[0];
            updateDraft({selectedBusId: targetBus.id});
            setPendingVoiceConfirm({type: 'book', payload: {busId: targetBus.id}});
            navigate('/book?step=2');
            break;
          }
          case 'CONFIRM_BOOKING':
          case 'CONFIRM': {
            setPendingVoiceConfirm({type: 'book'});
            navigate('/book?step=2');
            break;
          }
          case 'CANCEL_BOOKING':
          case 'CANCEL': {
            setPendingVoiceConfirm({type: 'cancel'});
            break;
          }
          case 'TRACK_BUS': {
            navigate('/track');
            break;
          }
          case 'CALL_CONDUCTOR':
          case 'REQUEST_STOP': {
            navigate('/journey');
            break;
          }
          case 'SOS_EMERGENCY':
          case 'SOS': {
            const state = useAppStore.getState();
            const active = state.bookings.find((b) => b.id === state.activeTicketId);
            await sendSOSAlert(active);
            addToast({
              type: 'error',
              title: 'SOS Emergency Alert Triggered',
              description: 'Live location & ticket sent to conductor and depot control.',
            });
            break;
          }
          case 'CHANGE_LANGUAGE': {
            const targetLang = (
              (res.entities as {targetLanguage?: 'en' | 'hi' | 'bn'} | undefined)?.targetLanguage ||
              'en'
            );
            setLanguage(targetLang);
            break;
          }
          case 'HELP': {
            navigate('/help');
            break;
          }
          case 'NAVIGATE': {
            const target = res.uiAction?.route || '/home';
            navigate(target);
            break;
          }
          case 'ACCESSIBILITY_TOGGLE': {
            const setting = (res.entities?.accessibilitySetting || '').toLowerCase();
            if (setting.includes('dark')) updateProfile({theme: 'dark'});
            else if (setting.includes('contrast')) updateProfile({theme: 'high-contrast'});
            else if (setting.includes('large') || setting.includes('font'))
              updateProfile({fontScale: Math.min(2, profile.fontScale + 0.25)});
            else if (setting.includes('hi') || setting.includes('hindi')) setLanguage('hi');
            else if (setting.includes('bn') || setting.includes('bengali')) setLanguage('bn');
            break;
          }
          default:
            break;
        }

        triggerFeedback('tap', {
          hapticsEnabled: profile.hapticsEnabled,
          soundEnabled: profile.soundEnabled,
        });

        speakReply(res.spokenReply);
      } catch (err) {
        setOrbState('error');
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach voice assistant. Please try again or use tap controls.';
        setLastCaption(message);
        addToast({
          type: 'error',
          title: 'Voice Assistant Error',
          description: message,
        });
      }
    },
    [
      addToast,
      addVoiceTurn,
      location.pathname,
      navigate,
      pendingVoiceConfirm,
      profile.fontScale,
      profile.hapticsEnabled,
      profile.language,
      profile.needs,
      profile.soundEnabled,
      setLanguage,
      setLastCaption,
      setOrbState,
      setPendingVoiceConfirm,
      setSuggestedCorrection,
      speakReply,
      updateDraft,
      updateProfile,
    ],
  );

  const startMicVolumeMeter = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      micStreamRef.current = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setMicVolume(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mic meter optional
    }
  }, [setMicVolume]);

  const stopListeningSession = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopMicMeter();
  }, [stopMicMeter]);

  const beginListening = useCallback(() => {
    // Allow barge-in: stop speaking immediately
    stopSpeaking();
    setMicPermissionError(null);
    finalTranscriptRef.current = '';

    if (!isSpeechRecognitionSupported()) {
      setOrbState('error');
      setMicPermissionError(
        'Voice microphone recognition is not supported in this browser. Use the quick text box or tap controls below.',
      );
      return;
    }

    triggerFeedback('tap', {
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
    });

    setOrbState('listening');
    setLastCaption('Listening… say your destination, bus time, or "Where is my bus?"');
    void startMicVolumeMeter();

    recognitionRef.current = startListening({
      language: profile.language,
      continuous: false,
      onResult: (transcript, isFinal) => {
        setLastTranscript(transcript);
        setLastCaption(`Heard: "${transcript}"`);
        if (isFinal) {
          finalTranscriptRef.current = transcript;
        }
      },
      onError: (code) => {
        stopMicMeter();
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setMicPermissionError(
            'Microphone access was denied. Enable mic permission in browser settings, or type your command below.',
          );
        } else if (code === 'no-speech') {
          setLastCaption("I didn't catch anything. Shall I try again?");
        } else {
          setLastCaption('Audio interrupted. Tap the orb or type your request below.');
        }
        setOrbState('error');
      },
      onEnd: () => {
        stopMicMeter();
        const spoken = finalTranscriptRef.current || useAppStore.getState().lastTranscript;
        if (spoken.trim()) {
          finalTranscriptRef.current = '';
          setLastTranscript('');
          void executeIntent(spoken);
        } else if (useAppStore.getState().orbState === 'listening') {
          setOrbState('idle');
        }
      },
    });
  }, [
    executeIntent,
    profile.hapticsEnabled,
    profile.language,
    profile.soundEnabled,
    setLastCaption,
    setLastTranscript,
    setOrbState,
    startMicVolumeMeter,
    stopMicMeter,
  ]);

  const toggleOrb = useCallback(() => {
    if (orbState === 'listening') {
      stopListeningSession();
      setOrbState('idle');
      return;
    }
    if (orbState === 'speaking') {
      stopSpeaking();
      beginListening();
      return;
    }
    beginListening();
  }, [beginListening, orbState, setOrbState, stopListeningSession]);

  // Press-and-hold spacebar activation (when not typing in an input)
  useEffect(() => {
    let spaceTimer: ReturnType<typeof setTimeout> | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        return;
      }
      spaceTimer = setTimeout(() => {
        beginListening();
      }, 320);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceTimer) {
        clearTimeout(spaceTimer);
        spaceTimer = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [beginListening]);

  // Shake phone activation (devicemotion)
  useEffect(() => {
    let lastShake = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0);
      if (magnitude > 26 && Date.now() - lastShake > 3000) {
        lastShake = Date.now();
        beginListening();
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [beginListening]);

  return {
    orbState,
    micPermissionError,
    wakeWordEnabled,
    setWakeWordEnabled,
    toggleOrb,
    beginListening,
    stopListeningSession,
    executeIntent,
    speakReply,
  };
}

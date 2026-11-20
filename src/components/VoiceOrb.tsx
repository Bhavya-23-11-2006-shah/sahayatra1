import React, {useState} from 'react';
import {Mic, MicOff, Send, Volume2, VolumeX} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useVoiceAssistant} from '../hooks/useVoiceAssistant';
import {useAppStore} from '../store/useAppStore';
import {stopSpeaking} from '../utils/speech';

interface VoiceOrbProps {
  compact?: boolean;
  showTextFallback?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  compact = false,
  showTextFallback = true,
}) => {
  const {t} = useTranslation();
  const profile = useAppStore((s) => s.profile);
  const orbState = useAppStore((s) => s.orbState);
  const micVolume = useAppStore((s) => s.micVolume);
  const lastCaption = useAppStore((s) => s.lastCaption);
  const suggestedCorrection = useAppStore((s) => s.suggestedCorrection);
  const setSuggestedCorrection = useAppStore((s) => s.setSuggestedCorrection);

  const {
    micPermissionError,
    wakeWordEnabled,
    setWakeWordEnabled,
    toggleOrb,
    executeIntent,
  } = useVoiceAssistant();

  const [typedCommand, setTypedCommand] = useState('');
  const [showMicExplain, setShowMicExplain] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedCommand.trim()) return;
    const text = typedCommand;
    setTypedCommand('');
    void executeIntent(text);
  };

  const stateLabel =
    orbState === 'listening'
      ? t('orb.listening')
      : orbState === 'thinking'
      ? t('orb.thinking')
      : orbState === 'speaking'
      ? t('orb.speaking')
      : orbState === 'error'
      ? t('orb.error')
      : t('orb.idle');

  const orbSize = compact ? 'w-28 h-28' : 'w-40 h-40 sm:w-48 sm:h-48';
  const rippleScale = orbState === 'listening' ? 1 + micVolume * 0.45 : 1;

  return (
    <div className="flex flex-col items-center text-center w-full max-w-xl mx-auto">
      {/* Voice Orb Interactive Button */}
      <div className="relative flex items-center justify-center my-2">
        {/* Reactive outer ripples */}
        <span
          aria-hidden="true"
          style={{transform: `scale(${rippleScale})`}}
          className={`absolute inset-0 rounded-full transition-transform duration-150 ${
            orbState === 'listening'
              ? 'bg-[var(--sy-cta-bright)]/25'
              : orbState === 'speaking'
              ? 'bg-[var(--sy-primary-bright)]/25 animate-pulse'
              : 'bg-[var(--sy-primary-bright)]/12'
          }`}
        />
        {orbState === 'thinking' && (
          <span
            aria-hidden="true"
            className="absolute -inset-3 rounded-full border-4 border-dashed border-[var(--sy-cta)] animate-orb-swirl"
          />
        )}

        <button
          type="button"
          onClick={toggleOrb}
          aria-label={`Voice Assistant Orb. State: ${orbState}. ${stateLabel}`}
          aria-pressed={orbState === 'listening'}
          className={`relative ${orbSize} rounded-full flex flex-col items-center justify-center cursor-pointer shadow-2xl transition-transform duration-200 active:scale-95 focus-visible:outline-4 ${
            orbState === 'idle' ? 'animate-orb-breathe' : ''
          }`}
          style={{
            background:
              orbState === 'error'
                ? 'radial-gradient(circle at 32% 28%, #FF8585, #B31B1B 70%)'
                : orbState === 'listening'
                ? 'radial-gradient(circle at 30% 25%, #FFB020, #FF7A1A 55%, #0B1B3A 100%)'
                : orbState === 'speaking'
                ? 'radial-gradient(circle at 30% 25%, #5CFF8D, #00A3A3 58%, #0B1B3A 100%)'
                : 'radial-gradient(circle at 30% 25%, #45E6E6, #00A3A3 52%, #0B1B3A 100%)',
          }}
        >
          {orbState === 'listening' ? (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow" aria-hidden="true" />
          ) : orbState === 'speaking' ? (
            <Volume2 className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow" aria-hidden="true" />
          ) : orbState === 'error' ? (
            <MicOff className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow" aria-hidden="true" />
          ) : (
            <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow" aria-hidden="true" />
          )}

          {/* Waveform bars during speaking */}
          {orbState === 'speaking' && (
            <div className="flex items-end gap-1 mt-2 h-4" aria-hidden="true">
              {[0.6, 1, 0.75, 0.9, 0.5].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-white rounded-full animate-pulse"
                  style={{height: `${h * 16}px`, animationDelay: `${i * 110}ms`}}
                />
              ))}
            </div>
          )}

          <span className="mt-1.5 text-xs font-bold tracking-wide text-white/95 px-3">
            {orbState === 'listening'
              ? 'Listening'
              : orbState === 'thinking'
              ? 'Thinking'
              : orbState === 'speaking'
              ? 'Tap to stop'
              : 'Hey Bus'}
          </span>
        </button>
      </div>

      {/* Wake-word & Barge-in Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => setShowMicExplain((v) => !v)}
          aria-expanded={showMicExplain}
          className="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold border border-[var(--sy-border)] bg-[var(--sy-surface)] text-[var(--sy-text)] hover:border-[var(--sy-primary)] cursor-pointer"
        >
          {wakeWordEnabled ? 'Hands-free "Hey Bus": On' : 'Enable "Hey Bus" Hands-Free'}
        </button>

        {orbState === 'speaking' && (
          <button
            type="button"
            onClick={() => stopSpeaking()}
            className="min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold bg-[var(--sy-danger-bg)] text-[var(--sy-danger)] border border-[var(--sy-danger)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <VolumeX className="w-4 h-4" aria-hidden="true" />
            Mute Reply
          </button>
        )}
      </div>

      {showMicExplain && (
        <div className="mt-3 p-4 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface)] text-left text-sm w-full">
          <p className="font-bold">Why SahayYatra asks for Microphone access</p>
          <p className="text-[var(--sy-text-muted)] text-xs mt-1">
            Your voice is only processed to understand bus routes and stop requests. Audio is never stored or sold. You can also hold Spacebar or shake your phone to speak anytime.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setWakeWordEnabled(!wakeWordEnabled);
                setShowMicExplain(false);
                if (!wakeWordEnabled) toggleOrb();
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] text-xs font-bold cursor-pointer"
            >
              {wakeWordEnabled ? 'Turn Off Hands-Free' : 'Allow & Start Listening'}
            </button>
            <button
              type="button"
              onClick={() => setShowMicExplain(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--sy-border)] text-xs font-bold cursor-pointer"
            >
              Use Tap & Type Instead
            </button>
          </div>
        </div>
      )}

      {/* Live Caption Bar (essential for Deaf / Hard of Hearing) */}
      {(profile.captionsEnabled || profile.visualMode) && (
        <div
          aria-live="polite"
          className="mt-4 w-full rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 py-3 text-left shadow-sm"
        >
          <p className="text-xs font-bold text-[var(--sy-primary)] mb-0.5">
            Live Captions · {stateLabel}
          </p>
          <p className="text-sm sm:text-base font-medium text-[var(--sy-text)]">
            {lastCaption}
          </p>
        </div>
      )}

      {/* Mic Denied / Unsupported Fallback Banner */}
      {micPermissionError && (
        <div
          role="alert"
          className="mt-3 w-full rounded-2xl border border-[var(--sy-saffron)] bg-[var(--sy-saffron-bg)] px-4 py-3 text-left text-xs sm:text-sm"
        >
          <p className="font-bold">Voice Mic Unavailable — Fallback Active</p>
          <p className="mt-0.5">{micPermissionError}</p>
        </div>
      )}

      {/* Misheard / "Did you mean...?" Suggestion */}
      {suggestedCorrection && (
        <div className="mt-3 w-full rounded-2xl border border-[var(--sy-primary)] bg-[var(--sy-surface-muted)] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left">
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Did you mean: </span>
            <span>“{suggestedCorrection}”</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const suggestion = suggestedCorrection;
              setSuggestedCorrection(null);
              void executeIntent(suggestion);
            }}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] text-xs font-bold cursor-pointer"
          >
            Yes, run this
          </button>
        </div>
      )}

      {/* Text & Tap-to-Speak Fallback Input */}
      {showTextFallback && (
        <form onSubmit={handleSubmit} className="mt-4 w-full flex gap-2">
          <label htmlFor="voice-text-command" className="sr-only">
            Type a voice command
          </label>
          <input
            id="voice-text-command"
            type="text"
            value={typedCommand}
            onChange={(e) => setTypedCommand(e.target.value)}
            placeholder={t('orb.placeholder')}
            className="flex-1 min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 text-sm sm:text-base text-[var(--sy-text)] placeholder:text-[var(--sy-text-muted)]/70"
          />
          <button
            type="submit"
            aria-label={t('orb.send')}
            className="min-h-[52px] min-w-[56px] px-4 rounded-2xl bg-[var(--sy-cta)] text-[var(--sy-cta-ink)] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('orb.send')}</span>
          </button>
        </form>
      )}
    </div>
  );
};

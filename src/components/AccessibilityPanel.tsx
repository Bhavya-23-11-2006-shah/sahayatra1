import React, {useEffect} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {useAppStore} from '../store/useAppStore';
import type {AppLanguage, ThemeMode} from '../types';
import {Modal} from './ui/Modal';

export const AccessibilityPanel: React.FC = () => {
  const profile = useAppStore((s) => s.profile);
  const open = useAppStore((s) => s.accessibilityPanelOpen);
  const setOpen = useAppStore((s) => s.setAccessibilityPanelOpen);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setLanguage = useAppStore((s) => s.setLanguage);

  // Keyboard shortcut Alt+A
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Accessibility Controls (Alt+A)"
        title="Accessibility Controls (Alt+A)"
        className="fixed bottom-24 sm:bottom-6 left-4 z-40 min-h-[52px] px-4 py-3 rounded-2xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] font-bold shadow-xl border-2 border-white/25 inline-flex items-center gap-2 cursor-pointer hover:brightness-110"
      >
        <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
        <span className="text-sm whitespace-nowrap">Accessibility</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Accessibility & Comfort Settings"
        description="Shortcut: Alt+A anytime. All changes apply immediately across SahayYatra."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Theme */}
          <div>
            <p className="text-sm font-bold mb-2">Contrast & Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'light', label: 'Light (AAA)'},
                  {id: 'dark', label: 'Dark Navy'},
                  {id: 'high-contrast', label: 'High Contrast'},
                ] as Array<{id: ThemeMode; label: string}>
              ).map((themeOpt) => (
                <button
                  key={themeOpt.id}
                  type="button"
                  onClick={() => updateProfile({theme: themeOpt.id})}
                  aria-pressed={profile.theme === themeOpt.id}
                  className={`min-h-[48px] px-3 py-2 rounded-2xl text-sm font-bold border-2 cursor-pointer ${
                    profile.theme === themeOpt.id
                      ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] border-[var(--sy-primary)]'
                      : 'bg-[var(--sy-surface-muted)] text-[var(--sy-text)] border-[var(--sy-border)]'
                  }`}
                >
                  {themeOpt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <p className="text-sm font-bold mb-2">Voice & Screen Language</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {id: 'en', label: 'English'},
                  {id: 'hi', label: 'हिन्दी (Hindi)'},
                  {id: 'bn', label: 'বাংলা (Bengali)'},
                ] as Array<{id: AppLanguage; label: string}>
              ).map((langOpt) => (
                <button
                  key={langOpt.id}
                  type="button"
                  onClick={() => setLanguage(langOpt.id)}
                  aria-pressed={profile.language === langOpt.id}
                  className={`min-h-[48px] px-3 py-2 rounded-2xl text-sm font-bold border-2 cursor-pointer ${
                    profile.language === langOpt.id
                      ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] border-[var(--sy-primary)]'
                      : 'bg-[var(--sy-surface-muted)] text-[var(--sy-text)] border-[var(--sy-border)]'
                  }`}
                >
                  {langOpt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Scale Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="a11y-font-scale" className="text-sm font-bold">
                Text Size
              </label>
              <span className="font-tabular text-sm font-bold text-[var(--sy-primary)]">
                {Math.round(profile.fontScale * 100)}%
              </span>
            </div>
            <input
              id="a11y-font-scale"
              type="range"
              min={1}
              max={2}
              step={0.1}
              value={profile.fontScale}
              onChange={(e) => updateProfile({fontScale: Number(e.target.value)})}
              className="w-full h-3 accent-[var(--sy-primary)] cursor-pointer"
            />
            <div className="flex justify-between text-xs text-[var(--sy-text-muted)] mt-1">
              <span>100% (18px)</span>
              <span>150%</span>
              <span>200%</span>
            </div>
          </div>

          {/* Voice Speed Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="a11y-voice-speed" className="text-sm font-bold">
                Voice Reading Speed
              </label>
              <span className="font-tabular text-sm font-bold text-[var(--sy-primary)]">
                {profile.voiceSpeed.toFixed(2)}×
              </span>
            </div>
            <input
              id="a11y-voice-speed"
              type="range"
              min={0.7}
              max={1.5}
              step={0.05}
              value={profile.voiceSpeed}
              onChange={(e) => updateProfile({voiceSpeed: Number(e.target.value)})}
              className="w-full h-3 accent-[var(--sy-primary)] cursor-pointer"
            />
          </div>

          {/* Toggles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {key: 'dyslexiaFont', label: 'Dyslexia-Friendly Font (OpenDyslexic)'},
              {key: 'reduceMotion', label: 'Reduce Motion & Animations'},
              {key: 'captionsEnabled', label: 'Always Show Live Captions'},
              {key: 'hapticsEnabled', label: 'Vibration / Haptic Feedback'},
              {key: 'soundEnabled', label: 'Spoken Voice & Audio Cues'},
              {key: 'colorBlindSafe', label: 'Color-Blind-Safe Palette'},
              {key: 'screenReaderHints', label: 'Screen-Reader ARIA Hints'},
              {key: 'simpleMode', label: 'Simple Mode (Plain Language)'},
            ].map((item) => {
              const checked = Boolean(
                profile[item.key as keyof typeof profile],
              );
              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() =>
                    updateProfile({
                      [item.key]: !checked,
                    })
                  }
                  className={`min-h-[52px] px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-3 text-left text-sm font-bold cursor-pointer ${
                    checked
                      ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                      : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-tabular shrink-0 ${
                      checked
                        ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                        : 'bg-black/10 text-[var(--sy-text-muted)]'
                    }`}
                  >
                    {checked ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};

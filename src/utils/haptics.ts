export type HapticPattern =
  | 'tap'
  | 'success'
  | 'warning'
  | 'sos'
  | 'nextStop'
  | 'yourStop';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 18,
  success: [40, 50, 75],
  warning: [80, 60, 80],
  sos: [200, 100, 200, 100, 350],
  nextStop: [120],
  yourStop: [420],
};

let audioCtx: AudioContext | null = null;

function playEarcon(type: HapticPattern) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success' || type === 'yourStop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'warning' || type === 'sos') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(349.23, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.31);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch {
    // Audio playback blocked or unsupported
  }
}

export function triggerFeedback(
  pattern: HapticPattern,
  options: {hapticsEnabled: boolean; soundEnabled: boolean},
) {
  if (options.hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(PATTERNS[pattern]);
    } catch {
      // Vibration ignored
    }
  }
  if (options.soundEnabled) {
    playEarcon(pattern);
  }
}

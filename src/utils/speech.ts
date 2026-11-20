import type {AppLanguage} from '../types';

const LANG_LOCALES: Record<AppLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
};

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as {SpeechRecognition?: unknown}).SpeechRecognition ||
      (window as unknown as {webkitSpeechRecognition?: unknown}).webkitSpeechRecognition,
  );
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(
  text: string,
  options: {
    language: AppLanguage;
    rate?: number;
    muted?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
  },
) {
  if (options.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_LOCALES[options.language] || 'en-IN';
    utterance.rate = options.rate ?? 1;
    utterance.pitch = 1.02;
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    window.speechSynthesis.speak(utterance);
  } catch {
    options.onEnd?.();
  }
}

export interface SpeechRecognitionHandle {
  stop: () => void;
}

export function startListening(options: {
  language: AppLanguage;
  continuous?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (errorCode: string) => void;
  onEnd: () => void;
}): SpeechRecognitionHandle | null {
  if (typeof window === 'undefined') return null;
  const Rec =
    (window as unknown as {SpeechRecognition?: new () => SpeechRecognitionInstance}).SpeechRecognition ||
    (window as unknown as {webkitSpeechRecognition?: new () => SpeechRecognitionInstance}).webkitSpeechRecognition;

  if (!Rec) {
    options.onError('unsupported');
    return null;
  }

  try {
    const recognition = new Rec();
    recognition.lang = LANG_LOCALES[options.language] || 'en-IN';
    recognition.continuous = Boolean(options.continuous);
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const result = event.results[lastIndex];
      if (!result) return;
      const transcript = result[0]?.transcript ?? '';
      options.onResult(transcript, Boolean(result.isFinal));
    };

    recognition.onerror = (event) => {
      options.onError(event.error || 'unknown');
    };

    recognition.onend = () => {
      options.onEnd();
    };

    recognition.start();
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    options.onError('failed-to-start');
    return null;
  }
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {results: ArrayLike<{isFinal?: boolean; 0?: {transcript: string}}>}) => void) | null;
  onerror: ((event: {error?: string}) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

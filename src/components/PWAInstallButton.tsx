import React, {useEffect, useState} from 'react';
import {Download} from 'lucide-react';
import {Modal} from './ui/Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as {standalone?: boolean}).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const {outcome} = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{className?: string}> = ({className = ''}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`min-h-[48px] px-4 py-2 rounded-2xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${className}`}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`min-h-[48px] px-4 py-2 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] text-[var(--sy-text)] text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer hover:border-[var(--sy-primary)] ${className}`}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Install Offline App
      </button>

      <Modal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="Install SahayYatra for Offline Access"
        description="Your last digital ticket and conductor details remain accessible even with zero cellular signal."
      >
        <div className="space-y-3 text-sm">
          {isIOS ? (
            <ol className="list-decimal pl-5 space-y-2">
              <li>Tap the <strong>Share</strong> icon in your Safari toolbar.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> to launch SahayYatra in full-screen standalone mode.</li>
            </ol>
          ) : (
            <ol className="list-decimal pl-5 space-y-2">
              <li>Open your browser menu (three dots in the top corner).</li>
              <li>Select <strong>Install SahayYatra</strong> or <strong>Add to Home screen</strong>.</li>
              <li>Once installed, your active QR ticket and conductor details are cached automatically.</li>
            </ol>
          )}
        </div>
      </Modal>
    </>
  );
};

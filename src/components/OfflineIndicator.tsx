import React, {useEffect, useState} from 'react';
import {MessageSquareText, WifiOff} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAppStore} from '../store/useAppStore';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const {t} = useTranslation();
  const isOnline = useOnlineStatus();
  const offlineQueue = useAppStore((s) => s.offlineQueue);
  const flushOfflineQueue = useAppStore((s) => s.flushOfflineQueue);
  const addToast = useAppStore((s) => s.addToast);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const count = offlineQueue.length;
      flushOfflineQueue();
      addToast({
        type: 'success',
        title: `Back Online — Synced ${count} queued action${count > 1 ? 's' : ''}`,
        description: 'Your bookings and check-ins are up to date with transit control.',
      });
    }
  }, [addToast, flushOfflineQueue, isOnline, offlineQueue.length]);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-[var(--sy-saffron-bg)] border-b-2 border-[var(--sy-saffron)] text-[var(--sy-text)] px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 font-bold">
          <WifiOff className="w-5 h-5 text-[var(--sy-saffron)] shrink-0" aria-hidden="true" />
          <span>{t('common.offlineBanner')}</span>
          {offlineQueue.length > 0 && (
            <span className="font-tabular text-xs underline">
              ({offlineQueue.length} queued)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <MessageSquareText className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('common.smsFallback')}</span>
        </div>
      </div>
    </div>
  );
};

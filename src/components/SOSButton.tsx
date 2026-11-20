import React, {useEffect, useRef, useState} from 'react';
import {PhoneCall, ShieldAlert} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {sendSOSAlert} from '../api/client';
import {useAppStore} from '../store/useAppStore';
import {Modal} from './ui/Modal';

export const SOSButton: React.FC<{compact?: boolean}> = ({compact = false}) => {
  const {t} = useTranslation();
  const bookings = useAppStore((s) => s.bookings);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const sosAlerts = useAppStore((s) => s.sosAlerts);
  const resolveSOSAlert = useAppStore((s) => s.resolveSOSAlert);
  const addToast = useAppStore((s) => s.addToast);

  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showActiveModal, setShowActiveModal] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const activeUnresolvedSOS = sosAlerts.find((a) => !a.resolved);

  const triggerSOS = async () => {
    setHolding(false);
    setProgress(0);
    const activeTicket = bookings.find((b) => b.id === activeTicketId) || bookings[0];
    await sendSOSAlert(activeTicket);
    setShowActiveModal(true);
    addToast({
      type: 'error',
      title: t('sos.activeTitle'),
      description: 'Live location & ticket details dispatched to conductor, emergency contact, and depot control.',
    });
  };

  const startHold = () => {
    if (holding) return;
    setHolding(true);
    startTimeRef.current = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setProgress(pct);
      if (pct >= 100) {
        void triggerSOS();
      } else {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const cancelHold = () => {
    setHolding(false);
    setProgress(0);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            cancelHold();
          }
        }}
        onClick={() => {
          if (activeUnresolvedSOS) setShowActiveModal(true);
        }}
        aria-label="Emergency SOS. Press and hold for 2 seconds to send live location and ticket details."
        className={`relative overflow-hidden rounded-2xl bg-[var(--sy-danger)] text-white font-bold inline-flex items-center justify-center gap-2.5 select-none cursor-pointer shadow-lg ${
          compact ? 'min-h-[52px] px-4 py-2.5 text-sm' : 'min-h-[64px] w-full px-6 py-4 text-base'
        }`}
      >
        {/* Hold Progress Fill */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-black/35 transition-none"
          style={{width: `${progress}%`}}
        />
        <ShieldAlert className="w-6 h-6 relative z-10 shrink-0" aria-hidden="true" />
        <span className="relative z-10 whitespace-nowrap">
          {holding
            ? `${t('sos.sending')} (${Math.ceil(((100 - progress) / 100) * 2)}s)`
            : activeUnresolvedSOS
            ? 'SOS Active — View Status'
            : t('sos.holdLabel')}
        </span>
      </button>

      <Modal
        open={showActiveModal && Boolean(activeUnresolvedSOS)}
        onClose={() => setShowActiveModal(false)}
        title={t('sos.activeTitle')}
        description="Emergency responders and your bus conductor have received your real-time details."
      >
        {activeUnresolvedSOS && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[var(--sy-danger-bg)] border-2 border-[var(--sy-danger)] p-4">
              <p className="font-bold text-base">
                Passenger: {activeUnresolvedSOS.passengerName}
              </p>
              <p className="text-sm mt-1">Location: {activeUnresolvedSOS.locationText}</p>
              {activeUnresolvedSOS.ticketPnr && (
                <p className="text-sm font-tabular mt-1">
                  Ticket: {activeUnresolvedSOS.ticketPnr} · Bus {activeUnresolvedSOS.busNumber}
                </p>
              )}
              <p className="text-xs text-[var(--sy-text-muted)] mt-2">
                Dispatched at {activeUnresolvedSOS.triggeredAt} · Control Room #112 notified
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="tel:112"
                className="min-h-[56px] rounded-2xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] font-bold flex items-center justify-center gap-2 no-underline"
              >
                <PhoneCall className="w-5 h-5" aria-hidden="true" />
                Call Depot Control (112)
              </a>
              <button
                type="button"
                onClick={() => {
                  resolveSOSAlert(activeUnresolvedSOS.id);
                  setShowActiveModal(false);
                }}
                className="min-h-[56px] rounded-2xl border-2 border-[var(--sy-border)] font-bold cursor-pointer"
              >
                {t('sos.cancel')} / Mark Safe
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

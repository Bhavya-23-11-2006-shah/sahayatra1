import React from 'react';
import {AlertTriangle, CheckCircle2, Info, RotateCcw, X, XCircle} from 'lucide-react';
import {useAppStore} from '../../store/useAppStore';

export const ToastRegion: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-24 sm:bottom-6 right-4 left-4 sm:left-auto sm:w-[420px] z-50 flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'warning'
            ? AlertTriangle
            : toast.type === 'error'
            ? XCircle
            : Info;

        const accent =
          toast.type === 'success'
            ? 'border-[var(--sy-success)] bg-[var(--sy-success-bg)] text-[var(--sy-text)]'
            : toast.type === 'warning'
            ? 'border-[var(--sy-saffron)] bg-[var(--sy-saffron-bg)] text-[var(--sy-text)]'
            : toast.type === 'error'
            ? 'border-[var(--sy-danger)] bg-[var(--sy-danger-bg)] text-[var(--sy-text)]'
            : 'border-[var(--sy-primary)] bg-[var(--sy-surface)] text-[var(--sy-text)]';

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-2xl border-2 p-4 shadow-xl flex items-start gap-3 ${accent}`}
          >
            <Icon className="w-6 h-6 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-snug">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-[var(--sy-text-muted)] mt-1">{toast.description}</p>
              )}
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onUndo?.();
                    removeToast(toast.id);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--sy-cta)] text-[var(--sy-cta-ink)] text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  {toast.undoLabel || 'Undo'}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-black/10 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

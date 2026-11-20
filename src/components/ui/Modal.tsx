import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-xl',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea',
      );
      firstFocusable?.focus();
    }, 30);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={`w-full ${maxWidth} rounded-3xl bg-[var(--sy-surface)] text-[var(--sy-text)] border-2 border-[var(--sy-border)] p-6 sm:p-8 shadow-2xl my-auto max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="modal-title" className="text-xl sm:text-2xl font-bold leading-tight">
              {title}
            </h2>
            {description && (
              <p id="modal-desc" className="text-sm text-[var(--sy-text-muted)] mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[48px] min-w-[48px] rounded-2xl flex items-center justify-center border border-[var(--sy-border)] hover:bg-[var(--sy-surface-muted)] cursor-pointer shrink-0"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

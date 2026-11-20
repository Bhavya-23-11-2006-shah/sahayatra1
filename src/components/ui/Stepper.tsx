import React from 'react';
import {Check} from 'lucide-react';

interface StepperProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({steps, currentStep, onStepClick}) => {
  return (
    <nav aria-label="Progress steps" className="w-full">
      <ol className="flex items-center justify-between gap-2 sm:gap-4">
        {steps.map((label, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const clickable = Boolean(onStepClick && idx <= currentStep);

          return (
            <li key={label} className="flex-1 flex items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(idx)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex items-center gap-2.5 min-h-[48px] w-full rounded-2xl px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] font-bold'
                    : isCompleted
                    ? 'bg-[var(--sy-success-bg)] text-[var(--sy-success)] font-bold'
                    : 'bg-[var(--sy-surface)] text-[var(--sy-text-muted)] border border-[var(--sy-border)]'
                } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-tabular shrink-0 ${
                    isCurrent
                      ? 'bg-white/20'
                      : isCompleted
                      ? 'bg-[var(--sy-success)] text-white'
                      : 'bg-[var(--sy-surface-muted)]'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" aria-hidden="true" /> : idx + 1}
                </span>
                <span className="truncate text-sm">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

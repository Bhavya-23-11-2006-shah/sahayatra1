import React from 'react';
import {useAppStore} from '../../store/useAppStore';
import {triggerFeedback} from '../../utils/haptics';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'lg',
  icon,
  fullWidth = false,
  className = '',
  onClick,
  children,
  disabled,
  type = 'button',
  ...rest
}) => {
  const {hapticsEnabled, soundEnabled} = useAppStore((s) => s.profile);

  const base =
    'inline-flex items-center justify-center gap-2.5 font-bold rounded-2xl transition-transform duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClass =
    size === 'lg'
      ? 'min-h-[56px] px-6 py-3.5 text-base'
      : 'min-h-[48px] px-4 py-2.5 text-sm';

  const variantClass =
    variant === 'primary'
      ? 'bg-[var(--sy-cta)] text-[var(--sy-cta-ink)] hover:brightness-110 shadow-sm'
      : variant === 'secondary'
      ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] hover:brightness-110 shadow-sm'
      : variant === 'danger'
      ? 'bg-[var(--sy-danger)] text-white hover:brightness-110 shadow-sm'
      : variant === 'outline'
      ? 'bg-[var(--sy-surface)] text-[var(--sy-text)] border-2 border-[var(--sy-border)] hover:border-[var(--sy-primary)]'
      : 'bg-transparent text-[var(--sy-text)] hover:bg-[var(--sy-surface-muted)]';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      triggerFeedback('tap', {hapticsEnabled, soundEnabled});
      onClick?.(e);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`${base} ${sizeClass} ${variantClass} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

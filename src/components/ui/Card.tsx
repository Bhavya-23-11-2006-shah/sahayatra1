import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  muted?: boolean;
}

export const Card: React.FC<CardProps> = ({
  padded = true,
  muted = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`rounded-3xl border border-[var(--sy-border)] ${
        muted ? 'bg-[var(--sy-surface-muted)]' : 'bg-[var(--sy-surface)]'
      } ${padded ? 'p-6 sm:p-7' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

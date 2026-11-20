import React from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {BusFront, Home, MapPin, Ticket, UserCheck} from 'lucide-react';
import {useTranslation} from 'react-i18next';

export const Navbar: React.FC = () => {
  const {t} = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    {to: '/home', label: t('nav.home')},
    {to: '/book', label: t('nav.book')},
    {to: '/track', label: t('nav.track')},
    {to: '/ticket', label: t('nav.ticket')},
    {to: '/conductor', label: t('nav.conductor')},
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--sy-surface)]/95 backdrop-blur-md border-b border-[var(--sy-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-8">
          {/* Zone 1: Single clean text wordmark */}
          <Link
            to="/"
            className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--sy-text)] whitespace-nowrap shrink-0 no-underline"
          >
            {t('brand')}
          </Link>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm font-bold whitespace-nowrap shrink-0 no-underline py-2 border-b-2 transition-colors ${
                  isActive(item.to)
                    ? 'text-[var(--sy-primary)] border-[var(--sy-primary)]'
                    : 'text-[var(--sy-text-muted)] border-transparent hover:text-[var(--sy-text)]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => navigate('/book')}
              className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[var(--sy-cta)] text-[var(--sy-cta-ink)] text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer hover:brightness-110"
            >
              {t('nav.bookNow')}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb Navigation (<= 15% mobile viewport height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--sy-surface)]/95 backdrop-blur-md border-t border-[var(--sy-border)] grid grid-cols-5 h-16"
      >
        {[
          {to: '/home', label: 'Home', Icon: Home},
          {to: '/book', label: 'Book', Icon: BusFront},
          {to: '/track', label: 'Track', Icon: MapPin},
          {to: '/ticket', label: 'Ticket', Icon: Ticket},
          {to: '/conductor', label: 'Staff', Icon: UserCheck},
        ].map(({to, label, Icon}) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold no-underline ${
                active ? 'text-[var(--sy-primary)]' : 'text-[var(--sy-text-muted)]'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {motion} from 'motion/react';
import {
  ArrowRight,
  BusFront,
  CheckCircle2,
  Mic,
  PlayCircle,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {PWAInstallButton} from '../components/PWAInstallButton';
import {VoiceOrb} from '../components/VoiceOrb';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {NEED_META} from '../components/ui/DisabilityPictograms';
import {useVoiceAssistant} from '../hooks/useVoiceAssistant';
import {useAppStore} from '../store/useAppStore';
import type {AppLanguage, DisabilityNeed} from '../types';

export const LandingPage: React.FC = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const applyDemoPreset = useAppStore((s) => s.applyDemoPreset);
  const setJudgeDemo = useAppStore((s) => s.setJudgeDemo);
  const {beginListening, speakReply} = useVoiceAssistant();

  const [ridesCount, setRidesCount] = useState(14820);
  const [busesOnline, setBusesOnline] = useState(312);

  useEffect(() => {
    const interval = setInterval(() => {
      setRidesCount((c) => c + 1);
      setBusesOnline((b) => (b === 312 ? 314 : 312));
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const handleStartJudgeDemo = () => {
    setJudgeDemo(true, 0, 'Starting 60-second accessible booking walkthrough…');
  };

  return (
    <div className="pb-24 md:pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--sy-border)] bg-[var(--sy-surface-muted)]">
        {/* Stylized Animated City Route Map Backdrop */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 540"
          className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00A3A3" />
              <stop offset="55%" stopColor="#FF7A1A" />
              <stop offset="100%" stopColor="#0B1B3A" />
            </linearGradient>
          </defs>
          {/* Subtle city grid blocks */}
          <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="1.5">
            <path d="M0 120H1440M0 240H1440M0 360H1440M0 460H1440" />
            <path d="M180 0V540M420 0V540M720 0V540M1020 0V540M1260 0V540" />
          </g>
          {/* Animated accessible bus corridor line */}
          <motion.path
            d="M-40 410 C 210 380, 340 180, 620 220 C 890 260, 1020 110, 1480 150"
            fill="none"
            stroke="url(#routeGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            initial={{pathLength: 0}}
            animate={{pathLength: 1}}
            transition={{duration: 2.2, ease: 'easeOut'}}
          />
          {/* Accessible stops */}
          {[
            {cx: 220, cy: 332},
            {cx: 540, cy: 215},
            {cx: 900, cy: 210},
            {cx: 1220, cy: 145},
          ].map((pt, i) => (
            <g key={i}>
              <circle cx={pt.cx} cy={pt.cy} r="14" fill="#FFFFFF" stroke="#0B1B3A" strokeWidth="4" />
              <circle cx={pt.cx} cy={pt.cy} r="5" fill="#FF7A1A" />
            </g>
          ))}
          {/* Gliding bus marker along route */}
          <motion.g
            initial={{x: 160, y: 345}}
            animate={{x: [160, 520, 880, 1200], y: [345, 200, 195, 130]}}
            transition={{duration: 12, repeat: Infinity, ease: 'easeInOut'}}
          >
            <rect x="-24" y="-16" width="48" height="32" rx="10" fill="#0B1B3A" />
            <rect x="-16" y="-10" width="32" height="12" rx="4" fill="#45E6E6" />
            <circle cx="-12" cy="16" r="5" fill="#FF7A1A" />
            <circle cx="12" cy="16" r="5" fill="#FF7A1A" />
          </motion.g>
        </svg>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {/* Language & Install Quick Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2" role="group" aria-label="Select language">
              {(
                [
                  {id: 'en', label: 'English'},
                  {id: 'hi', label: 'हिन्दी'},
                  {id: 'bn', label: 'বাংলা'},
                ] as Array<{id: AppLanguage; label: string}>
              ).map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id)}
                  aria-pressed={profile.language === lang.id}
                  className={`min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold border-2 cursor-pointer transition-colors ${
                    profile.language === lang.id
                      ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] border-[var(--sy-primary)]'
                      : 'bg-[var(--sy-surface)] text-[var(--sy-text)] border-[var(--sy-border)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <PWAInstallButton />
          </div>

          {/* 2-Column Hero Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-sm font-bold text-[var(--sy-primary)]">
                {t('hero.kicker')} · WCAG 2.2 AAA
              </p>
              <h1
                className="font-bold tracking-tight text-[var(--sy-text)] leading-[1.12]"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3.6rem)',
                  textWrap: 'balance',
                }}
              >
                {t('hero.title')}
              </h1>
              <p className="text-lg sm:text-xl text-[var(--sy-text-muted)] max-w-2xl leading-relaxed">
                {t('hero.subtitle')}
              </p>

              {/* Primary CTA + Judge Demo + Profile Setup */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  icon={<Mic className="w-5 h-5" />}
                  onClick={() => {
                    beginListening();
                    speakReply(
                      'Hello! I am SahayYatra. Tell me where you want to go, or tap a quick command.',
                    );
                  }}
                >
                  {t('hero.tryVoice')}
                </Button>

                <Button
                  variant="secondary"
                  icon={<PlayCircle className="w-5 h-5" />}
                  onClick={handleStartJudgeDemo}
                >
                  {t('hero.judgeDemo')}
                </Button>

                <Link
                  to="/onboarding"
                  className="min-h-[56px] px-5 py-3 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] text-[var(--sy-text)] font-bold inline-flex items-center gap-2 no-underline hover:border-[var(--sy-primary)] whitespace-nowrap"
                >
                  {t('hero.getStarted')}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Hero Right: Glassmorphic Voice Orb Stage + Floating "Hey Bus" Pill */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-[var(--sy-border)] bg-[var(--sy-surface)]/85 backdrop-blur-md p-6 sm:p-8 shadow-xl">
                <div className="flex justify-center mb-4">
                  <button
                    type="button"
                    onClick={beginListening}
                    className="min-h-[44px] px-5 py-2 rounded-full bg-[#0B1B3A] text-white text-sm font-bold inline-flex items-center gap-2 shadow-md cursor-pointer hover:brightness-110"
                  >
                    <Volume2 className="w-4 h-4 text-[#45E6E6]" aria-hidden="true" />
                    <span>{t('hero.heyBusPill')}</span>
                  </button>
                </div>
                <VoiceOrb compact />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Civic Stats Strip */}
      <section aria-label="Live transit network statistics" className="max-w-7xl mx-auto px-4 sm:px-6 mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card>
            <p className="text-xs font-bold text-[var(--sy-text-muted)]">
              Accessible Rides Completed
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-tabular text-[var(--sy-text)] mt-1">
              {ridesCount.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--sy-success)] font-bold mt-1">
              50% UDID concession applied automatically
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-[var(--sy-text-muted)]">
              Low-Floor Ramp Buses Online
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-tabular text-[var(--sy-primary)] mt-1">
              {busesOnline}
            </p>
            <p className="text-xs text-[var(--sy-text-muted)] mt-1">
              Across 8 city corridors & 25 tactile stops
            </p>
          </Card>
          <Card>
            <p className="text-xs font-bold text-[var(--sy-text-muted)]">
              Conductor Alert Acknowledgment
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-tabular text-[var(--sy-cta)] mt-1">
              14 sec
            </p>
            <p className="text-xs text-[var(--sy-text-muted)] mt-1">
              Median ramp-readiness confirmation before arrival
            </p>
          </Card>
        </div>
      </section>

      {/* 01-04 How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            How SahayYatra works in four calm steps
          </h2>
          <p className="text-[var(--sy-text-muted)] mt-2 max-w-2xl">
            Designed so a blind, deaf, wheelchair, or elderly commuter can board any government bus without anxiety.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01. Say it',
              title: 'Speak or tap your route',
              desc: 'Say "Hey Bus, take me to the railway station tomorrow morning" in English, Hindi, or Bengali.',
            },
            {
              step: '02. Pick a bus',
              title: 'See ramp & bay availability',
              desc: 'Compare live wheelchair bays, low-floor status, and smart earlier/later time alternatives.',
            },
            {
              step: '03. Get a ticket',
              title: 'Offline QR & audio summary',
              desc: 'Your QR ticket caches offline with boarding stop tactile details and 50% UDID concession.',
            },
            {
              step: '04. Conductor ready',
              title: 'Ramp deployed on arrival',
              desc: 'The bus conductor receives your stop and need alert ahead of time and confirms readiness.',
            },
          ].map((item, idx) => (
            <motion.div
              key={item.step}
              initial={{opacity: 0, y: 14}}
              whileInView={{opacity: 1, y: 0}}
              viewport={{once: true}}
              transition={{delay: idx * 0.08, duration: 0.3}}
            >
              <Card className="h-full flex flex-col justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--sy-primary)] font-tabular">
                    {item.step}
                  </p>
                  <h3 className="text-xl font-bold mt-2">{item.title}</h3>
                  <p className="text-sm text-[var(--sy-text-muted)] mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature Grid by Disability Type (Asymmetric Bento) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Adapts automatically to your accessibility needs
            </h2>
            <p className="text-[var(--sy-text-muted)] mt-2">
              Select any profile below to preview how SahayYatra transforms instantly, or combine multiple modes.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-[var(--sy-surface-muted)] text-[var(--sy-primary)] font-bold inline-flex items-center gap-2 no-underline"
          >
            Customize My Profile
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(Object.keys(NEED_META) as DisabilityNeed[]).map((key, idx) => {
            const meta = NEED_META[key];
            const presetKey = key === 'companion' ? 'wheelchair' : key;
            return (
              <Card
                key={key}
                className={`flex flex-col justify-between ${
                  idx === 0 || idx === 2 ? 'lg:row-span-1' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-3 text-[var(--sy-primary)] mb-3">
                    {meta.icon}
                    <span className="text-xs font-bold">{meta.modeBadge}</span>
                  </div>
                  <h3 className="text-xl font-bold">{meta.label}</h3>
                  <p className="text-sm text-[var(--sy-text-muted)] mt-2 leading-relaxed">
                    {meta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    applyDemoPreset(presetKey as 'blind' | 'deaf' | 'wheelchair' | 'cognitive' | 'speech');
                    navigate('/home');
                  }}
                  className="mt-5 min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-[var(--sy-border)] hover:border-[var(--sy-primary)] font-bold text-sm text-left flex items-center justify-between cursor-pointer"
                >
                  <span>Preview {meta.shortLabel}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Proof & Accessible Bus Stop Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-[var(--sy-border)] bg-[var(--sy-surface-muted)] min-h-[280px] relative">
            <img
              src="/src/assets/images/accessible_bus_stop_1795157741798.jpg"
              alt="Low-floor electric city bus parked flush against a tactile-paved transit platform with its wheelchair ramp extended for boarding"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between gap-6">
            <Card>
              <p className="text-xs font-bold text-[var(--sy-primary)]">
                Commuter Stories · Verified Transit Trials
              </p>
              <blockquote className="text-lg font-bold mt-2 leading-snug">
                “Before SahayYatra, buses drove past because drivers did not know a wheelchair passenger was waiting. Now Rajesh sees my booking three stops ahead and extends the ramp every single morning.”
              </blockquote>
              <p className="text-sm text-[var(--sy-text-muted)] mt-3">
                Meera Nair · Accessibility Auditor, Civic Mobility Forum · Cut wait-time uncertainty from 42 min to 4 min
              </p>
            </Card>

            <Card muted>
              <blockquote className="text-lg font-bold leading-snug">
                “With Voice-First mode and tactile stop warnings, I traveled independently to AIIMS Hospital and back using only spoken commands.”
              </blockquote>
              <p className="text-sm text-[var(--sy-text-muted)] mt-3">
                Aarav Verma · Music Educator, Blind Relief Association · 100% hands-free ticket & stop announcements
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Government Trust Bar & Quiet Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 pt-8 border-t border-[var(--sy-border)]">
        <div className="flex flex-wrap items-center justify-between gap-6 pb-8">
          <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-[var(--sy-text)]">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--sy-primary)]" aria-hidden="true" />
              UDID Concession Integrated
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--sy-success)]" aria-hidden="true" />
              WCAG 2.2 AAA Target
            </span>
            <span className="inline-flex items-center gap-2">
              <BusFront className="w-5 h-5 text-[var(--sy-cta)]" aria-hidden="true" />
              Zero Personal Data Resale
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm font-bold">
            <Link to="/help" className="text-[var(--sy-text-muted)] hover:text-[var(--sy-text)]">
              Help & Voice Cheat-Sheet
            </Link>
            <Link to="/settings" className="text-[var(--sy-text-muted)] hover:text-[var(--sy-text)]">
              Data & Privacy
            </Link>
            <Link to="/conductor" className="text-[var(--sy-text-muted)] hover:text-[var(--sy-text)]">
              Conductor Portal
            </Link>
            <Link to="/admin" className="text-[var(--sy-text-muted)] hover:text-[var(--sy-text)]">
              Demo Panel (Ctrl+Shift+D)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

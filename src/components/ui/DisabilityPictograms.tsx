import React from 'react';
import {
  Accessibility,
  EarOff,
  EyeOff,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {DisabilityNeed} from '../../types';

export const RampPictogram: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M3 19H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M5 19L19 11V19" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <circle cx="11" cy="7.5" r="2.2" fill="currentColor" />
    <path d="M11 10.5L13 13.5H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LowFloorPictogram: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="6" width="18" height="11" rx="3" stroke="currentColor" strokeWidth="2.2" />
    <path d="M3 13H21" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="7.5" cy="18.5" r="2" fill="currentColor" />
    <circle cx="16.5" cy="18.5" r="2" fill="currentColor" />
    <path d="M12 20V22M9 21H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const BraillePictogram: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <circle cx="7" cy="6" r="1.9" />
    <circle cx="7" cy="12" r="1.9" />
    <circle cx="7" cy="18" r="1.9" opacity="0.35" />
    <circle cx="13" cy="6" r="1.9" opacity="0.35" />
    <circle cx="13" cy="12" r="1.9" />
    <circle cx="13" cy="18" r="1.9" />
    <circle cx="18" cy="6" r="1.9" />
    <circle cx="18" cy="12" r="1.9" opacity="0.35" />
  </svg>
);

export const PrioritySeatPictogram: React.FC<{className?: string}> = ({className = 'w-5 h-5'}) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M7 5V14H15L18 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7.5" cy="4" r="1.8" fill="currentColor" />
    <path d="M6 17H13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const NEED_META: Record<
  DisabilityNeed,
  {
    label: string;
    shortLabel: string;
    description: string;
    modeBadge: string;
    icon: React.ReactNode;
  }
> = {
  blind: {
    label: 'Blind / Low Vision',
    shortLabel: 'Voice-First',
    description: 'Auto-reads every screen aloud, continuous Voice Orb, audio cues, and screen-reader ARIA hints.',
    modeBadge: 'Voice-First Mode',
    icon: <EyeOff className="w-6 h-6" aria-hidden="true" />,
  },
  deaf: {
    label: 'Deaf / Hard of Hearing',
    shortLabel: 'Visual Alerts',
    description: 'Live captions for every spoken reply, flashing visual alerts, vibration cues, and conductor messaging.',
    modeBadge: 'Visual Mode',
    icon: <EarOff className="w-6 h-6" aria-hidden="true" />,
  },
  wheelchair: {
    label: 'Wheelchair / Mobility',
    shortLabel: 'Ramp & Bay',
    description: 'Filters for low-floor ramp-equipped buses, shows live wheelchair bay capacity, and notifies conductors.',
    modeBadge: 'Mobility Priority',
    icon: <Accessibility className="w-6 h-6" aria-hidden="true" />,
  },
  speech: {
    label: 'Speech Impairment',
    shortLabel: 'Tap-to-Speak',
    description: 'One-tap phrase cards ("I need a ramp", "Where is my bus?") spoken aloud via TTS plus text keyboard.',
    modeBadge: 'Tap-to-Speak Mode',
    icon: <MessageSquare className="w-6 h-6" aria-hidden="true" />,
  },
  cognitive: {
    label: 'Cognitive / Elderly',
    shortLabel: 'Simple Mode',
    description: '3-step calm booking, large pictograms, one decision per screen, plain language, and Yes/No controls.',
    modeBadge: 'Simple Mode',
    icon: <Sparkles className="w-6 h-6" aria-hidden="true" />,
  },
  companion: {
    label: 'Caregiver / Companion',
    shortLabel: 'Companion',
    description: 'Book and track rides on behalf of a passenger, share live boarding updates, and sync emergency contacts.',
    modeBadge: 'Companion Mode',
    icon: <HeartHandshake className="w-6 h-6" aria-hidden="true" />,
  },
};

export const BusFeatureIcons: React.FC<{
  features: {
    ramp: boolean;
    lowFloor: boolean;
    audioAnnouncer: boolean;
    brailleSignage: boolean;
  };
}> = ({features}) => (
  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--sy-text-muted)]">
    {features.ramp && (
      <span className="inline-flex items-center gap-1.5" title="Wheelchair Ramp">
        <RampPictogram className="w-4 h-4 text-[var(--sy-primary)]" />
        <span>Ramp</span>
      </span>
    )}
    {features.lowFloor && (
      <span className="inline-flex items-center gap-1.5" title="Low-Floor Entry">
        <LowFloorPictogram className="w-4 h-4 text-[var(--sy-primary)]" />
        <span>Low-floor</span>
      </span>
    )}
    {features.audioAnnouncer && (
      <span className="inline-flex items-center gap-1.5" title="Audio Stop Announcer">
        <Volume2 className="w-4 h-4 text-[var(--sy-primary)]" aria-hidden="true" />
        <span>Audio</span>
      </span>
    )}
    {features.brailleSignage && (
      <span className="inline-flex items-center gap-1.5" title="Braille Signage">
        <BraillePictogram className="w-4 h-4 text-[var(--sy-primary)]" />
        <span>Braille</span>
      </span>
    )}
  </div>
);

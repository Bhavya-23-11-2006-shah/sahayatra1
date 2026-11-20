import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {
  AlertTriangle,
  BusFront,
  Clock,
  MapPin,
  MessageSquare,
  PhoneCall,
  Ticket,
  Volume2,
} from 'lucide-react';
import {getConductorById, getStopById} from '../api/client';
import {SOSButton} from '../components/SOSButton';
import {VoiceOrb} from '../components/VoiceOrb';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {NEED_META} from '../components/ui/DisabilityPictograms';
import {STOPS} from '../data/seed';
import {useVoiceAssistant} from '../hooks/useVoiceAssistant';
import {useAppStore} from '../store/useAppStore';
import {speakText} from '../utils/speech';

const TAP_TO_SPEAK_PHRASES = [
  'Book a bus to the railway station',
  'I need a wheelchair ramp deployed',
  'Where is my bus right now?',
  'Please give me extra time to board',
  'Confirm my booking',
  'Call my bus conductor',
];

export const HomeDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const bookings = useAppStore((s) => s.bookings);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const serviceAlerts = useAppStore((s) => s.serviceAlerts);
  const {beginListening, executeIntent} = useVoiceAssistant();

  const [ttsCustomText, setTtsCustomText] = useState('');
  const [countdownMin, setCountdownMin] = useState(6);

  const activeBooking =
    bookings.find((b) => b.id === activeTicketId && b.status !== 'cancelled') ||
    bookings.find((b) => b.status !== 'cancelled');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownMin((m) => (m > 1 ? m - 1 : 6));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Voice-First Mode: auto-announce dashboard summary on arrival
  useEffect(() => {
    if (!profile.voiceFirstMode) return;
    const summary = activeBooking
      ? `Dashboard ready for ${profile.name}. Your next ride is bus ${activeBooking.routeNumber} at ${activeBooking.departureTime}, arriving in ${countdownMin} minutes. Double tap anywhere to speak.`
      : `Dashboard ready for ${profile.name}. Say Hey Bus or double tap anywhere to book an accessible bus.`;
    speakText(summary, {
      language: profile.language,
      rate: profile.voiceSpeed,
      muted: !profile.soundEnabled,
    });
  }, [activeBooking, countdownMin, profile.language, profile.name, profile.soundEnabled, profile.voiceFirstMode, profile.voiceSpeed]);

  const conductor = activeBooking ? getConductorById(activeBooking.conductorId) : null;
  const originStop = activeBooking ? getStopById(activeBooking.originStopId) : null;
  const destStop = activeBooking ? getStopById(activeBooking.destinationStopId) : null;

  // Screen-wide double-tap in Voice-First Mode
  let lastTap = 0;
  const handleDoubleTap = () => {
    if (!profile.voiceFirstMode) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      beginListening();
    }
    lastTap = now;
  };

  return (
    <div
      onClick={handleDoubleTap}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-8"
    >
      {/* Active Modes Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--sy-primary)]">
            Welcome, {profile.name}
            {profile.udidVerified ? ' · UDID 50% Concession Active' : ''}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            {profile.simpleMode ? 'Simple Transit Home' : 'Your Accessible Transit Hub'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--sy-text-muted)] mt-1">
            Active modes:{' '}
            {profile.needs.length > 0
              ? profile.needs.map((n) => NEED_META[n].modeBadge).join(' · ')
              : 'Standard Accessible'}
            {profile.voiceFirstMode ? ' · Double-tap anywhere to speak' : ''}
          </p>
        </div>

        <Link
          to="/onboarding"
          className="min-h-[48px] px-4 py-2.5 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] text-sm font-bold no-underline text-[var(--sy-text)] hover:border-[var(--sy-primary)]"
        >
          Edit Profile
        </Link>
      </div>

      {/* Simple Mode Giant 3-Button Experience for Cognitive / Elderly */}
      {profile.simpleMode && (
        <Card muted>
          <h2 className="text-xl font-bold mb-4">What would you like to do?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              variant="primary"
              fullWidth
              icon={<BusFront className="w-6 h-6" />}
              onClick={() => navigate('/book')}
            >
              Book a Bus
            </Button>
            <Button
              variant="secondary"
              fullWidth
              icon={<Ticket className="w-6 h-6" />}
              onClick={() => navigate('/ticket')}
            >
              Show My Ticket
            </Button>
            <Button
              variant="outline"
              fullWidth
              icon={<MapPin className="w-6 h-6" />}
              onClick={() => navigate('/track')}
            >
              Where is My Bus?
            </Button>
          </div>
        </Card>
      )}

      {/* Top Grid: Voice Orb + Next Ride Countdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-6">
          <VoiceOrb />
        </Card>

        <div className="lg:col-span-6 space-y-6">
          {/* Next Ride Card */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[var(--sy-primary)]">
                  Next Scheduled Ride
                </p>
                {activeBooking && originStop && destStop ? (
                  <>
                    <h2 className="text-2xl font-bold mt-1">
                      Bus {activeBooking.routeNumber} ·{' '}
                      <span className="font-tabular">{activeBooking.departureTime}</span>
                    </h2>
                    <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                      {originStop.name} → {destStop.name}
                    </p>
                  </>
                ) : (
                  <h2 className="text-xl font-bold mt-1">No active bus booking yet</h2>
                )}
              </div>
              {activeBooking && (
                <div className="text-right shrink-0">
                  <span className="text-2xl font-bold font-tabular text-[var(--sy-cta)]">
                    {countdownMin} min
                  </span>
                  <p className="text-xs text-[var(--sy-text-muted)]">Live ETA</p>
                </div>
              )}
            </div>

            {activeBooking && conductor ? (
              <div className="mt-5 pt-5 border-t border-[var(--sy-border)] space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={conductor.photoUrl}
                    alt={`Conductor ${conductor.name}`}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border border-[var(--sy-border)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">
                      {conductor.name} ·{' '}
                      {activeBooking.conductorAcknowledged
                        ? 'Conductor notified ✓'
                        : 'Waiting for acknowledgment'}
                    </p>
                    <p className="text-xs text-[var(--sy-text-muted)]">
                      PNR <span className="font-tabular font-bold">{activeBooking.pnr}</span> ·{' '}
                      Ramp side: {originStop?.rampSide}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="secondary"
                    fullWidth
                    icon={<Ticket className="w-5 h-5" />}
                    onClick={() => navigate(`/ticket/${activeBooking.id}`)}
                  >
                    Open Ticket
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    icon={<MapPin className="w-5 h-5" />}
                    onClick={() => navigate('/track')}
                  >
                    Live Track
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <Button
                  variant="primary"
                  fullWidth
                  icon={<BusFront className="w-5 h-5" />}
                  onClick={() => navigate('/book')}
                >
                  Book Your Next Accessible Ride
                </Button>
              </div>
            )}
          </Card>

          {/* Quick Actions + SOS */}
          <Card>
            <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <button
                type="button"
                onClick={() => navigate('/book')}
                className="min-h-[76px] p-3 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface-muted)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer hover:border-[var(--sy-primary)]"
              >
                <BusFront className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
                <span>Book Bus</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/ticket')}
                className="min-h-[76px] p-3 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface-muted)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer hover:border-[var(--sy-primary)]"
              >
                <Ticket className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
                <span>My Tickets</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/track')}
                className="min-h-[76px] p-3 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface-muted)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer hover:border-[var(--sy-primary)]"
              >
                <Clock className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
                <span>Track Bus</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/journey')}
                className="min-h-[76px] p-3 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface-muted)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold cursor-pointer hover:border-[var(--sy-primary)]"
              >
                <PhoneCall className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
                <span>In-Journey</span>
              </button>
            </div>
            <SOSButton />
          </Card>
        </div>
      </div>

      {/* Tap-to-Speak Phrase Cards (for Speech Impairment or quick touch use) */}
      {(profile.tapToSpeakMode || profile.visualMode) && (
        <Card>
          <div className="flex items-center gap-2.5 mb-2">
            <MessageSquare className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
            <h2 className="text-xl font-bold">Tap-to-Speak Communication Board</h2>
          </div>
          <p className="text-sm text-[var(--sy-text-muted)] mb-4">
            Tap any card to speak it aloud to the assistant or conductor, or type custom text to speak.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {TAP_TO_SPEAK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => {
                  speakText(phrase, {language: profile.language, rate: profile.voiceSpeed});
                  void executeIntent(phrase);
                }}
                className="min-h-[56px] p-4 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface-muted)] text-left text-sm font-bold flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--sy-primary)]"
              >
                <span>{phrase}</span>
                <Volume2 className="w-5 h-5 text-[var(--sy-primary)] shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ttsCustomText.trim()) return;
              speakText(ttsCustomText, {language: profile.language, rate: profile.voiceSpeed});
            }}
            className="flex gap-2"
          >
            <label htmlFor="tts-keyboard" className="sr-only">
              Type sentence to speak aloud
            </label>
            <input
              id="tts-keyboard"
              type="text"
              value={ttsCustomText}
              onChange={(e) => setTtsCustomText(e.target.value)}
              placeholder="Type anything to speak aloud to your conductor…"
              className="flex-1 min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
            />
            <Button type="submit" variant="secondary" icon={<Volume2 className="w-5 h-5" />}>
              Speak Aloud
            </Button>
          </form>
        </Card>
      )}

      {/* Nearby Accessible Stops & Service Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <h2 className="text-xl font-bold mb-4">Nearby Accessible Stops</h2>
          <div className="divide-y divide-[var(--sy-border)]">
            {STOPS.slice(0, 4).map((stop) => (
              <div key={stop.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-base">{stop.name}</p>
                  <p className="text-xs text-[var(--sy-text-muted)] mt-0.5">
                    {stop.distanceMeters}m away · Ramp side: {stop.rampSide} ·{' '}
                    {stop.tactilePaving ? 'Tactile paving' : 'Standard curb'} ·{' '}
                    {stop.audioBeacon ? 'Audio beacon active' : 'Visual sign'}
                  </p>
                </div>
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => {
                    useAppStore.getState().updateDraft({originStopId: stop.id});
                    navigate('/book');
                  }}
                >
                  Board Here
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <h2 className="text-xl font-bold mb-4">Live Service Alerts</h2>
          <div className="space-y-3">
            {serviceAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface-muted)]"
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-[var(--sy-saffron)] shrink-0" aria-hidden="true" />
                  <span>{alert.title}</span>
                </div>
                <p className="text-xs text-[var(--sy-text-muted)] mt-1">{alert.message}</p>
                <p className="text-xs font-tabular text-[var(--sy-text-muted)] mt-1.5">
                  {alert.routeNumber ? `Route ${alert.routeNumber} · ` : ''}
                  {alert.timestamp}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

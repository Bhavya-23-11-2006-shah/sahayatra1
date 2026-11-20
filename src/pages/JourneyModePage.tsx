import React, {useState} from 'react';
import {
  BellRing,
  MessageSquare,
  PhoneCall,
  Send,
  Volume2,
} from 'lucide-react';
import {getConductorById, getRouteById, getStopById} from '../api/client';
import {SOSButton} from '../components/SOSButton';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {useAppStore} from '../store/useAppStore';
import {triggerFeedback} from '../utils/haptics';
import {speakText} from '../utils/speech';

const QUICK_CONDUCTOR_MESSAGES = [
  'Please deploy the ramp at the next stop.',
  'I need extra time to exit safely.',
  'Could you announce the next stop?',
  'Thank you for your help!',
];

export const JourneyModePage: React.FC = () => {
  const profile = useAppStore((s) => s.profile);
  const bookings = useAppStore((s) => s.bookings);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const addToast = useAppStore((s) => s.addToast);

  const activeBooking =
    bookings.find((b) => b.id === activeTicketId && b.status !== 'cancelled') ||
    bookings[0];

  const route = getRouteById(activeBooking?.routeId || 'rt-305');
  const conductor = getConductorById(activeBooking?.conductorId || 'cond-1');
  const destStop = getStopById(activeBooking?.destinationStopId || 'stop-1');

  const [stopRequested, setStopRequested] = useState(false);
  const [customMsg, setCustomMsg] = useState('');
  const [sentMessages, setSentMessages] = useState<string[]>([]);

  const handleRequestStop = () => {
    setStopRequested(true);
    triggerFeedback('yourStop', {
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
    });
    speakText(`Stop requested for ${destStop.name}. Conductor ${conductor.name} alerted to deploy ramp.`, {
      language: profile.language,
      rate: profile.voiceSpeed,
    });
    addToast({
      type: 'success',
      title: 'Stop Requested',
      description: `Driver bell & conductor tablet alerted for ${destStop.name}.`,
    });
  };

  const sendMessageToConductor = (msg: string) => {
    if (!msg.trim()) return;
    setSentMessages((prev) => [msg, ...prev]);
    setCustomMsg('');
    triggerFeedback('tap', {
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
    });
    addToast({
      type: 'info',
      title: `Sent to Conductor ${conductor.name}`,
      description: msg,
    });
  };

  const testHapticCue = (kind: 'nextStop' | 'yourStop') => {
    triggerFeedback(kind, {
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
    });
    const text =
      kind === 'nextStop'
        ? 'Approaching Vidhana Soudha East. One stop before your destination.'
        : `Your stop is next: ${destStop.name}. Ramp will deploy on the ${destStop.rampSide} side.`;
    speakText(text, {language: profile.language, rate: profile.voiceSpeed});
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-6">
      <div>
        <p className="text-xs font-bold text-[var(--sy-primary)]">
          Simplified In-Journey Mode · Bus {route.number}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">
          Destination: {destStop.name}
        </h1>
      </div>

      {/* Giant Next Stop Banner */}
      <Card muted>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-[var(--sy-primary)]">Next Stop Ahead</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">Vidhana Soudha East</h2>
            <p className="text-sm text-[var(--sy-text-muted)] mt-1">
              Your stop ({destStop.name}) is in 2 stops · ~6 minutes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="outline" icon={<Volume2 className="w-4 h-4" />} onClick={() => testHapticCue('nextStop')}>
              1 Pulse: Next Stop
            </Button>
            <Button size="md" variant="secondary" icon={<Volume2 className="w-4 h-4" />} onClick={() => testHapticCue('yourStop')}>
              Long Pulse: Your Stop
            </Button>
          </div>
        </div>
      </Card>

      {/* Huge Request Stop Button */}
      <button
        type="button"
        onClick={handleRequestStop}
        className={`w-full min-h-[96px] rounded-3xl font-bold text-xl sm:text-2xl flex items-center justify-center gap-3 shadow-lg cursor-pointer transition-transform active:scale-[0.98] ${
          stopRequested
            ? 'bg-[var(--sy-success)] text-white'
            : 'bg-[var(--sy-cta)] text-[var(--sy-cta-ink)]'
        }`}
      >
        <BellRing className="w-8 h-8" aria-hidden="true" />
        <span>{stopRequested ? 'Stop Requested ✓ Ramp Ready' : 'REQUEST STOP'}</span>
      </button>

      {/* Call & Message Conductor (Deaf & Speech-Impaired Friendly) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Card className="md:col-span-5 flex flex-col justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={conductor.photoUrl}
              alt={`Conductor ${conductor.name}`}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover border border-[var(--sy-border)]"
            />
            <div>
              <p className="text-xs font-bold text-[var(--sy-primary)]">On-Board Conductor</p>
              <h3 className="text-lg font-bold">{conductor.name}</h3>
              <p className="text-xs font-tabular text-[var(--sy-text-muted)]">{conductor.phone}</p>
            </div>
          </div>

          <a
            href={`tel:${conductor.phone.replace(/\s+/g, '')}`}
            className="min-h-[56px] w-full rounded-2xl bg-[var(--sy-primary)] text-[var(--sy-primary-ink)] font-bold flex items-center justify-center gap-2 no-underline"
          >
            <PhoneCall className="w-5 h-5" aria-hidden="true" />
            Call Conductor
          </a>

          <SOSButton />
        </Card>

        <Card className="md:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--sy-primary)]" aria-hidden="true" />
            <h3 className="text-lg font-bold">Quick Message Conductor (Silent / Text)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {QUICK_CONDUCTOR_MESSAGES.map((msg) => (
              <button
                key={msg}
                type="button"
                onClick={() => sendMessageToConductor(msg)}
                className="min-h-[52px] p-3 rounded-2xl border-2 border-[var(--sy-border)] hover:border-[var(--sy-primary)] text-left text-xs sm:text-sm font-bold cursor-pointer"
              >
                {msg}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessageToConductor(customMsg);
            }}
            className="flex gap-2"
          >
            <label htmlFor="conductor-quick-msg" className="sr-only">
              Custom message to conductor
            </label>
            <input
              id="conductor-quick-msg"
              type="text"
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="Write a message to conductor…"
              className="flex-1 min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
            />
            <Button type="submit" variant="secondary" icon={<Send className="w-4 h-4" />}>
              Send
            </Button>
          </form>

          {sentMessages.length > 0 && (
            <div className="text-xs text-[var(--sy-success)] font-bold">
              Last sent: “{sentMessages[0]}” ✓ Delivered to conductor tablet
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

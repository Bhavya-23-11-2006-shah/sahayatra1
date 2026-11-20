import React, {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {QRCodeSVG} from 'qrcode.react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  MapPin,
  Share2,
  Volume2,
  XCircle,
} from 'lucide-react';
import {getConductorById, getStopById} from '../api/client';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {useAppStore} from '../store/useAppStore';
import {speakText} from '../utils/speech';

export const TicketPage: React.FC = () => {
  const {id} = useParams();
  const navigate = useNavigate();

  const profile = useAppStore((s) => s.profile);
  const bookings = useAppStore((s) => s.bookings);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const cancelBooking = useAppStore((s) => s.cancelBooking);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const addToast = useAppStore((s) => s.addToast);
  const adminSim = useAppStore((s) => s.adminSim);

  const ticket =
    bookings.find((b) => b.id === id) ||
    bookings.find((b) => b.id === activeTicketId) ||
    bookings[0];

  const conductor = ticket ? getConductorById(ticket.conductorId) : null;
  const originStop = ticket ? getStopById(ticket.originStopId) : null;
  const destStop = ticket ? getStopById(ticket.destinationStopId) : null;

  const isEscalated =
    Boolean(ticket?.conductorEscalated) || adminSim.simulateConductorUnacknowledged;

  const readTicketAloud = () => {
    if (!ticket || !originStop || !destStop || !conductor) return;
    const summary = `Ticket ${ticket.pnr} for Bus ${ticket.routeNumber}, vehicle ${ticket.vehicleNumber}. Boarding at ${originStop.name}, ramp side ${originStop.rampSide}, ${originStop.tactilePaving ? 'tactile paving present' : ''}. Going to ${destStop.name} at ${ticket.departureTime}. Conductor ${conductor.name} ${isEscalated ? 'has not acknowledged yet; escalating to depot control' : 'has been notified and confirmed'}.`;
    speakText(summary, {
      language: profile.language,
      rate: profile.voiceSpeed,
      muted: !profile.soundEnabled,
    });
  };

  useEffect(() => {
    if (profile.voiceFirstMode && ticket) {
      readTicketAloud();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, profile.voiceFirstMode]);

  if (!ticket || !conductor || !originStop || !destStop) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 pb-28">
        <Card>
          <h1 className="text-2xl font-bold">No active bus tickets</h1>
          <p className="text-sm text-[var(--sy-text-muted)] mt-2">
            Book an accessible bus to generate an offline-ready QR boarding pass.
          </p>
          <div className="mt-5">
            <Button variant="primary" onClick={() => navigate('/book')}>
              Book a Bus
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleAddToWallet = () => {
    const passBlob = new Blob(
      [
        JSON.stringify(
          {
            app: 'SahayYatra',
            pnr: ticket.pnr,
            bus: ticket.routeNumber,
            vehicle: ticket.vehicleNumber,
            from: originStop.name,
            to: destStop.name,
            departure: ticket.departureTime,
            rampSide: originStop.rampSide,
            conductor: conductor.name,
          },
          null,
          2,
        ),
      ],
      {type: 'application/json'},
    );
    const url = URL.createObjectURL(passBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SahayYatra-Ticket-${ticket.pnr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      title: 'Offline Wallet Pass Saved',
      description: `Ticket ${ticket.pnr} stored for zero-network boarding.`,
    });
  };

  const handleShare = async () => {
    const text = `SahayYatra Ride ${ticket.pnr}: Bus ${ticket.routeNumber} (${ticket.departureTime}) from ${originStop.name} to ${destStop.name}.`;
    if (navigator.share) {
      await navigator.share({title: 'SahayYatra Accessible Ticket', text}).catch(() => {});
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      addToast({type: 'info', title: 'Ride Details Copied', description: text});
    }
  };

  const handleCancelTicket = () => {
    cancelBooking(ticket.id);
    addToast({
      type: 'warning',
      title: `Ticket ${ticket.pnr} Cancelled`,
      description: `Full ₹${ticket.farePaidInr} refund initiated.`,
      undoLabel: 'Undo Cancel (30s)',
      onUndo: () => updateBooking(ticket.id, {status: 'confirmed'}),
      durationMs: 30000,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--sy-primary)]">
            Offline-Ready Boarding Pass · Cached Locally
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            Ticket <span className="font-tabular">{ticket.pnr}</span>
          </h1>
        </div>

        <Button
          size="md"
          variant="outline"
          icon={<Volume2 className="w-4 h-4" />}
          onClick={readTicketAloud}
        >
          Read Ticket Aloud
        </Button>
      </div>

      {/* Nearly Expired Ticket Edge Case Alert */}
      {ticket.status === 'confirmed' && (
        <div className="rounded-2xl border border-[var(--sy-saffron)] bg-[var(--sy-saffron-bg)] px-4 py-3 text-sm flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[var(--sy-saffron)] shrink-0" aria-hidden="true" />
          <span>
            Boarding window active: check in at the stop 5 minutes before departure to prevent automatic bay release.
          </span>
        </div>
      )}

      {/* Escalation Alert if Conductor unacknowledged for 5 min */}
      {isEscalated && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-[var(--sy-danger)] bg-[var(--sy-danger-bg)] p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-6 h-6 text-[var(--sy-danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold text-[var(--sy-danger)]">
              Conductor Un-acknowledged for 5 min — Escalating to Depot Control
            </p>
            <p className="text-sm mt-1">
              Depot supervisor #412 has been alerted to ensure ramp deployment on Bus {ticket.vehicleNumber}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* QR Code Card */}
        <Card className="md:col-span-5 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-3xl bg-white border-2 border-[#0B1B3A]">
            <QRCodeSVG
              value={`SAHAYYATRA|${ticket.pnr}|${ticket.routeNumber}|${ticket.vehicleNumber}|${originStop.code}`}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="font-bold text-lg font-tabular mt-4">
            Bus {ticket.routeNumber} · {ticket.departureTime}
          </p>
          <p className="text-xs text-[var(--sy-text-muted)] font-tabular mt-1">
            Vehicle {ticket.vehicleNumber} · Status: {ticket.status.toUpperCase()}
          </p>
          <p className="text-sm font-bold text-[var(--sy-success)] mt-2">
            Paid ₹{ticket.farePaidInr}{' '}
            {ticket.concessionApplied ? '(50% UDID Concession)' : ''}
          </p>
        </Card>

        {/* Stop & Conductor Card */}
        <div className="md:col-span-7 space-y-6">
          <Card>
            <h2 className="text-lg font-bold mb-3">Boarding Stop Accessibility Guide</h2>
            <p className="font-bold text-base">{originStop.name}</p>
            <p className="text-sm text-[var(--sy-text-muted)] mt-1">
              Drop-off: {destStop.name} · {ticket.travelDate}
            </p>
            <div className="mt-4 p-4 rounded-2xl bg-[var(--sy-surface-muted)] text-sm space-y-1.5">
              <p>
                <strong>Ramp side:</strong> {originStop.rampSide.toUpperCase()} door
              </p>
              <p>
                <strong>Tactile paving:</strong>{' '}
                {originStop.tactilePaving ? 'Installed along curb' : 'Standard curb'}
              </p>
              <p>
                <strong>Audio beacon:</strong>{' '}
                {originStop.audioBeacon ? 'Active at shelter' : 'Not installed'}
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <img
                src={conductor.photoUrl}
                alt={`Conductor ${conductor.name}`}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border border-[var(--sy-border)] shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--sy-success)]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isEscalated
                      ? 'Escalated to Depot Control'
                      : 'Conductor has been notified ✓'}
                  </span>
                </div>
                <h3 className="text-lg font-bold mt-0.5">{conductor.name}</h3>
                <p className="text-xs text-[var(--sy-text-muted)]">
                  Badge <span className="font-tabular">{conductor.badgeId}</span> · Languages:{' '}
                  {conductor.languages.join(', ')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Actions & Refund Policy */}
      <Card>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon={<MapPin className="w-5 h-5" />} onClick={() => navigate('/track')}>
            Live Track & Check-In
          </Button>
          <Button variant="secondary" icon={<Download className="w-5 h-5" />} onClick={handleAddToWallet}>
            Add to Wallet
          </Button>
          <Button variant="outline" icon={<Share2 className="w-5 h-5" />} onClick={() => void handleShare()}>
            Share Ride
          </Button>
          {ticket.status !== 'cancelled' && (
            <Button
              variant="danger"
              icon={<XCircle className="w-5 h-5" />}
              onClick={handleCancelTicket}
            >
              Cancel Ticket
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--sy-text-muted)] mt-4">
          <strong>Transparent Refund Policy:</strong> 100% automatic refund to your original payment method if cancelled up to 5 minutes before scheduled arrival, with a 30-second Undo window.
        </p>
      </Card>
    </div>
  );
};

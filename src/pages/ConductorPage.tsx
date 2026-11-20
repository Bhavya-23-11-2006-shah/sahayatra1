import React, {useState} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Maximize2,
  UserCheck,
  UserX,
} from 'lucide-react';
import {getStopById} from '../api/client';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {NEED_META, RampPictogram} from '../components/ui/DisabilityPictograms';
import {CONDUCTORS} from '../data/seed';
import {useAppStore} from '../store/useAppStore';

export const ConductorPage: React.FC = () => {
  const bookings = useAppStore((s) => s.bookings);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const sosAlerts = useAppStore((s) => s.sosAlerts);
  const resolveSOSAlert = useAppStore((s) => s.resolveSOSAlert);
  const conductorLoggedIn = useAppStore((s) => s.conductorLoggedIn);
  const activeConductorId = useAppStore((s) => s.activeConductorId);
  const setConductorAuth = useAppStore((s) => s.setConductorAuth);
  const addToast = useAppStore((s) => s.addToast);

  const [pin, setPin] = useState('1234');
  const [bigText, setBigText] = useState(false);

  const activeConductor =
    CONDUCTORS.find((c) => c.id === activeConductorId) || CONDUCTORS[0];
  const unresolvedSOS = sosAlerts.filter((a) => !a.resolved);
  const manifest = bookings.filter((b) => b.status !== 'cancelled');

  if (!conductorLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 pb-28">
        <Card>
          <h1 className="text-2xl font-bold">Conductor Portal Login</h1>
          <p className="text-sm text-[var(--sy-text-muted)] mt-1">
            Demo PIN is <span className="font-tabular font-bold">1234</span>.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="cond-select" className="block text-sm font-bold mb-1">
                Select Duty Conductor
              </label>
              <select
                id="cond-select"
                value={activeConductorId}
                onChange={(e) => setConductorAuth(false, e.target.value)}
                className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
              >
                {CONDUCTORS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.badgeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cond-pin" className="block text-sm font-bold mb-1">
                Duty PIN
              </label>
              <input
                id="cond-pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-tabular"
              />
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setConductorAuth(true, activeConductorId)}
            >
              Sign In to Bus Tablet
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-6 ${bigText ? 'text-lg' : ''}`}>
      {/* Conductor Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={activeConductor.photoUrl}
            alt={`Conductor ${activeConductor.name}`}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-[var(--sy-primary)]"
          />
          <div>
            <p className="text-xs font-bold text-[var(--sy-primary)]">
              Conductor Manifest · Bus KA-01-SY-1011 (Route 305-R)
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">{activeConductor.name}</h1>
            <p className="text-xs text-[var(--sy-text-muted)] font-tabular">
              Badge {activeConductor.badgeId} · Accessibility Certified
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="md"
            variant={bigText ? 'secondary' : 'outline'}
            icon={<Maximize2 className="w-4 h-4" />}
            onClick={() => setBigText((b) => !b)}
          >
            {bigText ? 'Big-Text Mode: ON' : 'Big-Text Mode'}
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => setConductorAuth(false)}
          >
            Switch Staff
          </Button>
        </div>
      </div>

      {/* Live SOS Alerts Banner */}
      {unresolvedSOS.map((sos) => (
        <div
          key={sos.id}
          role="alert"
          className="rounded-3xl border-2 border-[var(--sy-danger)] bg-[var(--sy-danger-bg)] p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-7 h-7 text-[var(--sy-danger)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold text-[var(--sy-danger)]">
                SOS ALERT · {sos.passengerName} ({sos.triggeredAt})
              </p>
              <p className="text-sm mt-1">
                Location: {sos.locationText} {sos.ticketPnr ? `· PNR ${sos.ticketPnr}` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              resolveSOSAlert(sos.id);
              addToast({type: 'success', title: 'SOS Marked Assisted'});
            }}
          >
            Confirm Assistance Sent
          </Button>
        </div>
      ))}

      {/* Upcoming PwD Passengers by Stop */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">
          Upcoming PwD Passengers ({manifest.length})
        </h2>

        {manifest.length === 0 ? (
          <Card>
            <p className="font-bold">No active PwD boarding requests on this trip yet.</p>
          </Card>
        ) : (
          manifest.map((bk) => {
            const stop = getStopById(bk.originStopId);
            const dest = getStopById(bk.destinationStopId);
            return (
              <Card key={bk.id}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5 text-sm font-bold">
                      <span className="text-[var(--sy-primary)]">
                        Boarding: {stop.name}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-tabular">{bk.departureTime}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-tabular">PNR {bk.pnr}</span>
                    </div>

                    <h3 className={bigText ? 'text-2xl font-bold' : 'text-xl font-bold'}>
                      {bk.passengerName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {bk.passengerNeeds.map((need) => (
                        <span
                          key={need}
                          className="inline-flex items-center gap-1.5 font-bold text-[var(--sy-text)]"
                        >
                          {NEED_META[need].icon}
                          <span>{NEED_META[need].label}</span>
                        </span>
                      ))}
                    </div>

                    {/* Actionable Instruction */}
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sy-cta)]">
                      <RampPictogram className="w-5 h-5" />
                      <span>
                        {bk.assistance.needRamp
                          ? `Deploy ${stop.rampSide.toUpperCase()} wheelchair ramp`
                          : bk.assistance.guideDog
                          ? 'Guide dog onboard — keep front priority bay clear'
                          : 'Priority boarding assistance requested'}
                      </span>
                    </div>

                    {bk.conductorNotes && (
                      <p className="text-sm text-[var(--sy-text-muted)]">
                        Note: “{bk.conductorNotes}”
                      </p>
                    )}

                    {/* Live Passenger Check-in Updates */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-1">
                      <span
                        className={
                          bk.atStopCheckedIn
                            ? 'text-[var(--sy-success)]'
                            : 'text-[var(--sy-text-muted)]'
                        }
                      >
                        {bk.atStopCheckedIn
                          ? '● Passenger checked in at stop ✓'
                          : '○ En route to stop'}
                      </span>
                      {bk.runningLateRequested && (
                        <span className="text-[var(--sy-saffron)]">
                          ⏱ Requested +2 min wait
                        </span>
                      )}
                      <span>Drop-off: {dest.name}</span>
                    </div>
                  </div>

                  {/* One-tap Conductor Controls */}
                  <div className="flex flex-wrap gap-2.5 shrink-0">
                    <Button
                      size="md"
                      variant={bk.conductorAcknowledged ? 'secondary' : 'primary'}
                      icon={<Check className="w-4 h-4" />}
                      onClick={() => {
                        updateBooking(bk.id, {
                          conductorAcknowledged: true,
                          conductorEscalated: false,
                        });
                        addToast({
                          type: 'success',
                          title: `Acknowledged ${bk.passengerName}`,
                          description: 'Passenger notified that ramp & priority bay are ready.',
                        });
                      }}
                    >
                      {bk.conductorAcknowledged ? 'Acknowledged ✓' : 'Acknowledge'}
                    </Button>

                    <Button
                      size="md"
                      variant={bk.status === 'boarded' ? 'secondary' : 'outline'}
                      icon={<UserCheck className="w-4 h-4" />}
                      onClick={() => {
                        updateBooking(bk.id, {status: 'boarded'});
                        addToast({
                          type: 'success',
                          title: `${bk.passengerName} Boarded`,
                        });
                      }}
                    >
                      {bk.status === 'boarded' ? 'Boarded ✓' : 'Passenger Boarded'}
                    </Button>

                    <Button
                      size="md"
                      variant="outline"
                      icon={<UserX className="w-4 h-4" />}
                      onClick={() => {
                        updateBooking(bk.id, {status: 'no-show'});
                        addToast({
                          type: 'warning',
                          title: `Marked No-Show (${bk.pnr})`,
                        });
                      }}
                    >
                      No-Show
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

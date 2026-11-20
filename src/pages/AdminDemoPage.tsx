import React from 'react';
import {useNavigate} from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {RotateCcw, ShieldAlert} from 'lucide-react';
import {sendSOSAlert} from '../api/client';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {ANALYTICS_DATA} from '../data/seed';
import {useAppStore} from '../store/useAppStore';

export const AdminDemoPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const applyDemoPreset = useAppStore((s) => s.applyDemoPreset);
  const adminSim = useAppStore((s) => s.adminSim);
  const updateAdminSim = useAppStore((s) => s.updateAdminSim);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const bookings = useAppStore((s) => s.bookings);
  const addToast = useAppStore((s) => s.addToast);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--sy-primary)]">
            Hidden Judge & Operations Simulator · Shortcut: Ctrl+Shift+D
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">
            Admin & Judge Control Panel
          </h1>
        </div>
        <Button
          variant="outline"
          icon={<RotateCcw className="w-5 h-5" />}
          onClick={() => {
            resetDemoData();
            addToast({type: 'info', title: 'Demo Data Reset to Clean Baseline'});
          }}
        >
          Reset Demo Data
        </Button>
      </div>

      {/* 10-Second Profile Switcher */}
      <Card>
        <h2 className="text-xl font-bold mb-2">10-Second Accessibility Profile Switcher</h2>
        <p className="text-sm text-[var(--sy-text-muted)] mb-4">
          Current active passenger: <strong>{profile.name}</strong> ({profile.needs.join(', ') || 'Default'})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              {key: 'blind', label: 'Blind (Voice-First)'},
              {key: 'deaf', label: 'Deaf (Visual)'},
              {key: 'wheelchair', label: 'Wheelchair'},
              {key: 'cognitive', label: 'Cognitive (Simple)'},
              {key: 'speech', label: 'Speech (Tap-Speak)'},
              {key: 'reset', label: 'Default Reset'},
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                applyDemoPreset(item.key);
                addToast({
                  type: 'success',
                  title: `Switched to ${item.label}`,
                  description: 'Opening adapted dashboard…',
                });
                navigate('/home');
              }}
              className="min-h-[56px] px-3 py-2 rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface-muted)] font-bold text-sm hover:border-[var(--sy-primary)] cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Edge-Case Simulators */}
      <Card>
        <h2 className="text-xl font-bold mb-4">Live Edge-Case & Fault Simulators</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {[
            {
              label: 'Simulate +12 min Bus Delay',
              active: adminSim.delayAllBusesMin > 0,
              toggle: () =>
                updateAdminSim({
                  delayAllBusesMin: adminSim.delayAllBusesMin > 0 ? 0 : 12,
                }),
            },
            {
              label: 'Simulate Full Wheelchair Bays (0/2)',
              active: adminSim.forceWheelchairFull,
              toggle: () =>
                updateAdminSim({forceWheelchairFull: !adminSim.forceWheelchairFull}),
            },
            {
              label: 'Bus Cancelled Mid-Booking',
              active: adminSim.simulateBusCancelledMidBooking,
              toggle: () =>
                updateAdminSim({
                  simulateBusCancelledMidBooking: !adminSim.simulateBusCancelledMidBooking,
                }),
            },
            {
              label: 'No Buses Available on Route',
              active: adminSim.simulateNoBusesRoute,
              toggle: () =>
                updateAdminSim({
                  simulateNoBusesRoute: !adminSim.simulateNoBusesRoute,
                }),
            },
            {
              label: 'Conductor Un-acknowledged (5m Escalation)',
              active: adminSim.simulateConductorUnacknowledged,
              toggle: () =>
                updateAdminSim({
                  simulateConductorUnacknowledged: !adminSim.simulateConductorUnacknowledged,
                }),
            },
            {
              label: 'Network Call Failure (Retry UI)',
              active: adminSim.simulateNetworkFailure,
              toggle: () =>
                updateAdminSim({
                  simulateNetworkFailure: !adminSim.simulateNetworkFailure,
                }),
            },
            {
              label: 'Noisy Environment ("Did you mean?")',
              active: adminSim.simulateNoisyEnvironment,
              toggle: () =>
                updateAdminSim({
                  simulateNoisyEnvironment: !adminSim.simulateNoisyEnvironment,
                }),
            },
          ].map((sim) => (
            <button
              key={sim.label}
              type="button"
              role="switch"
              aria-checked={sim.active}
              onClick={sim.toggle}
              className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-3 text-left text-sm font-bold cursor-pointer ${
                sim.active
                  ? 'border-[var(--sy-cta)] bg-[var(--sy-saffron-bg)]'
                  : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
              }`}
            >
              <span>{sim.label}</span>
              <span className="font-tabular text-xs">{sim.active ? 'ACTIVE' : 'OFF'}</span>
            </button>
          ))}
        </div>

        <Button
          variant="danger"
          icon={<ShieldAlert className="w-5 h-5" />}
          onClick={async () => {
            await sendSOSAlert(bookings[0]);
            addToast({
              type: 'error',
              title: 'Simulated SOS Triggered',
              description: 'Check Conductor Dashboard (/conductor) to see the live alert.',
            });
          }}
        >
          Trigger Simulated SOS Alert
        </Button>
      </Card>

      {/* Recharts Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <h2 className="text-xl font-bold mb-1">Weekly Accessible Rides & Wheelchair Bookings</h2>
          <p className="text-xs text-[var(--sy-text-muted)] mb-4">
            Average boarding wait time: 4.2 min · Accessible fleet utilization: 84%
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ANALYTICS_DATA.dailyRides}>
                <XAxis dataKey="day" stroke="var(--sy-text-muted)" />
                <YAxis stroke="var(--sy-text-muted)" />
                <Tooltip />
                <Bar dataKey="rides" name="Total Accessible Rides" fill="#00A3A3" radius={[8, 8, 0, 0]} />
                <Bar dataKey="wheelchair" name="Wheelchair Ramp Trips" fill="#FF7A1A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <h2 className="text-xl font-bold mb-1">Usage by Accessibility Mode</h2>
          <p className="text-xs text-[var(--sy-text-muted)] mb-4">
            Distribution across active PwD commuter profiles (%)
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ANALYTICS_DATA.modeBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={82}
                  paddingAngle={4}
                >
                  {ANALYTICS_DATA.modeBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold mt-2">
            {ANALYTICS_DATA.modeBreakdown.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{backgroundColor: m.color}} />
                <span>{m.name}: {m.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

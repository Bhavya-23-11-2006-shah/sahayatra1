import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import L from 'leaflet';
import {
  Bell,
  CheckCircle2,
  Clock,
  Navigation,
  Volume2,
} from 'lucide-react';
import {getRouteById, getStopById} from '../api/client';
import {SOSButton} from '../components/SOSButton';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {STOPS} from '../data/seed';
import {useAppStore} from '../store/useAppStore';
import {triggerFeedback} from '../utils/haptics';
import {speakText} from '../utils/speech';

export const TrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const bookings = useAppStore((s) => s.bookings);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const addToast = useAppStore((s) => s.addToast);

  const activeBooking =
    bookings.find((b) => b.id === activeTicketId && b.status !== 'cancelled') ||
    bookings[0];

  const route = getRouteById(activeBooking?.routeId || 'rt-305');
  const routeStops = useMemo(
    () => route.stopIds.map((sid) => getStopById(sid)),
    [route.stopIds],
  );

  // Mock WebSocket live progress along stops (0 -> routeStops.length - 1)
  const [busProgress, setBusProgress] = useState(1.2);
  const [twoStopsAlertDismissed, setTwoStopsAlertDismissed] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setBusProgress((prev) => {
        const next = prev + 0.08;
        return next >= routeStops.length - 1 ? 0.2 : next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [routeStops.length]);

  const currentIdx = Math.floor(busProgress);
  const frac = busProgress - currentIdx;
  const currStop = routeStops[currentIdx] || STOPS[0];
  const nextStop = routeStops[Math.min(routeStops.length - 1, currentIdx + 1)] || STOPS[1];
  const busLat = currStop.lat + (nextStop.lat - currStop.lat) * frac;
  const busLng = currStop.lng + (nextStop.lng - currStop.lng) * frac;

  const originIndex = Math.max(
    1,
    routeStops.findIndex((s) => s.id === activeBooking?.originStopId),
  );
  const stopsAway = Math.max(0, Math.ceil(originIndex - busProgress));
  const etaMin = Math.max(1, stopsAway * 3);

  // Trigger voice + vibration alert when 2 stops away
  useEffect(() => {
    if (stopsAway === 2 && !twoStopsAlertDismissed) {
      triggerFeedback('nextStop', {
        hapticsEnabled: profile.hapticsEnabled,
        soundEnabled: profile.soundEnabled,
      });
      if (profile.soundEnabled) {
        speakText(
          `Alert: Bus ${route.number} is 2 stops away, arriving in about ${etaMin} minutes.`,
          {language: profile.language, rate: profile.voiceSpeed},
        );
      }
    }
  }, [
    etaMin,
    profile.hapticsEnabled,
    profile.language,
    profile.soundEnabled,
    profile.voiceSpeed,
    route.number,
    stopsAway,
    twoStopsAlertDismissed,
  ]);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [busLat, busLng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const coords = routeStops.map((s) => [s.lat, s.lng] as [number, number]);
    L.polyline(coords, {color: '#00A3A3', weight: 6, opacity: 0.85}).addTo(map);

    routeStops.forEach((s) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: '#0B1B3A',
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 3,
      })
        .bindPopup(`<strong>${s.name}</strong><br/>Ramp: ${s.rampSide}`)
        .addTo(map);
    });

    const busMarker = L.circleMarker([busLat, busLng], {
      radius: 11,
      color: '#FFFFFF',
      fillColor: '#FF7A1A',
      fillOpacity: 1,
      weight: 3,
    })
      .bindPopup(`Bus ${route.number} · Live`)
      .addTo(map);

    mapRef.current = map;
    busMarkerRef.current = busMarker;

    return () => {
      map.remove();
      mapRef.current = null;
      busMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  // Move live bus marker smoothly
  useEffect(() => {
    if (busMarkerRef.current) {
      busMarkerRef.current.setLatLng([busLat, busLng]);
    }
  }, [busLat, busLng]);

  const handleCheckInAtStop = () => {
    if (!activeBooking) return;
    updateBooking(activeBooking.id, {atStopCheckedIn: true, status: 'checked-in'});
    triggerFeedback('success', {
      hapticsEnabled: profile.hapticsEnabled,
      soundEnabled: profile.soundEnabled,
    });
    addToast({
      type: 'success',
      title: 'Checked in at Stop',
      description: 'Conductor sees you are waiting. Wheelchair bay hold is locked.',
    });
  };

  const handleRunningLate = () => {
    if (!activeBooking) return;
    updateBooking(activeBooking.id, {runningLateRequested: true});
    addToast({
      type: 'info',
      title: 'Requested +2 Min Wait',
      description: 'Conductor notified to hold +2 minutes at stop where traffic permits.',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--sy-primary)]">
            Live GPS Telemetry · Route {route.number}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">{route.name}</h1>
        </div>
        <Button
          size="md"
          variant="outline"
          icon={<Volume2 className="w-4 h-4" />}
          onClick={() =>
            speakText(
              `Bus ${route.number} is ${stopsAway} stops away, arriving in ${etaMin} minutes near ${currStop.name}.`,
              {language: profile.language, rate: profile.voiceSpeed},
            )
          }
        >
          Speak Live ETA
        </Button>
      </div>

      {/* Flashing Visual + Voice Alert when 2 stops away */}
      {stopsAway <= 2 && !twoStopsAlertDismissed && (
        <div
          role="status"
          aria-live="assertive"
          className="rounded-3xl border-2 border-[var(--sy-cta)] bg-[var(--sy-saffron-bg)] p-5 flex flex-wrap items-center justify-between gap-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-7 h-7 text-[var(--sy-cta)] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-lg font-bold">
                Bus {route.number} is {stopsAway === 0 ? 'arriving now' : `${stopsAway} stops away`}!
              </p>
              <p className="text-sm text-[var(--sy-text-muted)]">
                Move toward the tactile boarding strip ({getStopById(activeBooking?.originStopId || 'stop-2').rampSide} ramp side).
              </p>
            </div>
          </div>
          <Button size="md" variant="outline" onClick={() => setTwoStopsAlertDismissed(true)}>
            Got it
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Leaflet Map */}
        <Card padded={false} className="lg:col-span-7 overflow-hidden min-h-[380px] relative">
          <div
            ref={mapContainerRef}
            aria-label="Live bus route map showing accessible stops and moving bus marker"
            className="w-full h-[400px] lg:h-[460px] z-10"
          />
          <div className="p-4 border-t border-[var(--sy-border)] bg-[var(--sy-surface)] flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              Current position: <strong>Near {currStop.name}</strong>
            </span>
            <span className="font-tabular text-xs text-[var(--sy-text-muted)]">
              {busLat.toFixed(4)}, {busLng.toFixed(4)}
            </span>
          </div>
        </Card>

        {/* ETA Ring, Check-in & Stops Timeline */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <div className="flex items-center gap-5">
              {/* Accessible SVG ETA Ring */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="var(--sy-border)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="var(--sy-primary)"
                    strokeWidth="10"
                    strokeDasharray={264}
                    strokeDashoffset={Math.max(20, 264 - (264 * (6 - Math.min(5, stopsAway))) / 6)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-bold font-tabular">{etaMin}m</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-[var(--sy-primary)]">Live Arrival Ring</p>
                <h2 className="text-2xl font-bold">
                  {stopsAway === 0 ? 'At your stop' : `${stopsAway} stops away`}
                </h2>
                <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                  Next: {nextStop.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <Button
                variant={activeBooking?.atStopCheckedIn ? 'secondary' : 'primary'}
                fullWidth
                icon={<CheckCircle2 className="w-5 h-5" />}
                onClick={handleCheckInAtStop}
              >
                {activeBooking?.atStopCheckedIn ? 'Checked In ✓' : "I'm at the stop"}
              </Button>
              <Button
                variant="outline"
                fullWidth
                icon={<Clock className="w-5 h-5" />}
                onClick={handleRunningLate}
              >
                {activeBooking?.runningLateRequested ? '+2 min requested ✓' : "I'm running late (+2m)"}
              </Button>
            </div>

            <div className="mt-3">
              <Button
                variant="secondary"
                fullWidth
                icon={<Navigation className="w-5 h-5" />}
                onClick={() => navigate('/journey')}
              >
                Switch to In-Journey Mode
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-bold mb-3">Accessible Stops Timeline</h3>
            <ol className="space-y-3">
              {routeStops.map((stop, idx) => {
                const passed = idx < currentIdx;
                const isHere = idx === currentIdx;
                const isUserStop = stop.id === activeBooking?.originStopId;
                return (
                  <li key={stop.id} className="flex items-start gap-3">
                    <span
                      className={`mt-1 w-4 h-4 rounded-full shrink-0 border-2 ${
                        isHere
                          ? 'bg-[var(--sy-cta)] border-[var(--sy-cta)]'
                          : passed
                          ? 'bg-[var(--sy-primary)] border-[var(--sy-primary)]'
                          : 'bg-[var(--sy-surface)] border-[var(--sy-border)]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${passed ? 'text-[var(--sy-text-muted)]' : ''}`}>
                        {stop.name}
                        {isUserStop ? ' (Your Boarding Stop)' : ''}
                        {isHere ? ' · Bus Here' : ''}
                      </p>
                      <p className="text-xs text-[var(--sy-text-muted)]">
                        Ramp: {stop.rampSide} · {stop.tactilePaving ? 'Tactile paving' : 'Standard'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <SOSButton />
        </div>
      </div>
    </div>
  );
};

import React, {useEffect, useMemo, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BellRing,
  Check,
  Clock,
  LocateFixed,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {
  createBusBooking,
  getStopById,
  joinWheelchairWaitlist,
  searchAccessibleBuses,
} from '../api/client';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {BusFeatureIcons} from '../components/ui/DisabilityPictograms';
import {Stepper} from '../components/ui/Stepper';
import {STOPS} from '../data/seed';
import {useAppStore} from '../store/useAppStore';
import type {Bus} from '../types';
import {speakText} from '../utils/speech';

export const BookingPage: React.FC = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const profile = useAppStore((s) => s.profile);
  const draft = useAppStore((s) => s.draft);
  const updateDraft = useAppStore((s) => s.updateDraft);
  const swapDraftStops = useAppStore((s) => s.swapDraftStops);
  const favorites = useAppStore((s) => s.favorites);
  const bookings = useAppStore((s) => s.bookings);
  const cancelBooking = useAppStore((s) => s.cancelBooking);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const addToast = useAppStore((s) => s.addToast);
  const adminSim = useAppStore((s) => s.adminSim);

  const initialStep = Number(searchParams.get('step') || '0');
  const [step, setStep] = useState(
    Number.isFinite(initialStep) && initialStep >= 0 && initialStep <= 2 ? initialStep : 0,
  );
  const [geoWarning, setGeoWarning] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0);

  useEffect(() => {
    const paramStep = Number(searchParams.get('step'));
    if (Number.isFinite(paramStep) && paramStep >= 0 && paramStep <= 2) {
      setStep(paramStep);
    }
  }, [searchParams]);

  const wheelchairOnly = profile.needs.includes('wheelchair');

  const {
    data: searchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'buses',
      draft.originStopId,
      draft.destinationStopId,
      draft.timePeriod,
      draft.customTime,
      wheelchairOnly,
      adminSim,
    ],
    queryFn: () =>
      searchAccessibleBuses({
        originStopId: draft.originStopId,
        destinationStopId: draft.destinationStopId,
        timePeriod: draft.timePeriod,
        customTime: draft.customTime,
        wheelchairOnly,
      }),
    retry: false,
  });

  const selectedBus = useMemo(() => {
    const all = [
      ...(searchData?.primaryBuses || []),
      ...(searchData?.earlierAlternative ? [searchData.earlierAlternative.bus] : []),
      ...(searchData?.laterAlternative ? [searchData.laterAlternative.bus] : []),
    ];
    return all.find((b) => b.id === draft.selectedBusId) || searchData?.primaryBuses[0] || null;
  }, [draft.selectedBusId, searchData]);

  // Conflicting booking time edge case
  const conflictingBooking = useMemo(
    () =>
      bookings.find(
        (b) =>
          b.status !== 'cancelled' &&
          b.travelDate === draft.travelDate &&
          selectedBus &&
          b.departureTime === selectedBus.departureTime,
      ),
    [bookings, draft.travelDate, selectedBus],
  );

  // Voice-First auto-read on step change
  useEffect(() => {
    if (!profile.voiceFirstMode) return;
    if (step === 1 && searchData?.primaryBuses.length) {
      const top = searchData.primaryBuses.slice(0, 3);
      const summary = top
        .map(
          (b, i) =>
            `Option ${i + 1}: Bus ${b.routeNumber} at ${b.departureTime}, ${b.wheelchairBaysFree} wheelchair bays free, ${profile.udidVerified ? b.concessionFareInr : b.fareInr} rupees.`,
        )
        .join(' ');
      speakText(summary, {
        language: profile.language,
        rate: profile.voiceSpeed,
        muted: !profile.soundEnabled,
      });
    }
  }, [profile.language, profile.soundEnabled, profile.udidVerified, profile.voiceFirstMode, profile.voiceSpeed, searchData, step]);

  const handleUseMyLocation = () => {
    setGeoWarning(null);
    if (!navigator.geolocation) {
      setGeoWarning('Location unavailable on this device. Selected nearest hub: MG Road Metro Gate 2.');
      updateDraft({originStopId: 'stop-2'});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        updateDraft({originStopId: 'stop-2'});
        addToast({
          type: 'info',
          title: 'Nearest Accessible Stop Selected',
          description: 'MG Road Metro Gate 2 (240m · Tactile paving & audio beacon)',
        });
      },
      () => {
        setGeoWarning(
          'Location permission was denied. Showing nearest saved hub (MG Road Metro Gate 2) — you can pick any stop manually.',
        );
        updateDraft({originStopId: 'stop-2'});
      },
      {timeout: 3500},
    );
  };

  const handleSelectBus = (bus: Bus) => {
    updateDraft({selectedBusId: bus.id});
    setBookingError(null);
    setStep(2);
  };

  const handleConfirmBooking = async () => {
    if (!selectedBus) return;
    setSubmitting(true);
    setBookingError(null);
    try {
      const created = await createBusBooking({
        bus: selectedBus,
        originStopId: draft.originStopId,
        destinationStopId: draft.destinationStopId,
        travelDate: draft.travelDate,
        assistance: draft.assistance,
        conductorNotes: draft.conductorNotes,
      });

      addToast({
        type: 'success',
        title: `Ticket ${created.pnr} Confirmed`,
        description: `Bus ${created.routeNumber} at ${created.departureTime}. Conductor notified.`,
        undoLabel: 'Undo Booking (30s)',
        onUndo: () => cancelBooking(created.id),
        durationMs: 30000,
      });

      navigate(`/ticket/${created.id}`);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Unable to confirm booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWaitlist = async (bus: Bus) => {
    try {
      const entry = await joinWheelchairWaitlist(bus, draft.originStopId, draft.destinationStopId);
      addToast({
        type: 'info',
        title: `Joined Wheelchair Bay Waitlist (${entry.routeNumber})`,
        description: `We will notify you by voice, vibration, and SMS if a bay opens on the ${entry.departureTime} bus.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Waitlist Error',
        description: err instanceof Error ? err.message : 'Please retry.',
      });
    }
  };

  const readSummaryAloud = () => {
    if (!selectedBus) return;
    const o = getStopById(draft.originStopId);
    const d = getStopById(draft.destinationStopId);
    const fare = profile.udidVerified ? selectedBus.concessionFareInr : selectedBus.fareInr;
    const text = `Summary: Bus ${selectedBus.routeNumber} from ${o.name} to ${d.name}, ${draft.travelDate} at ${selectedBus.departureTime}. Fare ${fare} rupees. Ramp assistance ${draft.assistance.needRamp ? 'requested' : 'not requested'}. Tap or slide confirm to book.`;
    speakText(text, {language: profile.language, rate: profile.voiceSpeed});
  };

  const originStop = getStopById(draft.originStopId);
  const destStop = getStopById(draft.destinationStopId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Book an Accessible Bus</h1>
        <p className="text-sm text-[var(--sy-text-muted)] mt-1">
          {profile.simpleMode
            ? '3 easy steps. One choice per screen.'
            : 'Filter ramp-ready buses, inspect wheelchair bays, and notify your conductor automatically.'}
        </p>
      </div>

      <Stepper
        steps={[t('booking.step1'), t('booking.step2'), t('booking.step3')]}
        currentStep={step}
        onStepClick={setStep}
      />

      {/* STEP 1: WHERE & WHEN */}
      {step === 0 && (
        <Card className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Where are you traveling?</h2>
            <Button
              size="md"
              variant="outline"
              icon={<LocateFixed className="w-4 h-4" />}
              onClick={handleUseMyLocation}
            >
              {t('booking.useLocation')}
            </Button>
          </div>

          {geoWarning && (
            <div
              role="alert"
              className="rounded-2xl border border-[var(--sy-saffron)] bg-[var(--sy-saffron-bg)] p-4 text-sm"
            >
              {geoWarning}
            </div>
          )}

          {/* Favorites */}
          <div>
            <p className="text-xs font-bold text-[var(--sy-text-muted)] mb-2">
              Quick Favorite Destinations
            </p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((fav) => (
                <button
                  key={fav.label}
                  type="button"
                  onClick={() => updateDraft({destinationStopId: fav.stopId})}
                  className={`min-h-[44px] px-4 py-2 rounded-2xl text-sm font-bold border-2 cursor-pointer ${
                    draft.destinationStopId === fav.stopId
                      ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)] text-[var(--sy-primary)]'
                      : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                  }`}
                >
                  {fav.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup & Dropoff */}
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
            <div className="md:col-span-5">
              <label htmlFor="pickup-stop" className="block text-sm font-bold mb-1.5">
                {t('booking.pickup')}
              </label>
              <select
                id="pickup-stop"
                value={draft.originStopId}
                onChange={(e) => updateDraft({originStopId: e.target.value})}
                className="w-full min-h-[56px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-bold"
              >
                {STOPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.area})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1 flex justify-center">
              <button
                type="button"
                onClick={swapDraftStops}
                aria-label={t('booking.swap')}
                title={t('booking.swap')}
                className="min-h-[56px] min-w-[56px] rounded-2xl border-2 border-[var(--sy-border)] hover:border-[var(--sy-primary)] flex items-center justify-center cursor-pointer"
              >
                <ArrowLeftRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="md:col-span-5">
              <label htmlFor="dropoff-stop" className="block text-sm font-bold mb-1.5">
                {t('booking.dropoff')}
              </label>
              <select
                id="dropoff-stop"
                value={draft.destinationStopId}
                onChange={(e) => updateDraft({destinationStopId: e.target.value})}
                className="w-full min-h-[56px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-bold"
              >
                {STOPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.area})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {draft.originStopId === draft.destinationStopId && (
            <p role="alert" className="text-sm font-bold text-[var(--sy-danger)]">
              Pickup and destination stops cannot be the same. Please pick a different stop.
            </p>
          )}

          {/* Date & Time Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <p className="text-sm font-bold mb-2">Travel Date</p>
              <div className="grid grid-cols-2 gap-2">
                {['Today', 'Tomorrow'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateDraft({travelDate: d})}
                    aria-pressed={draft.travelDate === d}
                    className={`min-h-[52px] rounded-2xl border-2 font-bold cursor-pointer ${
                      draft.travelDate === d
                        ? 'border-[var(--sy-primary)] bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                        : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold mb-2">{t('booking.when')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    {id: 'now', label: t('booking.now')},
                    {id: 'morning', label: `${t('booking.morning')} (9 AM)`},
                    {id: 'afternoon', label: `${t('booking.afternoon')} (2 PM)`},
                    {id: 'evening', label: `${t('booking.evening')} (6 PM)`},
                    {id: 'custom', label: t('booking.custom')},
                  ] as const
                ).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => updateDraft({timePeriod: slot.id})}
                    aria-pressed={draft.timePeriod === slot.id}
                    className={`min-h-[52px] px-3 rounded-2xl border-2 text-sm font-bold cursor-pointer ${
                      draft.timePeriod === slot.id
                        ? 'border-[var(--sy-primary)] bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                        : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
              {draft.timePeriod === 'custom' && (
                <div className="mt-3">
                  <label htmlFor="custom-time-input" className="sr-only">
                    Custom departure time
                  </label>
                  <input
                    id="custom-time-input"
                    type="time"
                    value={draft.customTime}
                    onChange={(e) => updateDraft({customTime: e.target.value})}
                    className="min-h-[48px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-tabular font-bold"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              disabled={draft.originStopId === draft.destinationStopId}
              onClick={() => setStep(1)}
              icon={<ArrowRight className="w-5 h-5" />}
            >
              {t('booking.findBuses')}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: CHOOSE BUS & SMART TIME ALTERNATIVES */}
      {step === 1 && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {originStop.name} → {destStop.name}
              </h2>
              <p className="text-sm text-[var(--sy-text-muted)]">
                {draft.travelDate} · {draft.timePeriod}
                {wheelchairOnly ? ' · Filtered for low-floor ramp buses' : ''}
              </p>
            </div>
            <Button size="md" variant="outline" onClick={() => setStep(0)} icon={<ArrowLeft className="w-4 h-4" />}>
              Change Stops
            </Button>
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="space-y-4" aria-busy="true" aria-label="Searching accessible buses">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-3xl border border-[var(--sy-border)] bg-[var(--sy-surface)] animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Failed Network Call Edge Case */}
          {isError && (
            <Card className="border-2 border-[var(--sy-danger)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--sy-danger)]">
                    Could not fetch live bus schedule
                  </h3>
                  <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                    {error instanceof Error ? error.message : 'Network error occurred.'}
                  </p>
                </div>
                <Button variant="primary" icon={<RefreshCw className="w-5 h-5" />} onClick={() => void refetch()}>
                  Retry Search
                </Button>
              </div>
            </Card>
          )}

          {/* Cancelled Mid-Booking Edge Case */}
          {searchData?.cancelledWarning && (
            <div
              role="alert"
              className="rounded-2xl border-2 border-[var(--sy-danger)] bg-[var(--sy-danger-bg)] p-4 flex items-start gap-3"
            >
              <AlertTriangle className="w-6 h-6 text-[var(--sy-danger)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Bus Cancelled Update</p>
                <p className="text-sm mt-0.5">{searchData.cancelledWarning}</p>
              </div>
            </div>
          )}

          {/* No Buses Available Edge Case */}
          {!isLoading && !isError && searchData?.primaryBuses.length === 0 && (
            <Card>
              <h3 className="text-xl font-bold">No accessible buses available on this filter right now</h3>
              <p className="text-sm text-[var(--sy-text-muted)] mt-2">
                Try another time window, disable the strict filter in Admin Simulator, or send an SMS request to 56767.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="primary" onClick={() => setStep(0)}>
                  Change Time or Stops
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    useAppStore.getState().updateAdminSim({simulateNoBusesRoute: false});
                    void refetch();
                  }}
                >
                  Show All City Corridors
                </Button>
              </div>
            </Card>
          )}

          {/* SMART TIME ALTERNATIVES STRIP */}
          {!isLoading &&
            !isError &&
            (searchData?.earlierAlternative || searchData?.laterAlternative) && (
              <Card muted>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[var(--sy-primary)]" aria-hidden="true" />
                    <h3 className="text-lg font-bold">{t('booking.closestStrip')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const e = searchData.earlierAlternative;
                      const l = searchData.laterAlternative;
                      const msg = [
                        e ? `Earlier option: Bus ${e.bus.routeNumber} at ${e.bus.departureTime}, ${e.diffMinutes} minutes earlier, because ${e.reason}.` : '',
                        l ? `Later option: Bus ${l.bus.routeNumber} at ${l.bus.departureTime}, ${l.diffMinutes} minutes later, because ${l.reason}.` : '',
                      ].join(' ');
                      speakText(msg, {language: profile.language, rate: profile.voiceSpeed});
                    }}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--sy-border)] bg-[var(--sy-surface)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                    Read Alternatives Aloud
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchData.earlierAlternative && (
                    <div className="rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface)] p-4 flex flex-col justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[var(--sy-primary)] font-tabular">
                          {searchData.earlierAlternative.diffMinutes} min earlier · Bus{' '}
                          {searchData.earlierAlternative.bus.routeNumber} at{' '}
                          {searchData.earlierAlternative.bus.departureTime}
                        </p>
                        <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                          Why: {searchData.earlierAlternative.reason}
                        </p>
                      </div>
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => handleSelectBus(searchData.earlierAlternative!.bus)}
                      >
                        Pick {searchData.earlierAlternative.bus.departureTime} Bus
                      </Button>
                    </div>
                  )}

                  {searchData.laterAlternative && (
                    <div className="rounded-2xl border border-[var(--sy-border)] bg-[var(--sy-surface)] p-4 flex flex-col justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[var(--sy-cta)] font-tabular">
                          {searchData.laterAlternative.diffMinutes} min later · Bus{' '}
                          {searchData.laterAlternative.bus.routeNumber} at{' '}
                          {searchData.laterAlternative.bus.departureTime}
                        </p>
                        <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                          Why: {searchData.laterAlternative.reason}
                        </p>
                      </div>
                      <Button
                        size="md"
                        variant="outline"
                        onClick={() => handleSelectBus(searchData.laterAlternative!.bus)}
                      >
                        Pick {searchData.laterAlternative.bus.departureTime} Bus
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

          {/* Primary Bus Results */}
          {!isLoading &&
            !isError &&
            searchData?.primaryBuses.map((bus) => {
              const fare = profile.udidVerified ? bus.concessionFareInr : bus.fareInr;
              const baysFull = bus.wheelchairBaysFree === 0;
              const isCancelled = bus.status === 'cancelled';

              return (
                <Card
                  key={bus.id}
                  className={isCancelled ? 'opacity-70 border-[var(--sy-danger)]' : ''}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                        <span className="text-xl font-bold font-tabular text-[var(--sy-text)]">
                          {bus.routeNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{bus.routeName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isCancelled
                              ? 'text-[var(--sy-danger)]'
                              : bus.status === 'delayed'
                              ? 'text-[var(--sy-saffron)]'
                              : 'text-[var(--sy-success)]'
                          }
                        >
                          {isCancelled
                            ? 'Cancelled'
                            : bus.delayMinutes > 0
                            ? `Delayed +${bus.delayMinutes} min`
                            : 'On time'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--sy-text-muted)]">
                        <span>
                          Departs <strong className="font-tabular text-[var(--sy-text)]">{bus.departureTime}</strong>
                        </span>
                        <span>
                          Live ETA <strong className="font-tabular text-[var(--sy-text)]">{bus.etaMinutes} min</strong>
                        </span>
                        <span>
                          Wheelchair bays:{' '}
                          <strong
                            className={`font-tabular ${
                              baysFull ? 'text-[var(--sy-danger)]' : 'text-[var(--sy-success)]'
                            }`}
                          >
                            {bus.wheelchairBaysFree}/{bus.wheelchairBaysTotal} free
                          </strong>
                        </span>
                        <span>
                          Crowd: <strong className="capitalize">{bus.crowdLevel}</strong>
                        </span>
                      </div>

                      <BusFeatureIcons features={bus.features} />
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3 shrink-0">
                      <div className="text-left md:text-right">
                        <p className="text-2xl font-bold font-tabular">₹{fare}</p>
                        {profile.udidVerified && (
                          <p className="text-xs text-[var(--sy-success)] font-bold">
                            50% UDID Concession (Reg. ₹{bus.fareInr})
                          </p>
                        )}
                      </div>

                      {isCancelled ? (
                        <span className="text-sm font-bold text-[var(--sy-danger)]">
                          Choose an alternative above
                        </span>
                      ) : baysFull ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="md"
                            variant="secondary"
                            icon={<BellRing className="w-4 h-4" />}
                            onClick={() => void handleWaitlist(bus)}
                          >
                            {t('booking.joinWaitlist')}
                          </Button>
                          <Button
                            size="md"
                            variant="outline"
                            onClick={() => handleSelectBus(bus)}
                          >
                            Priority Seat Only
                          </Button>
                        </div>
                      ) : (
                        <Button variant="primary" onClick={() => handleSelectBus(bus)}>
                          Select Bus
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* STEP 3: CONFIRM & SPECIAL ASSISTANCE */}
      {step === 2 && selectedBus && (
        <div className="mt-8 space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[var(--sy-primary)]">
                  Step 3 · Review & Confirm
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  Bus {selectedBus.routeNumber} ·{' '}
                  <span className="font-tabular">{selectedBus.departureTime}</span>
                </h2>
                <p className="text-sm text-[var(--sy-text-muted)] mt-1">
                  {originStop.name} → {destStop.name} · {draft.travelDate}
                </p>
              </div>
              <Button
                size="md"
                variant="outline"
                icon={<Volume2 className="w-4 h-4" />}
                onClick={readSummaryAloud}
              >
                {t('booking.readSummary')}
              </Button>
            </div>

            {conflictingBooking && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border-2 border-[var(--sy-saffron)] bg-[var(--sy-saffron-bg)] p-4 text-sm"
              >
                <strong>Conflicting Time Notice:</strong> You already have booking{' '}
                <span className="font-tabular font-bold">{conflictingBooking.pnr}</span> at{' '}
                {conflictingBooking.departureTime} on {conflictingBooking.travelDate}.
              </div>
            )}

            {bookingError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border-2 border-[var(--sy-danger)] bg-[var(--sy-danger-bg)] p-4 text-sm font-bold text-[var(--sy-danger)]"
              >
                {bookingError}
              </div>
            )}

            {/* Special Assistance Checklist */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">Special Assistance Checklist</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {key: 'needRamp' as const, label: 'Need wheelchair ramp deployed'},
                  {key: 'needBoardingHelp' as const, label: 'Need conductor help boarding'},
                  {key: 'guideDog' as const, label: 'Guide-dog traveler'},
                  {key: 'companionTraveler' as const, label: 'Companion traveling with me'},
                  {key: 'largeMobilityAid' as const, label: 'Large mobility aid / scooter'},
                ].map((item) => {
                  const checked = draft.assistance[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() =>
                        updateDraft({
                          assistance: {
                            ...draft.assistance,
                            [item.key]: !checked,
                          },
                        })
                      }
                      className={`min-h-[54px] px-4 py-3 rounded-2xl border-2 flex items-center justify-between gap-3 text-left text-sm font-bold cursor-pointer ${
                        checked
                          ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                          : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          checked
                            ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                            : 'border border-[var(--sy-border)]'
                        }`}
                      >
                        {checked && <Check className="w-4 h-4" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes for Conductor */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="conductor-notes" className="block text-sm font-bold mb-1.5">
                  Notes for Bus Conductor
                </label>
                <input
                  id="conductor-notes"
                  type="text"
                  value={draft.conductorNotes}
                  onChange={(e) => updateDraft({conductorNotes: e.target.value})}
                  placeholder="e.g., Waiting near metro gate tactile strip"
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
                />
              </div>
              <div>
                <label htmlFor="booking-ec" className="block text-sm font-bold mb-1.5">
                  Emergency Contact
                </label>
                <input
                  id="booking-ec"
                  type="text"
                  readOnly
                  value={`${profile.emergencyContactName} · ${profile.emergencyContactPhone}`}
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface-muted)] px-4 text-sm"
                />
              </div>
            </div>

            {/* Slide to Confirm + Accessible Tap Alternative */}
            <div className="mt-8 space-y-4">
              <div>
                <label htmlFor="slide-confirm-range" className="block text-sm font-bold mb-2">
                  {t('booking.slideConfirm')} (or tap button below)
                </label>
                <div className="relative rounded-2xl border-2 border-[var(--sy-cta)] bg-[var(--sy-surface-muted)] p-2">
                  <input
                    id="slide-confirm-range"
                    type="range"
                    min={0}
                    max={100}
                    value={slideProgress}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setSlideProgress(val);
                      if (val >= 95 && !submitting) {
                        void handleConfirmBooking();
                      }
                    }}
                    onMouseUp={() => {
                      if (slideProgress < 95) setSlideProgress(0);
                    }}
                    onTouchEnd={() => {
                      if (slideProgress < 95) setSlideProgress(0);
                    }}
                    aria-label="Slide fully right to confirm bus booking"
                    className="w-full h-11 accent-[var(--sy-cta)] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  icon={<ArrowLeft className="w-5 h-5" />}
                >
                  Back to Buses
                </Button>

                <Button
                  variant="primary"
                  disabled={submitting}
                  onClick={() => void handleConfirmBooking()}
                  icon={<Check className="w-5 h-5" />}
                >
                  {submitting
                    ? 'Confirming…'
                    : `${t('booking.tapConfirm')} · ₹${
                        profile.udidVerified
                          ? selectedBus.concessionFareInr
                          : selectedBus.fareInr
                      }`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

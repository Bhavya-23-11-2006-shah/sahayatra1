import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowLeft, ArrowRight, BadgeCheck, Check, Shield, Volume2} from 'lucide-react';
import {verifyUdidNumber} from '../api/client';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {NEED_META} from '../components/ui/DisabilityPictograms';
import {Stepper} from '../components/ui/Stepper';
import {useAppStore} from '../store/useAppStore';
import type {AppLanguage, DisabilityNeed} from '../types';
import {speakText} from '../utils/speech';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const toggleNeed = useAppStore((s) => s.toggleNeed);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const addToast = useAppStore((s) => s.addToast);

  const [step, setStep] = useState(0);
  const [udidInput, setUdidInput] = useState(profile.udidNumber || '');
  const [verifying, setVerifying] = useState(false);
  const [udidFeedback, setUdidFeedback] = useState<string | null>(
    profile.udidVerified ? 'Verified: 50% Govt PwD Concession Active' : null,
  );

  const steps = ['Language', 'Your Needs', 'UDID & Contact', 'Privacy'];

  const handleVerifyUdid = async () => {
    setVerifying(true);
    try {
      const res = await verifyUdidNumber(udidInput);
      if (res.valid) {
        updateProfile({udidNumber: udidInput.toUpperCase(), udidVerified: true});
        setUdidFeedback(res.holderType);
        addToast({type: 'success', title: 'UDID Verified', description: res.holderType});
      } else {
        updateProfile({udidVerified: false});
        setUdidFeedback('Could not verify. Enter at least 6 characters (e.g., UDID-KA-2025-19034).');
      }
    } catch (err) {
      setUdidFeedback(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const finishOnboarding = () => {
    updateProfile({onboardingCompleted: true});
    addToast({
      type: 'success',
      title: 'Accessibility Profile Saved',
      description: 'SahayYatra is now tailored to your needs.',
    });
    navigate('/home');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Personalize SahayYatra</h1>
        <p className="text-[var(--sy-text-muted)] mt-1">
          Configure once—your modes combine automatically and can be adjusted anytime via Alt+A.
        </p>
      </div>

      <Stepper steps={steps} currentStep={step} onStepClick={setStep} />

      <div className="mt-8">
        {step === 0 && (
          <Card>
            <h2 className="text-xl font-bold mb-2">1. Choose your preferred language</h2>
            <p className="text-sm text-[var(--sy-text-muted)] mb-6">
              Both screen text and the Hey Bus voice assistant will speak in this language.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  {id: 'en', name: 'English', sample: 'Every journey, for everyone.'},
                  {id: 'hi', name: 'हिन्दी (Hindi)', sample: 'हर यात्रा, सबके लिए।'},
                  {id: 'bn', name: 'বাংলা (Bengali)', sample: 'প্রতিটি যাত্রা, সবার জন্য।'},
                ] as Array<{id: AppLanguage; name: string; sample: string}>
              ).map((lang) => {
                const selected = profile.language === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.id);
                      speakText(lang.sample, {language: lang.id, rate: profile.voiceSpeed});
                    }}
                    aria-pressed={selected}
                    className={`min-h-[112px] p-5 rounded-3xl border-2 text-left flex flex-col justify-between cursor-pointer ${
                      selected
                        ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                        : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-bold">{lang.name}</span>
                      {selected && <Check className="w-5 h-5 text-[var(--sy-primary)]" />}
                    </div>
                    <span className="text-sm text-[var(--sy-text-muted)] mt-2">{lang.sample}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <h2 className="text-xl font-bold mb-2">2. Select all accessibility modes you need</h2>
            <p className="text-sm text-[var(--sy-text-muted)] mb-6">
              Multi-select supported—if you select more than one, SahayYatra merges them seamlessly.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(NEED_META) as DisabilityNeed[]).map((need) => {
                const meta = NEED_META[need];
                const selected = profile.needs.includes(need);
                return (
                  <div
                    key={need}
                    className={`rounded-3xl border-2 p-5 flex flex-col justify-between gap-4 ${
                      selected
                        ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                        : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleNeed(need)}
                      aria-pressed={selected}
                      className="text-left w-full cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2.5 text-[var(--sy-primary)] font-bold">
                          {meta.icon}
                          <span className="text-lg text-[var(--sy-text)]">{meta.label}</span>
                        </span>
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                            selected
                              ? 'bg-[var(--sy-primary)] border-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                              : 'border-[var(--sy-border)]'
                          }`}
                        >
                          {selected && <Check className="w-4 h-4" aria-hidden="true" />}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--sy-text-muted)] mt-2 leading-relaxed">
                        {meta.description}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        speakText(`${meta.label}. ${meta.description}`, {
                          language: profile.language,
                          rate: profile.voiceSpeed,
                        })
                      }
                      className="min-h-[44px] px-3 py-1.5 rounded-xl border border-[var(--sy-border)] text-xs font-bold inline-flex items-center gap-1.5 self-start cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4" aria-hidden="true" />
                      Listen to description
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h2 className="text-xl font-bold mb-2">3. Concession Card (UDID) & Emergency Contact</h2>
            <p className="text-sm text-[var(--sy-text-muted)] mb-6">
              Optional—verify your Unique Disability ID to apply the 50% government bus fare concession automatically.
            </p>

            <div className="space-y-5">
              <div>
                <label htmlFor="onb-name" className="block text-sm font-bold mb-1.5">
                  Passenger Name
                </label>
                <input
                  id="onb-name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => updateProfile({name: e.target.value})}
                  className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
                />
              </div>

              <div>
                <label htmlFor="onb-udid" className="block text-sm font-bold mb-1.5">
                  UDID Number (Optional)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    id="onb-udid"
                    type="text"
                    value={udidInput}
                    onChange={(e) => setUdidInput(e.target.value)}
                    placeholder="e.g., UDID-KA-2025-19034"
                    className="flex-1 min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-tabular"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void handleVerifyUdid()}
                    disabled={verifying}
                    icon={<BadgeCheck className="w-5 h-5" />}
                  >
                    {verifying ? 'Verifying…' : 'Verify UDID'}
                  </Button>
                </div>
                {udidFeedback && (
                  <p className="text-sm font-bold text-[var(--sy-success)] mt-2">
                    {udidFeedback}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="onb-ec-name" className="block text-sm font-bold mb-1.5">
                    Emergency Contact Name
                  </label>
                  <input
                    id="onb-ec-name"
                    type="text"
                    value={profile.emergencyContactName}
                    onChange={(e) => updateProfile({emergencyContactName: e.target.value})}
                    className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
                  />
                </div>
                <div>
                  <label htmlFor="onb-ec-phone" className="block text-sm font-bold mb-1.5">
                    Emergency Contact Phone
                  </label>
                  <input
                    id="onb-ec-phone"
                    type="tel"
                    value={profile.emergencyContactPhone}
                    onChange={(e) => updateProfile({emergencyContactPhone: e.target.value})}
                    className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-tabular"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6 text-[var(--sy-primary)]" aria-hidden="true" />
              <h2 className="text-xl font-bold">4. Plain-Language Privacy Choices</h2>
            </div>
            <p className="text-sm text-[var(--sy-text-muted)] mb-6">
              You control exactly what conductors and buses see. You can export or delete your data anytime in Settings.
            </p>

            <div className="space-y-3">
              {[
                {
                  key: 'shareNeedWithConductor' as const,
                  title: 'Share my accessibility need with my bus conductor',
                  desc: 'Lets the conductor prepare the ramp or audio guidance before your stop.',
                },
                {
                  key: 'shareLiveLocation' as const,
                  title: 'Share live stop check-in location during active rides',
                  desc: 'Used only when you tap "I am at the stop" or trigger SOS.',
                },
                {
                  key: 'saveFrequentStops' as const,
                  title: 'Save favorite stops on this device',
                  desc: 'Stored locally in your browser so you can book Home or Hospital in one tap.',
                },
                {
                  key: 'smsFallbackAlerts' as const,
                  title: 'Send SMS backup alerts if mobile internet drops',
                  desc: 'Sends plain-text bus ETA updates to your phone when offline.',
                },
              ].map((item) => {
                const enabled = profile.privacyConsent[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() =>
                      updateProfile({
                        privacyConsent: {
                          ...profile.privacyConsent,
                          [item.key]: !enabled,
                        },
                      })
                    }
                    className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between gap-4 text-left cursor-pointer ${
                      enabled
                        ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                        : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm sm:text-base">{item.title}</p>
                      <p className="text-xs sm:text-sm text-[var(--sy-text-muted)] mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${
                        enabled
                          ? 'bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                          : 'bg-black/10 text-[var(--sy-text-muted)]'
                      }`}
                    >
                      {enabled ? 'YES' : 'NO'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Back
        </Button>

        {step < steps.length - 1 ? (
          <Button
            variant="primary"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            icon={<ArrowRight className="w-5 h-5" />}
          >
            Next Step
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={finishOnboarding}
            icon={<Check className="w-5 h-5" />}
          >
            Save & Open Dashboard
          </Button>
        )}
      </div>
    </div>
  );
};

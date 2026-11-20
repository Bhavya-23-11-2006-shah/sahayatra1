import React, {useState} from 'react';
import {Download, Trash2} from 'lucide-react';
import {PWAInstallButton} from '../components/PWAInstallButton';
import {Button} from '../components/ui/Button';
import {Card} from '../components/ui/Card';
import {Modal} from '../components/ui/Modal';
import {useAppStore} from '../store/useAppStore';
import type {AppLanguage} from '../types';

export const SettingsPage: React.FC = () => {
  const profile = useAppStore((s) => s.profile);
  const bookings = useAppStore((s) => s.bookings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const addToast = useAppStore((s) => s.addToast);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleExportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      profile,
      bookings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sahayyatra-my-data.json';
    a.click();
    URL.revokeObjectURL(url);
    addToast({type: 'success', title: 'Personal Data Exported (JSON)'});
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings & Privacy</h1>
          <p className="text-sm text-[var(--sy-text-muted)] mt-1">
            Manage language, notification alerts, emergency contacts, and local data.
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Language */}
      <Card>
        <h2 className="text-xl font-bold mb-3">Language</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              {id: 'en', label: 'English'},
              {id: 'hi', label: 'हिन्दी (Hindi)'},
              {id: 'bn', label: 'বাংলা (Bengali)'},
            ] as Array<{id: AppLanguage; label: string}>
          ).map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setLanguage(lang.id)}
              aria-pressed={profile.language === lang.id}
              className={`min-h-[52px] rounded-2xl border-2 font-bold cursor-pointer ${
                profile.language === lang.id
                  ? 'border-[var(--sy-primary)] bg-[var(--sy-primary)] text-[var(--sy-primary-ink)]'
                  : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card>
        <h2 className="text-xl font-bold mb-3">Notification Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {key: 'push', label: 'Push & Visual Banners'},
              {key: 'sms', label: 'SMS Backup Alerts'},
              {key: 'vibration', label: 'Vibration Stop Cues'},
              {key: 'voice', label: 'Voice Stop Announcements'},
            ] as const
          ).map((n) => {
            const on = profile.notifications[n.key];
            return (
              <button
                key={n.key}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() =>
                  updateProfile({
                    notifications: {...profile.notifications, [n.key]: !on},
                  })
                }
                className={`min-h-[52px] px-4 rounded-2xl border-2 flex items-center justify-between font-bold text-sm cursor-pointer ${
                  on
                    ? 'border-[var(--sy-primary)] bg-[var(--sy-surface-muted)]'
                    : 'border-[var(--sy-border)] bg-[var(--sy-surface)]'
                }`}
              >
                <span>{n.label}</span>
                <span>{on ? 'ON' : 'OFF'}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <h2 className="text-xl font-bold mb-3">Emergency Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-ec-name" className="block text-sm font-bold mb-1">
              Contact Name
            </label>
            <input
              id="set-ec-name"
              type="text"
              value={profile.emergencyContactName}
              onChange={(e) => updateProfile({emergencyContactName: e.target.value})}
              className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4"
            />
          </div>
          <div>
            <label htmlFor="set-ec-phone" className="block text-sm font-bold mb-1">
              Contact Phone
            </label>
            <input
              id="set-ec-phone"
              type="tel"
              value={profile.emergencyContactPhone}
              onChange={(e) => updateProfile({emergencyContactPhone: e.target.value})}
              className="w-full min-h-[52px] rounded-2xl border-2 border-[var(--sy-border)] bg-[var(--sy-surface)] px-4 font-tabular"
            />
          </div>
        </div>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <h2 className="text-xl font-bold mb-2">Data & Privacy Controls</h2>
        <p className="text-sm text-[var(--sy-text-muted)] mb-4">
          Your accessibility profile and offline tickets live locally on your device.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon={<Download className="w-5 h-5" />} onClick={handleExportData}>
            Export My Data (JSON)
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 className="w-5 h-5" />}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Delete My Data
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete all local SahayYatra data?"
        description="This clears your saved preferences, UDID badge, and ticket history from this browser."
      >
        <div className="flex flex-wrap gap-3 justify-end">
          <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              resetDemoData();
              setConfirmDeleteOpen(false);
              addToast({type: 'info', title: 'Local Data Cleared'});
            }}
          >
            Confirm Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};

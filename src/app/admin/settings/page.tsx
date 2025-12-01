'use client';

import { useEffect, useState } from 'react';

interface Settings {
  id: string;
  autoConfirmRsvp: boolean;
  timezone: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading settings:', err);
        setIsLoading(false);
      });
  }, []);

  const handleToggleAutoConfirm = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoConfirmRsvp: !settings.autoConfirmRsvp,
        }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">General Settings</h1>
        <p className="text-gray-600 mt-1">Configure organization-wide settings</p>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
        {/* Auto-Confirm RSVP */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Auto-Confirm RSVPs
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                When enabled, volunteer signups are automatically confirmed without
                coordinator approval. Volunteers will receive a confirmation email
                with a calendar invite immediately upon signing up.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                When disabled, signups remain in &quot;Pending&quot; status until a
                coordinator manually confirms them.
              </p>
            </div>
            <div className="ml-6">
              <button
                onClick={handleToggleAutoConfirm}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings?.autoConfirmRsvp ? 'bg-teal-600' : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings?.autoConfirmRsvp ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                settings?.autoConfirmRsvp
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {settings?.autoConfirmRsvp ? 'Auto-Confirm Enabled' : 'Manual Approval Required'}
            </span>
          </div>
        </div>

        {/* Timezone (future setting) */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Timezone
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Organization timezone for displaying shift times and scheduling.
              </p>
            </div>
            <div className="ml-6">
              <select
                value={settings?.timezone || 'America/New_York'}
                disabled
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
              </select>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs text-gray-400">
              Timezone configuration coming soon
            </span>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-blue-400">ℹ️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              About RSVP Settings
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                <strong>Auto-Confirm enabled:</strong> Volunteers are immediately confirmed
                when they sign up, receiving a confirmation email with calendar invite.
                Good for organizations that want a streamlined signup process.
              </p>
              <p className="mt-2">
                <strong>Manual Approval:</strong> Volunteer signups stay in &quot;Pending&quot;
                status until a coordinator reviews and confirms them. Good for organizations
                that need to vet or balance volunteer assignments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

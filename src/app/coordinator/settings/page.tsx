'use client';

import { useEffect, useState } from 'react';

interface Settings {
  id: string;
  // Dispatcher scheduling mode
  dispatcherSchedulingMode: 'REGIONAL' | 'COUNTY' | 'ZONE';
  // Volunteer scheduling mode
  schedulingMode: 'SIMPLE' | 'FULL';
}

export default function CoordinatorSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/coordinator/settings')
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

  const handleUpdateDispatcherMode = async (mode: 'REGIONAL' | 'COUNTY' | 'ZONE') => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/coordinator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispatcherSchedulingMode: mode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Dispatcher scheduling mode updated' });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSchedulingMode = async (mode: 'SIMPLE' | 'FULL') => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/coordinator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedulingMode: mode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Scheduling mode updated' });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule Settings</h1>
        <p className="text-gray-600 mt-1">Configure how the weekly schedule is displayed and managed</p>
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
        {/* Dispatcher Scheduling Mode */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Dispatcher Scheduling Mode
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Controls how dispatchers are assigned on the schedule grid. Choose based on
                your current activity level.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="dispatcherMode"
                value="REGIONAL"
                checked={settings?.dispatcherSchedulingMode === 'REGIONAL'}
                onChange={() => handleUpdateDispatcherMode('REGIONAL')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500"
              />
              <div>
                <span className="font-medium text-gray-900">Regional</span>
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Low Activity
                </span>
                <p className="text-sm text-gray-500 mt-0.5">
                  One dispatcher covers all counties per time block. Best for slow weeks.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="dispatcherMode"
                value="COUNTY"
                checked={settings?.dispatcherSchedulingMode === 'COUNTY'}
                onChange={() => handleUpdateDispatcherMode('COUNTY')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500"
              />
              <div>
                <span className="font-medium text-gray-900">County</span>
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  Medium Activity
                </span>
                <p className="text-sm text-gray-500 mt-0.5">
                  One dispatcher per county. Dispatchers handle all time blocks in their county.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="dispatcherMode"
                value="ZONE"
                checked={settings?.dispatcherSchedulingMode === 'ZONE'}
                onChange={() => handleUpdateDispatcherMode('ZONE')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500"
              />
              <div>
                <span className="font-medium text-gray-900">Zone</span>
                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  High Activity
                </span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Dispatcher per county + time block. Maximum coverage for busy weeks.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Volunteer Scheduling Mode */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Volunteer Scheduling Mode
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Controls visibility of volunteer information on the schedule and who can see available shifts.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="schedulingMode"
                value="SIMPLE"
                checked={settings?.schedulingMode === 'SIMPLE'}
                onChange={() => handleUpdateSchedulingMode('SIMPLE')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500"
              />
              <div>
                <span className="font-medium text-gray-900">Simple - Leaders Only</span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Hide volunteer counts on schedule. Only show Regional Lead, Dispatcher, and Zone Lead roles.
                  Non-qualified users cannot see or sign up for shifts.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="schedulingMode"
                value="FULL"
                checked={settings?.schedulingMode === 'FULL'}
                onChange={() => handleUpdateSchedulingMode('FULL')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 text-cyan-600 border-gray-300 focus:ring-cyan-500"
              />
              <div>
                <span className="font-medium text-gray-900">Full - All Volunteers</span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Show volunteer counts on schedule. All volunteers can see and sign up for available shifts.
                </p>
              </div>
            </label>
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
              About Scheduling Modes
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                <strong>Dispatcher Mode</strong> determines how dispatcher coverage is shown on the schedule grid.
                Choose Regional for slow periods, County for moderate activity, and Zone for high activity weeks.
              </p>
              <p className="mt-2">
                <strong>Volunteer Mode</strong> controls who can see and sign up for shifts.
                Simple mode restricts visibility to coordinators and qualified leads, while Full mode allows all volunteers to browse and sign up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

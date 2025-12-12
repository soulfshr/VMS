'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  id: string;
  dispatcherSchedulingMode: 'REGIONAL' | 'COUNTY' | 'ZONE';
  schedulingMode: 'SIMPLE' | 'FULL';
  autoConfirmRsvp: boolean;
}

export default function SettingsSchedulingPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/coordinator/settings').then(res => res.json()),
    ])
      .then(([sessionData, settingsData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        // Check access
        if (!['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(sessionData.user.role)) {
          router.push('/settings/profile');
          return;
        }
        setUserRole(sessionData.user.role);
        setSettings(settingsData);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading settings:', err);
        setIsLoading(false);
      });
  }, [router]);

  const handleUpdateDispatcherMode = async (mode: 'REGIONAL' | 'COUNTY' | 'ZONE') => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/coordinator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatcherSchedulingMode: mode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Dispatcher scheduling mode updated' });
    } catch (err) {
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
        body: JSON.stringify({ schedulingMode: mode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Scheduling mode updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoConfirm = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoConfirmRsvp: !settings.autoConfirmRsvp }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(prev => prev ? { ...prev, autoConfirmRsvp: updated.autoConfirmRsvp } : null);
      setMessage({ type: 'success', text: 'Auto-confirm setting updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isAdmin = ['ADMINISTRATOR', 'DEVELOPER'].includes(userRole);

  return (
    <div className="divide-y divide-gray-200">
      {/* Header */}
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">Scheduling Settings</h2>
        <p className="text-gray-600 mt-1">Configure how the weekly schedule is displayed and managed</p>
      </div>

      {message && (
        <div className={`mx-6 my-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Dispatcher Scheduling Mode */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Dispatcher Scheduling Mode</h3>
        <p className="text-sm text-gray-600 mb-4">
          Controls how dispatchers are assigned on the schedule grid. Choose based on your current activity level.
        </p>
        <div className="space-y-3">
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
        <h3 className="font-semibold text-gray-900 mb-2">Volunteer Scheduling Mode</h3>
        <p className="text-sm text-gray-600 mb-4">
          Controls visibility of volunteer information on the schedule and who can see available shifts.
        </p>
        <div className="space-y-3">
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
                Hide volunteer counts on schedule. Only show Dispatch Coordinator, Dispatcher, and Zone Lead roles.
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

      {/* Auto-Confirm RSVPs - Only for Admins */}
      {isAdmin && (
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Auto-Confirm RSVPs</h3>
              <p className="text-sm text-gray-600 mt-1 max-w-lg">
                When enabled, volunteer signups are automatically confirmed without coordinator approval.
              </p>
            </div>
            <button
              onClick={handleToggleAutoConfirm}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings?.autoConfirmRsvp ? 'bg-cyan-600' : 'bg-gray-200'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings?.autoConfirmRsvp ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              settings?.autoConfirmRsvp
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {settings?.autoConfirmRsvp ? 'Auto-Confirm Enabled' : 'Manual Approval Required'}
            </span>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-6 bg-blue-50">
        <div className="flex gap-3">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Scheduling Modes</p>
            <p>
              <strong>Dispatcher Mode</strong> determines how dispatcher coverage is shown on the schedule grid.
            </p>
            <p className="mt-1">
              <strong>Volunteer Mode</strong> controls who can see and sign up for shifts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

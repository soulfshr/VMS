'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  id: string;
  orgName: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  emailFooter: string;
  maxUploadSizeMb: number;
  maxUploadsPerReport: number;
  weeklyDigestEnabled: boolean;
  weeklyDigestSendHour: number;
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

export default function SettingsOrganizationPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local state for text inputs
  const [localOrgName, setLocalOrgName] = useState('');
  const [localEmailFromName, setLocalEmailFromName] = useState('');
  const [localEmailFromAddress, setLocalEmailFromAddress] = useState('');
  const [localEmailReplyTo, setLocalEmailReplyTo] = useState('');
  const [localEmailFooter, setLocalEmailFooter] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/admin/settings').then(res => res.json()),
    ])
      .then(([sessionData, settingsData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        if (!['ADMINISTRATOR', 'DEVELOPER'].includes(sessionData.user.role)) {
          router.push('/settings/profile');
          return;
        }
        setSettings(settingsData);
        setLocalOrgName(settingsData.orgName || '');
        setLocalEmailFromName(settingsData.emailFromName || '');
        const localPart = settingsData.emailFromAddress?.replace(/@ripple-vms\.com$/, '') || '';
        setLocalEmailFromAddress(localPart);
        setLocalEmailReplyTo(settingsData.emailReplyTo || '');
        setLocalEmailFooter(settingsData.emailFooter || '');
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading settings:', err);
        setIsLoading(false);
      });
  }, [router]);

  const handleUpdateBranding = async (field: string, value: string) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Settings updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWeeklyDigest = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyDigestEnabled: !settings.weeklyDigestEnabled }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Weekly digest setting updated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDigestHour = async (hour: number) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyDigestSendHour: hour }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: `Digest will send at ${formatHour(hour)} ET` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUploadSettings = async (field: string, value: number) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Upload settings updated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
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

  return (
    <div className="divide-y divide-gray-200">
      {/* Header */}
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">Organization Settings</h2>
        <p className="text-gray-600 mt-1">Configure organization-wide settings and email branding</p>
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

      {/* Email Branding */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Email Branding</h3>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={localOrgName}
              onChange={(e) => setLocalOrgName(e.target.value)}
              onBlur={() => {
                if (localOrgName !== settings?.orgName) {
                  handleUpdateBranding('orgName', localOrgName);
                }
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Siembra NC"
            />
            <p className="text-xs text-gray-500 mt-1">Used in email subject lines and body text</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              value={localEmailFromName}
              onChange={(e) => setLocalEmailFromName(e.target.value)}
              onBlur={() => {
                if (localEmailFromName !== settings?.emailFromName) {
                  handleUpdateBranding('emailFromName', localEmailFromName);
                }
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Siembra NC"
            />
            <p className="text-xs text-gray-500 mt-1">Appears in the From field of emails</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
            <div className="flex">
              <input
                type="text"
                value={localEmailFromAddress}
                onChange={(e) => {
                  const localPart = e.target.value.replace(/[^a-zA-Z0-9._-]/g, '');
                  setLocalEmailFromAddress(localPart);
                }}
                onBlur={() => {
                  const fullEmail = localEmailFromAddress ? `${localEmailFromAddress}@ripple-vms.com` : '';
                  if (fullEmail !== settings?.emailFromAddress) {
                    handleUpdateBranding('emailFromAddress', fullEmail);
                  }
                }}
                disabled={isSaving}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="noreply"
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                @ripple-vms.com
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Address</label>
            <input
              type="email"
              value={localEmailReplyTo}
              onChange={(e) => setLocalEmailReplyTo(e.target.value)}
              onBlur={() => {
                if (localEmailReplyTo !== settings?.emailReplyTo) {
                  handleUpdateBranding('emailReplyTo', localEmailReplyTo);
                }
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="contact@siembranc.org"
            />
            <p className="text-xs text-gray-500 mt-1">Where email replies are sent</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer Team Name</label>
            <input
              type="text"
              value={localEmailFooter}
              onChange={(e) => setLocalEmailFooter(e.target.value)}
              onBlur={() => {
                if (localEmailFooter !== settings?.emailFooter) {
                  handleUpdateBranding('emailFooter', localEmailFooter);
                }
              }}
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="The Siembra NC Team"
            />
          </div>
        </div>
      </div>

      {/* Weekly Digest */}
      <div className="p-6">
        <div className="flex items-start justify-between max-w-lg">
          <div>
            <h3 className="font-semibold text-gray-900">Weekly Schedule Digest</h3>
            <p className="text-sm text-gray-600 mt-1">
              Send a weekly email every Sunday with the upcoming week&apos;s schedule.
            </p>
          </div>
          <button
            onClick={handleToggleWeeklyDigest}
            disabled={isSaving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings?.weeklyDigestEnabled ? 'bg-cyan-600' : 'bg-gray-200'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings?.weeklyDigestEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {settings?.weeklyDigestEnabled && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-gray-600">Send at:</span>
            <select
              value={settings?.weeklyDigestSendHour ?? 18}
              onChange={(e) => handleUpdateDigestHour(parseInt(e.target.value))}
              disabled={isSaving}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value={8}>8:00 AM ET</option>
              <option value={10}>10:00 AM ET</option>
              <option value={12}>12:00 PM ET</option>
              <option value={16}>4:00 PM ET</option>
              <option value={18}>6:00 PM ET</option>
              <option value={20}>8:00 PM ET</option>
            </select>
          </div>
        )}
      </div>

      {/* File Upload Settings */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">ICE Sighting Report Settings</h3>
        <div className="space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-900">Max File Size</label>
              <p className="text-xs text-gray-500">Per file upload limit</p>
            </div>
            <select
              value={settings?.maxUploadSizeMb || 50}
              onChange={(e) => handleUpdateUploadSettings('maxUploadSizeMb', parseInt(e.target.value))}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={10}>10 MB</option>
              <option value={25}>25 MB</option>
              <option value={50}>50 MB</option>
              <option value={75}>75 MB</option>
              <option value={100}>100 MB</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-900">Max Files Per Report</label>
              <p className="text-xs text-gray-500">Photos and videos combined</p>
            </div>
            <select
              value={settings?.maxUploadsPerReport || 5}
              onChange={(e) => handleUpdateUploadSettings('maxUploadsPerReport', parseInt(e.target.value))}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value={3}>3 files</option>
              <option value={5}>5 files</option>
              <option value={10}>10 files</option>
              <option value={15}>15 files</option>
              <option value={20}>20 files</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

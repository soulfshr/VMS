'use client';

import { useEffect, useState } from 'react';

interface Settings {
  id: string;
  autoConfirmRsvp: boolean;
  timezone: string;
  maxUploadSizeMb: number;
  maxUploadsPerReport: number;
  // Branding settings
  orgName: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  emailFooter: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local state for text inputs to prevent cursor jumping
  const [localOrgName, setLocalOrgName] = useState('');
  const [localEmailFromName, setLocalEmailFromName] = useState('');
  const [localEmailFromAddress, setLocalEmailFromAddress] = useState('');
  const [localEmailReplyTo, setLocalEmailReplyTo] = useState('');
  const [localEmailFooter, setLocalEmailFooter] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        // Initialize local state for branding fields
        setLocalOrgName(data.orgName || '');
        setLocalEmailFromName(data.emailFromName || '');
        const localPart = data.emailFromAddress?.replace(/@ripple-vms\.com$/, '') || '';
        setLocalEmailFromAddress(localPart);
        setLocalEmailReplyTo(data.emailReplyTo || '');
        setLocalEmailFooter(data.emailFooter || '');
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

  const handleUpdateUploadSettings = async (field: 'maxUploadSizeMb' | 'maxUploadsPerReport', value: number) => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Upload settings updated successfully' });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBranding = async (field: 'orgName' | 'emailFromName' | 'emailFromAddress' | 'emailReplyTo' | 'emailFooter', value: string) => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Branding settings updated successfully' });
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

      {/* ICE Sighting Upload Settings */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">ICE Sighting Report Settings</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
          {/* Max Upload Size */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Maximum File Upload Size
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  The maximum file size (in MB) allowed for photo and video uploads
                  in ICE sighting reports. Applies to each individual file.
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
                <select
                  value={settings?.maxUploadSizeMb || 50}
                  onChange={(e) => handleUpdateUploadSettings('maxUploadSizeMb', parseInt(e.target.value))}
                  disabled={isSaving}
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                >
                  <option value={10}>10 MB</option>
                  <option value={25}>25 MB</option>
                  <option value={50}>50 MB</option>
                  <option value={75}>75 MB</option>
                  <option value={100}>100 MB</option>
                </select>
              </div>
            </div>
          </div>

          {/* Max Uploads Per Report */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Maximum Files Per Report
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  The maximum number of photos and videos that can be uploaded
                  with a single ICE sighting report.
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
                <select
                  value={settings?.maxUploadsPerReport || 5}
                  onChange={(e) => handleUpdateUploadSettings('maxUploadsPerReport', parseInt(e.target.value))}
                  disabled={isSaving}
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
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
      </div>

      {/* Email Branding Settings */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Email Branding</h2>
        <p className="text-gray-600 mb-4">
          Customize how your organization appears in emails sent by the system.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
          {/* Organization Name */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Organization Name
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  Used in email subject lines and body text (e.g., &quot;Thank you for volunteering with [Organization Name]!&quot;)
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
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
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="RippleVMS"
                />
              </div>
            </div>
          </div>

          {/* Email From Name */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Email From Name
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  The name that appears in the &quot;From&quot; field of emails (e.g., &quot;[From Name] &lt;noreply@example.com&gt;&quot;)
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
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
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="RippleVMS"
                />
              </div>
            </div>
          </div>

          {/* Email From Address */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Email From Address
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  The email address used as the sender for all system emails. Only the local part can be customized (domain is verified in AWS SES).
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
                <div className="flex items-center">
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
                    className={`px-3 py-2 border border-gray-300 rounded-l-lg text-sm w-32 ${
                      isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                    }`}
                    placeholder="noreply"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-sm text-gray-600">
                    @ripple-vms.com
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Reply-To */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Reply-To Email Address
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  When recipients reply to system emails, their replies will go to this address.
                  Leave blank to use the From Address.
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
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
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="contact@example.com"
                />
              </div>
            </div>
          </div>

          {/* Email Footer */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Email Footer Team Name
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  The team name shown in the email footer (e.g., &quot;Best regards, [Team Name]&quot;)
                </p>
              </div>
              <div className="ml-6 flex items-center gap-2">
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
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="RippleVMS Team"
                />
              </div>
            </div>
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

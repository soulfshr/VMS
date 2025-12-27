'use client';

import { useEffect, useState } from 'react';

interface Settings {
  id: string;
  autoConfirmRsvp: boolean;
  timezone: string;
  // Branding settings
  orgName: string;
  emailFromName: string;
  emailFromAddress: string;
  emailReplyTo: string;
  emailFooter: string;
  // Email digest settings
  weeklyDigestEnabled: boolean;
  weeklyDigestSendHour: number;
  // Signup settings
  inviteCode: string | null;
}

// Helper to format hour as readable time
function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
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
  const [localInviteCode, setLocalInviteCode] = useState('');

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
        setLocalInviteCode(data.inviteCode || '');
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

  const handleToggleWeeklyDigest = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklyDigestEnabled: !settings.weeklyDigestEnabled,
        }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Weekly digest setting updated' });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDigestSendHour = async (hour: number) => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklyDigestSendHour: hour,
        }),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: `Weekly digest will now send at ${formatHour(hour)} ET` });
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage({ type: 'error', text: 'Failed to update settings' });
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

  const handleUpdateInviteCode = async (value: string) => {
    if (!settings) return;

    // Validate length (3-20 characters)
    const trimmed = value.trim();
    if (trimmed && (trimmed.length < 3 || trimmed.length > 20)) {
      setMessage({ type: 'error', text: 'Invite code must be between 3 and 20 characters' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode: trimmed || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update invite code');
      }

      const updated = await res.json();
      setSettings(updated);
      setLocalInviteCode(updated.inviteCode || '');
      setMessage({ type: 'success', text: 'Invite code updated successfully' });
    } catch (err) {
      console.error('Error updating invite code:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update invite code' });
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

      {/* Signup Settings */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Volunteer Signup</h2>
        <p className="text-gray-600 mb-4">
          Configure how new volunteers can sign up for your organization.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
          {/* Invite Code */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Invite Code
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  New volunteers must enter this code to sign up. Share this code with people you want to recruit.
                  The code is case-insensitive and must be 3-20 characters long.
                </p>
                {localInviteCode && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <span className="text-sm font-medium text-cyan-900">Current code:</span>
                    <code className="text-sm font-mono font-semibold text-cyan-700 bg-white px-2 py-1 rounded border border-cyan-300">
                      {localInviteCode}
                    </code>
                  </div>
                )}
              </div>
              <div className="ml-6 flex items-center gap-2">
                <input
                  type="text"
                  value={localInviteCode}
                  onChange={(e) => setLocalInviteCode(e.target.value)}
                  onBlur={() => {
                    if (localInviteCode !== (settings?.inviteCode || '')) {
                      handleUpdateInviteCode(localInviteCode);
                    }
                  }}
                  disabled={isSaving}
                  className={`px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 font-mono ${
                    isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                  }`}
                  placeholder="e.g., WELCOME2025"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          {/* Intake Questions Link */}
          <div className="p-6 bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Intake Questions
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  Configure custom questions to ask volunteers during the signup process.
                </p>
              </div>
              <div className="ml-6">
                <a
                  href="/admin/intake-questions"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Manage Questions
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Notifications Settings */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Email Notifications</h2>
        <p className="text-gray-600 mb-4">
          Configure automated email notifications sent by the system.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
          {/* Weekly Schedule Digest */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  Weekly Schedule Digest
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                  Send a weekly email every Sunday with the upcoming week&apos;s schedule (Mon-Sun).
                  The digest includes dispatcher assignments, zone coverage, and any gaps that need to be filled.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Recipients: Coordinators, Dispatchers, and Administrators who have email notifications enabled.
                </p>
              </div>
              <div className="ml-6">
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
            </div>
            <div className="mt-4 flex items-center gap-4">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  settings?.weeklyDigestEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {settings?.weeklyDigestEnabled ? 'Enabled' : 'Disabled'}
              </span>
              {settings?.weeklyDigestEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Send at:</span>
                  <select
                    value={settings?.weeklyDigestSendHour ?? 18}
                    onChange={(e) => handleUpdateDigestSendHour(parseInt(e.target.value))}
                    disabled={isSaving}
                    className={`px-3 py-1.5 border border-gray-300 rounded-lg text-sm ${
                      isSaving ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white'
                    }`}
                  >
                    {/* Common hours for weekly digest */}
                    <option value={8}>8:00 AM ET</option>
                    <option value={9}>9:00 AM ET</option>
                    <option value={10}>10:00 AM ET</option>
                    <option value={12}>12:00 PM ET</option>
                    <option value={14}>2:00 PM ET</option>
                    <option value={16}>4:00 PM ET</option>
                    <option value={17}>5:00 PM ET</option>
                    <option value={18}>6:00 PM ET</option>
                    <option value={19}>7:00 PM ET</option>
                    <option value={20}>8:00 PM ET</option>
                  </select>
                </div>
              )}
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DeveloperSettings {
  feedbackEmailRecipient: string;
}

export default function SettingsSystemPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<DeveloperSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [localFeedbackEmail, setLocalFeedbackEmail] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/developer/settings').then(res => res.json()),
    ])
      .then(([sessionData, settingsData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        if (sessionData.user.role !== 'DEVELOPER') {
          router.push('/settings/profile');
          return;
        }
        setSettings(settingsData);
        setLocalFeedbackEmail(settingsData.feedbackEmailRecipient || '');
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading settings:', err);
        setIsLoading(false);
      });
  }, [router]);

  const handleUpdateFeedbackEmail = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/developer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackEmailRecipient: localFeedbackEmail }),
      });

      if (!res.ok) {
        throw new Error('Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Feedback email updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {/* Header */}
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
        <p className="text-gray-600 mt-1">Developer-only system configuration</p>
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

      {/* Feedback Email */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Feedback Email Recipient</h3>
        <p className="text-sm text-gray-600 mb-4">
          User feedback submissions from the help widget will be sent to this email. Leave blank to disable.
        </p>
        <div className="flex gap-3 max-w-md">
          <input
            type="email"
            value={localFeedbackEmail}
            onChange={(e) => setLocalFeedbackEmail(e.target.value)}
            placeholder="feedback@example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleUpdateFeedbackEmail}
            disabled={isSaving || localFeedbackEmail === settings?.feedbackEmailRecipient}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Developer Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/developer/health"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl">💚</span>
            <div>
              <p className="font-medium text-gray-900">System Health</p>
              <p className="text-sm text-gray-500">Check system status and connectivity</p>
            </div>
          </Link>
          <Link
            href="/developer/logs"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-medium text-gray-900">System Logs</p>
              <p className="text-sm text-gray-500">View application logs and errors</p>
            </div>
          </Link>
          <Link
            href="/developer/knowledge-graph"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl">🕸️</span>
            <div>
              <p className="font-medium text-gray-900">Knowledge Graph</p>
              <p className="text-sm text-gray-500">Visualize system relationships</p>
            </div>
          </Link>
          <Link
            href="/training-center"
            className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <span className="text-2xl">📚</span>
            <div>
              <p className="font-medium text-gray-900">Training Center</p>
              <p className="text-sm text-gray-500">Manage training modules</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-6 bg-purple-50">
        <div className="flex gap-3">
          <span className="text-purple-500 text-lg">🔧</span>
          <div className="text-sm text-purple-800">
            <p className="font-medium mb-1">Developer Access</p>
            <p>
              This section is only visible to users with the DEVELOPER role.
              System tools and monitoring are accessible from the links above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

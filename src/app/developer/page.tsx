'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HealthService {
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  checkedAt: string;
}

interface RecentError {
  id: string;
  severity: string;
  category: string;
  message: string;
  createdAt: string;
}

interface Alert {
  type: string;
  lastTriggered: string | null;
  triggerCount: number;
  inCooldown: boolean;
}

interface Stats {
  logs: {
    total24h: number;
    errors24h: number;
    critical24h: number;
    warnings24h: number;
    errorRate: number;
  };
  recentErrors: RecentError[];
  health: {
    services: Record<string, HealthService>;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  };
  email: {
    blasts7d: number;
    sent7d: number;
    failed7d: number;
    successRate: number;
  };
  business: {
    activeShiftsToday: number;
    rsvpsToday: number;
    activeVolunteers30d: number;
  };
  alerts: Alert[];
  generatedAt: string;
}

const statusColors = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unhealthy: 'bg-red-500',
};

const severityColors = {
  CRITICAL: 'bg-red-100 text-red-800',
  ERROR: 'bg-orange-100 text-orange-800',
  WARN: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
};

export default function DeveloperOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertStatus, setAlertStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Developer settings
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/developer/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch developer settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/developer/settings');
        if (res.ok) {
          const data = await res.json();
          setFeedbackEmail(data.feedbackEmail || '');
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/developer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSettingsMessage({ type: 'success', text: 'Settings saved!' });
      setTimeout(() => setSettingsMessage(null), 3000);
    } catch (err) {
      setSettingsMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  const runHealthCheck = async () => {
    try {
      await fetch('/api/developer/health');
      fetchStats();
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const sendTestAlert = async () => {
    setAlertStatus('sending');
    try {
      const res = await fetch('/api/developer/test-alert', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send test alert');
      setAlertStatus('sent');
      setTimeout(() => setAlertStatus('idle'), 3000);
    } catch (err) {
      console.error('Test alert failed:', err);
      setAlertStatus('error');
      setTimeout(() => setAlertStatus('idle'), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time health and metrics</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">
            Updated: {new Date(stats.generatedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isRefreshing ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(stats.health.services).map(([service, data]) => (
          <div key={service} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 capitalize">{service}</h3>
              <div className={`w-3 h-3 rounded-full ${statusColors[data.status]}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-semibold ${
                data.status === 'healthy' ? 'text-green-600' :
                data.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {data.status}
              </span>
              <span className="text-sm text-gray-500">
                {data.responseMs}ms
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Logs (24h)</p>
          <p className="text-2xl font-bold text-gray-900">{stats.logs.total24h}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Errors (24h)</p>
          <p className={`text-2xl font-bold ${stats.logs.errors24h > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.logs.errors24h}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Error Rate</p>
          <p className={`text-2xl font-bold ${stats.logs.errorRate > 5 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.logs.errorRate}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Email Success</p>
          <p className={`text-2xl font-bold ${stats.email.successRate < 95 ? 'text-yellow-600' : 'text-green-600'}`}>
            {stats.email.successRate}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Errors */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Recent Errors</h2>
            <Link
              href="/developer/logs?severity=ERROR"
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentErrors.length > 0 ? (
              stats.recentErrors.slice(0, 5).map((error) => (
                <div key={error.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${severityColors[error.severity as keyof typeof severityColors] || 'bg-gray-100 text-gray-800'}`}>
                      {error.severity}
                    </span>
                    <span className="text-xs text-gray-500">{error.category}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">{error.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(error.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No errors in the last 24 hours
              </div>
            )}
          </div>
        </div>

        {/* Business Metrics */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Business Metrics</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Shifts Today</span>
              <span className="font-semibold text-gray-900">{stats.business.activeShiftsToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">RSVPs Today</span>
              <span className="font-semibold text-gray-900">{stats.business.rsvpsToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Volunteers (30d)</span>
              <span className="font-semibold text-gray-900">{stats.business.activeVolunteers30d}</span>
            </div>
            <hr className="border-gray-200" />
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Email Blasts (7d)</span>
              <span className="font-semibold text-gray-900">{stats.email.blasts7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Emails Sent (7d)</span>
              <span className="font-semibold text-gray-900">{stats.email.sent7d}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Emails Failed (7d)</span>
              <span className={`font-semibold ${stats.email.failed7d > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.email.failed7d}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {stats.alerts.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Alerts</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.alerts.map((alert) => (
              <div key={alert.type} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{alert.type.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-500">
                    Triggered {alert.triggerCount} time{alert.triggerCount !== 1 ? 's' : ''}
                    {alert.lastTriggered && ` • Last: ${new Date(alert.lastTriggered).toLocaleString()}`}
                  </p>
                </div>
                {alert.inCooldown && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    In cooldown
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Developer Settings */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Developer Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Settings only accessible to developers</p>
        </div>
        <div className="p-4">
          <div className="max-w-md">
            <label htmlFor="feedbackEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Email Recipient
            </label>
            <p className="text-xs text-gray-500 mb-2">
              User feedback from the widget will be sent to this email. Leave blank to disable.
            </p>
            <div className="flex gap-2">
              <input
                id="feedbackEmail"
                type="email"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                disabled={settingsLoading}
                placeholder="developer@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
              <button
                onClick={saveSettings}
                disabled={settingsSaving || settingsLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {settingsSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {settingsMessage && (
              <p className={`mt-2 text-sm ${settingsMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {settingsMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Developer Tools</h2>
          <p className="text-sm text-gray-500 mt-1">Platform-wide configuration and tools</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/developer/global-feature-flags"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="font-medium text-gray-900">Feature Flags</div>
            <p className="text-sm text-gray-500 mt-1">Toggle global platform features</p>
          </Link>
          <Link
            href="/developer/default-intake-questions"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="font-medium text-gray-900">Default Intake Questions</div>
            <p className="text-sm text-gray-500 mt-1">Templates for org signup forms</p>
          </Link>
          <Link
            href="/developer/logs"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="font-medium text-gray-900">System Logs</div>
            <p className="text-sm text-gray-500 mt-1">View all application logs</p>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex flex-wrap gap-2 sm:gap-4">
        <button
          onClick={runHealthCheck}
          className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Health Check
        </button>
        <button
          onClick={sendTestAlert}
          disabled={alertStatus === 'sending'}
          className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium ${
            alertStatus === 'sent' ? 'bg-green-100 text-green-700' :
            alertStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-orange-600 text-white hover:bg-orange-700'
          } disabled:opacity-50`}
        >
          {alertStatus === 'sending' ? '...' :
           alertStatus === 'sent' ? 'Sent!' :
           alertStatus === 'error' ? 'Failed' :
           'Test Alert'}
        </button>
        <Link
          href="/developer/logs"
          className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          All Logs
        </Link>
      </div>
    </div>
  );
}

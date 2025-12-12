'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  id: string;
  featureTrainings: boolean | null;
  featureSightings: boolean | null;
}

const ENV_FEATURE_DEFAULTS = {
  trainings: process.env.NEXT_PUBLIC_FEATURE_TRAININGS === 'true',
  sightings: process.env.NEXT_PUBLIC_FEATURE_SIGHTINGS === 'true',
};

export default function SettingsFeaturesPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading settings:', err);
        setIsLoading(false);
      });
  }, [router]);

  const handleUpdateFeatureFlag = async (
    flag: 'featureTrainings' | 'featureSightings',
    value: boolean | null
  ) => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [flag]: value }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Feature flag updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally {
      setIsSaving(false);
    }
  };

  const getFeatureFlagValue = (dbValue: boolean | null, envDefault: boolean): boolean => {
    return dbValue !== null ? dbValue : envDefault;
  };

  const isFeatureFlagOverridden = (dbValue: boolean | null): boolean => {
    return dbValue !== null;
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
        <h2 className="text-xl font-semibold text-gray-900">Feature Flags</h2>
        <p className="text-gray-600 mt-1">Control feature visibility across the application</p>
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

      {/* Trainings Feature */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Training Feature</h3>
            <p className="text-sm text-gray-600 mt-1">
              Shows/hides the Training section in navigation and all training-related pages.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Environment default: {ENV_FEATURE_DEFAULTS.trainings ? 'ON' : 'OFF'}
              </span>
              {isFeatureFlagOverridden(settings?.featureTrainings ?? null) && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Overridden
                </span>
              )}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <button
              onClick={() => handleUpdateFeatureFlag('featureTrainings', null)}
              disabled={isSaving || !isFeatureFlagOverridden(settings?.featureTrainings ?? null)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                !isFeatureFlagOverridden(settings?.featureTrainings ?? null)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Use Default
            </button>
            <button
              onClick={() => {
                const currentValue = getFeatureFlagValue(settings?.featureTrainings ?? null, ENV_FEATURE_DEFAULTS.trainings);
                handleUpdateFeatureFlag('featureTrainings', !currentValue);
              }}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                getFeatureFlagValue(settings?.featureTrainings ?? null, ENV_FEATURE_DEFAULTS.trainings)
                  ? 'bg-cyan-600'
                  : 'bg-gray-200'
              } ${isSaving ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  getFeatureFlagValue(settings?.featureTrainings ?? null, ENV_FEATURE_DEFAULTS.trainings)
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Sightings Feature */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">ICE Sightings Feature</h3>
            <p className="text-sm text-gray-600 mt-1">
              Shows/hides the ICE Sightings report feature, including the public report form.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Environment default: {ENV_FEATURE_DEFAULTS.sightings ? 'ON' : 'OFF'}
              </span>
              {isFeatureFlagOverridden(settings?.featureSightings ?? null) && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Overridden
                </span>
              )}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <button
              onClick={() => handleUpdateFeatureFlag('featureSightings', null)}
              disabled={isSaving || !isFeatureFlagOverridden(settings?.featureSightings ?? null)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                !isFeatureFlagOverridden(settings?.featureSightings ?? null)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Use Default
            </button>
            <button
              onClick={() => {
                const currentValue = getFeatureFlagValue(settings?.featureSightings ?? null, ENV_FEATURE_DEFAULTS.sightings);
                handleUpdateFeatureFlag('featureSightings', !currentValue);
              }}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                getFeatureFlagValue(settings?.featureSightings ?? null, ENV_FEATURE_DEFAULTS.sightings)
                  ? 'bg-cyan-600'
                  : 'bg-gray-200'
              } ${isSaving ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  getFeatureFlagValue(settings?.featureSightings ?? null, ENV_FEATURE_DEFAULTS.sightings)
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-6 bg-blue-50">
        <div className="flex gap-3">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Feature Flags</p>
            <p>
              Feature flags control visibility of major features. When you toggle a feature, it overrides the
              environment default for all users. Click &quot;Use Default&quot; to revert to the environment setting.
            </p>
            <p className="mt-2 text-xs">
              Changes take effect immediately. Users may need to refresh to see changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

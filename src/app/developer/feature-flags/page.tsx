'use client';

import { useEffect, useState } from 'react';

interface Settings {
  id: string;
  featureTrainings: boolean | null;
  featureSightings: boolean | null;
  featureMaps: boolean | null;
}

// Environment variable defaults for feature flags
const ENV_FEATURE_DEFAULTS = {
  trainings: process.env.NEXT_PUBLIC_FEATURE_TRAININGS === 'true',
  sightings: process.env.NEXT_PUBLIC_FEATURE_SIGHTINGS === 'true',
  maps: process.env.NEXT_PUBLIC_FEATURE_MAPS === 'true',
};

export default function DeveloperPage() {
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

  const handleUpdateFeatureFlag = async (
    flag: 'featureTrainings' | 'featureSightings' | 'featureMaps',
    value: boolean | null
  ) => {
    if (!settings) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [flag]: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Feature flag updated successfully' });
    } catch (err) {
      console.error('Error updating feature flag:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update feature flag' });
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Per-Organization Feature Flags</h1>
        <p className="text-gray-600 mt-1">
          Override feature flags for the currently selected organization.
          Use this for beta testing or enabling paid features for specific orgs.
        </p>
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
        {/* Trainings Feature */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Trainings Feature
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Shows/hides the Trainings section in the navigation and all training-related pages.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {ENV_FEATURE_DEFAULTS.trainings ? 'ON' : 'OFF'}
                </span>
                {isFeatureFlagOverridden(settings?.featureTrainings ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Overridden
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureTrainings', null)}
                disabled={isSaving || !isFeatureFlagOverridden(settings?.featureTrainings ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isFeatureFlagOverridden(settings?.featureTrainings ?? null)
                    ? 'bg-gray-100 text-gray-700 border-gray-300 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              <h3 className="text-lg font-medium text-gray-900">
                ICE Sightings Feature
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Shows/hides the ICE Sightings report feature, including the public report form and sightings management.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {ENV_FEATURE_DEFAULTS.sightings ? 'ON' : 'OFF'}
                </span>
                {isFeatureFlagOverridden(settings?.featureSightings ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Overridden
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureSightings', null)}
                disabled={isSaving || !isFeatureFlagOverridden(settings?.featureSightings ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isFeatureFlagOverridden(settings?.featureSightings ?? null)
                    ? 'bg-gray-100 text-gray-700 border-gray-300 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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

        {/* Maps Feature */}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                Maps Feature
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xl">
                Shows/hides the Map page with zones and points of interest. Disable for orgs that don&apos;t need geographic visualization.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {ENV_FEATURE_DEFAULTS.maps ? 'ON' : 'OFF'}
                </span>
                {isFeatureFlagOverridden(settings?.featureMaps ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Overridden
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureMaps', null)}
                disabled={isSaving || !isFeatureFlagOverridden(settings?.featureMaps ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isFeatureFlagOverridden(settings?.featureMaps ?? null)
                    ? 'bg-gray-100 text-gray-700 border-gray-300 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Use Default
              </button>
              <button
                onClick={() => {
                  const currentValue = getFeatureFlagValue(settings?.featureMaps ?? null, ENV_FEATURE_DEFAULTS.maps);
                  handleUpdateFeatureFlag('featureMaps', !currentValue);
                }}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  getFeatureFlagValue(settings?.featureMaps ?? null, ENV_FEATURE_DEFAULTS.maps)
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    getFeatureFlagValue(settings?.featureMaps ?? null, ENV_FEATURE_DEFAULTS.maps)
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Note: Feature flag changes take effect immediately for all users. A page refresh may be needed to see changes.
      </p>

      {/* Info box */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-purple-400">🔧</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">
              About Feature Flags
            </h3>
            <div className="mt-2 text-sm text-purple-700">
              <p>
                <strong>Environment Default:</strong> The default value set via environment variables (NEXT_PUBLIC_FEATURE_*).
                This is what the feature will use if no override is set.
              </p>
              <p className="mt-2">
                <strong>Override:</strong> When you toggle a feature here, it overrides the environment default for all users.
                Click &quot;Use Default&quot; to remove the override and revert to the environment setting.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

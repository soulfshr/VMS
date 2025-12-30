'use client';

import { useEffect, useState } from 'react';

interface GlobalSettings {
  featureTrainings: boolean | null;
  featureSightings: boolean | null;
  featureMaps: boolean | null;
  envDefaults: {
    trainings: boolean;
    sightings: boolean;
    maps: boolean;
  };
  updatedAt: string;
}

export default function GlobalFeatureFlagsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/developer/global-settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch global settings');
        return res.json();
      })
      .then(data => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading global settings:', err);
        setMessage({ type: 'error', text: 'Failed to load global settings. Make sure you have developer access.' });
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
      const res = await fetch('/api/developer/global-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [flag]: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update global settings');
      }

      const updated = await res.json();
      setSettings(updated);
      setMessage({ type: 'success', text: 'Global feature flag updated successfully' });
    } catch (err) {
      console.error('Error updating global feature flag:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update global feature flag' });
    } finally {
      setIsSaving(false);
    }
  };

  const getResolvedValue = (dbValue: boolean | null, envDefault: boolean): boolean => {
    return dbValue !== null ? dbValue : envDefault;
  };

  const isOverridden = (dbValue: boolean | null): boolean => {
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
        <h1 className="text-2xl font-bold text-gray-900">Global Feature Flags</h1>
        <p className="text-gray-600 mt-1">
          Control feature availability across all organizations
        </p>
      </div>

      {/* Warning banner */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-amber-400">!</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">
              These settings affect ALL organizations
            </h3>
            <div className="mt-1 text-sm text-amber-700">
              <p>
                When a feature is <strong>OFF globally</strong>, org admins cannot enable it.
                Only developers can enable features per-org using the per-org feature flags page.
              </p>
            </div>
          </div>
        </div>
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
                When ON, org admins can disable for their org. When OFF, feature is unavailable unless you enable per-org.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {settings?.envDefaults.trainings ? 'ON' : 'OFF'}
                </span>
                {isOverridden(settings?.featureTrainings ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Global Override Active
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureTrainings', null)}
                disabled={isSaving || !isOverridden(settings?.featureTrainings ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isOverridden(settings?.featureTrainings ?? null)
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Use Env Default
              </button>
              <button
                onClick={() => {
                  const currentValue = getResolvedValue(settings?.featureTrainings ?? null, settings?.envDefaults.trainings ?? false);
                  handleUpdateFeatureFlag('featureTrainings', !currentValue);
                }}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  getResolvedValue(settings?.featureTrainings ?? null, settings?.envDefaults.trainings ?? false)
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    getResolvedValue(settings?.featureTrainings ?? null, settings?.envDefaults.trainings ?? false)
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
                When ON, org admins can disable for their org. When OFF, feature is unavailable unless you enable per-org.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {settings?.envDefaults.sightings ? 'ON' : 'OFF'}
                </span>
                {isOverridden(settings?.featureSightings ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Global Override Active
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureSightings', null)}
                disabled={isSaving || !isOverridden(settings?.featureSightings ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isOverridden(settings?.featureSightings ?? null)
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Use Env Default
              </button>
              <button
                onClick={() => {
                  const currentValue = getResolvedValue(settings?.featureSightings ?? null, settings?.envDefaults.sightings ?? false);
                  handleUpdateFeatureFlag('featureSightings', !currentValue);
                }}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  getResolvedValue(settings?.featureSightings ?? null, settings?.envDefaults.sightings ?? false)
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    getResolvedValue(settings?.featureSightings ?? null, settings?.envDefaults.sightings ?? false)
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
                When ON, org admins can disable for their org. When OFF, feature is unavailable unless you enable per-org.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  Environment default: {settings?.envDefaults.maps ? 'ON' : 'OFF'}
                </span>
                {isOverridden(settings?.featureMaps ?? null) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Global Override Active
                  </span>
                )}
              </div>
            </div>
            <div className="ml-6 flex items-center gap-3">
              <button
                onClick={() => handleUpdateFeatureFlag('featureMaps', null)}
                disabled={isSaving || !isOverridden(settings?.featureMaps ?? null)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  !isOverridden(settings?.featureMaps ?? null)
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Use Env Default
              </button>
              <button
                onClick={() => {
                  const currentValue = getResolvedValue(settings?.featureMaps ?? null, settings?.envDefaults.maps ?? false);
                  handleUpdateFeatureFlag('featureMaps', !currentValue);
                }}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  getResolvedValue(settings?.featureMaps ?? null, settings?.envDefaults.maps ?? false)
                    ? 'bg-purple-600'
                    : 'bg-gray-200'
                } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    getResolvedValue(settings?.featureMaps ?? null, settings?.envDefaults.maps ?? false)
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
        Changes take effect immediately. Users may need to refresh their page to see changes.
      </p>

      {/* Info box */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-purple-400">i</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-purple-800">
              Resolution Order
            </h3>
            <div className="mt-2 text-sm text-purple-700 space-y-2">
              <p>
                <strong>1. Per-Org Override</strong> (Developer &gt; Feature Flags) - Highest priority
              </p>
              <p>
                <strong>2. Global Default</strong> (This page) - Applies to all orgs without override
              </p>
              <p>
                <strong>3. Environment Variable</strong> - Fallback when no database values set
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Use cases */}
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-800 mb-2">Common Use Cases</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>
            <strong>Beta rollout:</strong> Keep global OFF, enable per-org for beta testers
          </li>
          <li>
            <strong>Paid feature:</strong> Keep global OFF, enable only for paying organizations
          </li>
          <li>
            <strong>General availability:</strong> Set global ON, orgs can opt-out if needed
          </li>
        </ul>
      </div>
    </div>
  );
}

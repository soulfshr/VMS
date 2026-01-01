'use client';

import { useEffect, useState } from 'react';

interface FeatureFlag {
  value: boolean;
  source: 'org' | 'global' | 'env';
  adminConfigurable: boolean;
  devEnabled: boolean;
  globalValue: boolean | null;
  orgValue: boolean | null;
}

interface FeaturesData {
  trainings: FeatureFlag;
  sightings: FeatureFlag;
  maps: FeatureFlag;
  resolved: {
    trainings: boolean;
    sightings: boolean;
    maps: boolean;
  };
}

interface Session {
  user?: {
    role: string;
  };
}

export default function AdminFeaturesPage() {
  const [featuresData, setFeaturesData] = useState<FeaturesData | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDeveloper = userRole === 'DEVELOPER';

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()) as Promise<Session>,
      fetch('/api/features').then(res => res.json()) as Promise<FeaturesData>,
    ])
      .then(([sessionData, features]) => {
        setUserRole(sessionData.user?.role || null);
        setFeaturesData(features);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading features:', err);
        setIsLoading(false);
      });
  }, []);

  const handleUpdateFeatureFlag = async (
    flag: 'featureTrainings' | 'featureSightings' | 'featureMaps',
    value: boolean | null
  ) => {
    if (!featuresData) return;

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

      // Refetch features to get updated metadata
      const featuresRes = await fetch('/api/features');
      if (featuresRes.ok) {
        const updated = await featuresRes.json();
        setFeaturesData(updated);
      }
      setMessage({ type: 'success', text: 'Feature flag updated' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderFeatureRow = (
    key: 'trainings' | 'sightings' | 'maps',
    dbKey: 'featureTrainings' | 'featureSightings' | 'featureMaps',
    title: string,
    description: string
  ) => {
    if (!featuresData) return null;

    const feature = featuresData[key];

    // Show feature if: admin can configure (global ON) OR dev enabled for this org OR user is developer
    const isVisible = feature.adminConfigurable || feature.devEnabled || isDeveloper;

    if (!isVisible) {
      return null;
    }

    // Can toggle if: admin can configure (global ON) OR user is developer
    const canToggle = feature.adminConfigurable || isDeveloper;

    const hasOrgOverride = feature.orgValue !== null;

    // Determine badge text and color
    let badgeText = '';
    let badgeClass = '';

    if (feature.devEnabled && !isDeveloper) {
      // Admin viewing a dev-enabled feature (global is OFF)
      badgeText = 'Enabled by developer';
      badgeClass = 'bg-purple-100 text-purple-800';
    } else if (feature.source === 'org') {
      badgeText = feature.value ? 'Enabled for this org' : 'Disabled for this org';
      badgeClass = feature.value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
    } else if (feature.source === 'global') {
      badgeText = 'Using global default';
      badgeClass = 'bg-blue-100 text-blue-800';
    } else {
      badgeText = 'Using environment default';
      badgeClass = 'bg-gray-100 text-gray-600';
    }

    // For developers viewing a globally-off feature that's enabled per-org
    const isDevOverride = isDeveloper && feature.devEnabled;

    return (
      <div className="p-4 border-b border-gray-100 last:border-b-0" key={key}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
                {badgeText}
              </span>
              {isDevOverride && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  Developer override
                </span>
              )}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-3">
            {hasOrgOverride && canToggle && (
              <button
                onClick={() => handleUpdateFeatureFlag(dbKey, null)}
                disabled={isSaving}
                className={`px-3 py-1.5 text-sm rounded-lg border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 ${
                  isSaving ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Reset to Default
              </button>
            )}
            {canToggle ? (
              <button
                onClick={() => handleUpdateFeatureFlag(dbKey, !feature.value)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  feature.value ? 'bg-cyan-600' : 'bg-gray-200'
                } ${isSaving ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    feature.value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : (
              <div
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-400 opacity-60 cursor-not-allowed"
                title="This feature was enabled by a developer and cannot be disabled"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check if any features are visible (configurable or dev-enabled)
  const hasVisibleFeatures =
    featuresData &&
    (featuresData.trainings.adminConfigurable ||
      featuresData.trainings.devEnabled ||
      featuresData.sightings.adminConfigurable ||
      featuresData.sightings.devEnabled ||
      featuresData.maps.adminConfigurable ||
      featuresData.maps.devEnabled ||
      isDeveloper);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Features</h1>
        <p className="text-gray-600 mt-1">
          Control feature visibility for your organization
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

      <div className="bg-white rounded-xl border border-gray-200">
        {!hasVisibleFeatures ? (
          <div className="p-6 text-center text-gray-500">
            <p>No features are currently available for configuration.</p>
            <p className="text-sm mt-1">
              Contact support if you&apos;d like to enable additional features for your organization.
            </p>
          </div>
        ) : (
          <>
            {renderFeatureRow(
              'trainings',
              'featureTrainings',
              'Training Feature',
              'Shows/hides the Training section in navigation and all training-related pages.'
            )}
            {renderFeatureRow(
              'sightings',
              'featureSightings',
              'ICE Sightings Feature',
              'Shows/hides the ICE Sightings report feature, including the public report form.'
            )}
            {renderFeatureRow(
              'maps',
              'featureMaps',
              'Maps Feature',
              'Shows/hides the Map page with zones and points of interest. Useful for organizations that don\'t need geographic visualization.'
            )}
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <span className="text-blue-500 text-lg">i</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Feature Flags</p>
            <p>
              Feature flags control visibility of major features.
              {isDeveloper
                ? ' As a developer, you can enable any feature for this organization.'
                : ' You can disable features that are globally enabled. Features that are not available globally cannot be enabled here.'}
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

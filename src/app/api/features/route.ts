import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentOrgId } from '@/lib/org-context';
import { getGlobalSettings, ENV_FEATURE_DEFAULTS } from '@/lib/global-settings';

type FeatureSource = 'org' | 'global' | 'env';

interface FeatureFlag {
  value: boolean;
  source: FeatureSource;
  // For admin UI: can this feature be toggled by admins?
  // True only when global is ON
  adminConfigurable: boolean;
  // True when dev has enabled this feature for this org (global is OFF but org override is true)
  // Feature should be visible but read-only for admins in this case
  devEnabled: boolean;
  // Raw values for debugging/advanced UI
  globalValue: boolean | null;
  orgValue: boolean | null;
}

interface FeaturesResponse {
  trainings: FeatureFlag;
  sightings: FeatureFlag;
  maps: FeatureFlag;
  // Simple resolved values for backward compatibility
  resolved: {
    trainings: boolean;
    sightings: boolean;
    maps: boolean;
  };
}

/**
 * Resolve a feature flag with 3-tier logic.
 *
 * Resolution: orgOverride ?? globalDefault ?? envDefault
 *
 * Admin visibility rules:
 * - Global OFF + no org override → feature invisible to admins
 * - Global OFF + org override true → feature visible (dev enabled for this org)
 * - Global ON → feature visible (admin can disable)
 */
function resolveFeature(
  key: keyof typeof ENV_FEATURE_DEFAULTS,
  orgValue: boolean | null | undefined,
  globalValue: boolean | null | undefined
): FeatureFlag {
  const envDefault = ENV_FEATURE_DEFAULTS[key];

  // Determine final value
  let value: boolean;
  let source: FeatureSource;

  if (orgValue !== null && orgValue !== undefined) {
    value = orgValue;
    source = 'org';
  } else if (globalValue !== null && globalValue !== undefined) {
    value = globalValue;
    source = 'global';
  } else {
    value = envDefault;
    source = 'env';
  }

  // Determine if admin can configure this feature
  // Admin can only configure when global is ON
  const resolvedGlobal = globalValue ?? envDefault;
  const adminConfigurable = resolvedGlobal === true;

  // Dev-enabled: global is OFF but dev has enabled for this specific org
  // Feature is visible to admin but read-only (only developer can toggle)
  const devEnabled = resolvedGlobal === false && orgValue === true;

  return {
    value,
    source,
    adminConfigurable,
    devEnabled,
    globalValue: globalValue ?? null,
    orgValue: orgValue ?? null,
  };
}

// GET /api/features - Get resolved feature flags
export async function GET() {
  try {
    const orgId = await getCurrentOrgId();

    // Fetch global settings and org settings in parallel
    const [globalSettings, orgSettings] = await Promise.all([
      getGlobalSettings(),
      orgId
        ? prisma.organizationSettings.findFirst({
            where: { organizationId: orgId },
          })
        : Promise.resolve(null),
    ]);

    // Resolve each feature flag with 3-tier logic
    const trainings = resolveFeature(
      'trainings',
      orgSettings?.featureTrainings,
      globalSettings.featureTrainings
    );

    const sightings = resolveFeature(
      'sightings',
      orgSettings?.featureSightings,
      globalSettings.featureSightings
    );

    const maps = resolveFeature(
      'maps',
      orgSettings?.featureMaps,
      globalSettings.featureMaps
    );

    const response: FeaturesResponse = {
      trainings,
      sightings,
      maps,
      // Simple resolved values for backward compatibility
      resolved: {
        trainings: trainings.value,
        sightings: sightings.value,
        maps: maps.value,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching features:', error);
    // Fall back to env defaults on error
    return NextResponse.json({
      trainings: {
        value: ENV_FEATURE_DEFAULTS.trainings,
        source: 'env' as const,
        adminConfigurable: ENV_FEATURE_DEFAULTS.trainings,
        devEnabled: false,
        globalValue: null,
        orgValue: null,
      },
      sightings: {
        value: ENV_FEATURE_DEFAULTS.sightings,
        source: 'env' as const,
        adminConfigurable: ENV_FEATURE_DEFAULTS.sightings,
        devEnabled: false,
        globalValue: null,
        orgValue: null,
      },
      maps: {
        value: ENV_FEATURE_DEFAULTS.maps,
        source: 'env' as const,
        adminConfigurable: ENV_FEATURE_DEFAULTS.maps,
        devEnabled: false,
        globalValue: null,
        orgValue: null,
      },
      resolved: ENV_FEATURE_DEFAULTS,
    });
  }
}

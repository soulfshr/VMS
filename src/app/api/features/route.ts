import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentOrgId } from '@/lib/org-context';
import { getGlobalSettings, ENV_FEATURE_DEFAULTS } from '@/lib/global-settings';

type FeatureSource = 'org' | 'global' | 'env';

interface FeatureFlag {
  value: boolean;
  source: FeatureSource;
  // For admin UI: can this feature be toggled by admins?
  // True when: global is ON (admin can disable) OR org override is explicitly true
  adminConfigurable: boolean;
  // Raw values for debugging/advanced UI
  globalValue: boolean | null;
  orgValue: boolean | null;
}

interface FeaturesResponse {
  trainings: FeatureFlag;
  sightings: FeatureFlag;
  // Simple resolved values for backward compatibility
  resolved: {
    trainings: boolean;
    sightings: boolean;
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
  // Admin can configure when:
  // 1. Global is ON (resolved global value is true) - admin can disable
  // 2. Org override is explicitly true - dev enabled it, admin can see it
  const resolvedGlobal = globalValue ?? envDefault;
  const adminConfigurable = resolvedGlobal === true || orgValue === true;

  return {
    value,
    source,
    adminConfigurable,
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

    const response: FeaturesResponse = {
      trainings,
      sightings,
      // Simple resolved values for backward compatibility
      resolved: {
        trainings: trainings.value,
        sightings: sightings.value,
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
        globalValue: null,
        orgValue: null,
      },
      sightings: {
        value: ENV_FEATURE_DEFAULTS.sightings,
        source: 'env' as const,
        adminConfigurable: ENV_FEATURE_DEFAULTS.sightings,
        globalValue: null,
        orgValue: null,
      },
      resolved: ENV_FEATURE_DEFAULTS,
    });
  }
}

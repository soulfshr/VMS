import { NextRequest, NextResponse } from 'next/server';
import { getDbUser } from '@/lib/user';
import { getGlobalSettings, updateGlobalSettings, ENV_FEATURE_DEFAULTS } from '@/lib/global-settings';

/**
 * GET /api/developer/global-settings - Get global settings (DEVELOPER only)
 *
 * Returns the global settings singleton with feature flags and env defaults.
 */
export async function GET() {
  const user = await getDbUser();

  if (!user || user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getGlobalSettings();

    return NextResponse.json({
      featureTrainings: settings.featureTrainings,
      featureSightings: settings.featureSightings,
      // Include env defaults so UI can show what null resolves to
      envDefaults: ENV_FEATURE_DEFAULTS,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[Global Settings] Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/developer/global-settings - Update global settings (DEVELOPER only)
 *
 * Accepts partial updates to feature flags.
 * Setting a flag to null reverts to env default.
 */
export async function PATCH(request: NextRequest) {
  const user = await getDbUser();

  if (!user || user.role !== 'DEVELOPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { featureTrainings, featureSightings } = body;

    // Build updates object (only include explicitly set values)
    const updates: {
      featureTrainings?: boolean | null;
      featureSightings?: boolean | null;
    } = {};

    if ('featureTrainings' in body) {
      // Accept boolean or null (null = use env default)
      if (featureTrainings !== null && typeof featureTrainings !== 'boolean') {
        return NextResponse.json(
          { error: 'featureTrainings must be a boolean or null' },
          { status: 400 }
        );
      }
      updates.featureTrainings = featureTrainings;
    }

    if ('featureSightings' in body) {
      if (featureSightings !== null && typeof featureSightings !== 'boolean') {
        return NextResponse.json(
          { error: 'featureSightings must be a boolean or null' },
          { status: 400 }
        );
      }
      updates.featureSightings = featureSightings;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const settings = await updateGlobalSettings(updates);

    console.log(`[Global Settings] Updated by ${user.email}:`, updates);

    return NextResponse.json({
      featureTrainings: settings.featureTrainings,
      featureSightings: settings.featureSightings,
      envDefaults: ENV_FEATURE_DEFAULTS,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[Global Settings] Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update global settings' },
      { status: 500 }
    );
  }
}

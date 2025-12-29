/**
 * Global Settings Service
 *
 * Provides access to app-wide settings stored in the GlobalSettings singleton.
 * These settings apply to all organizations and can be overridden at the org level.
 *
 * Resolution order: orgOverride ?? globalDefault ?? envDefault
 *
 * Feature flag rules:
 * - When global is OFF: only developers can enable per-org
 * - When global is ON: org admins can disable for their org
 */

import { prisma } from './db';

// Type for GlobalSettings model
interface GlobalSettings {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  featureTrainings: boolean | null;
  featureSightings: boolean | null;
}

// Cache for global settings (singleton - rarely changes)
// Note: In serverless environments, each function instance has its own cache.
// Keep TTL short to ensure changes propagate quickly across instances.
let cachedSettings: { settings: GlobalSettings | null; expires: number } | null = null;
const CACHE_TTL = 30 * 1000; // 30 seconds (short for serverless consistency)

// The singleton ID used for GlobalSettings
const GLOBAL_SETTINGS_ID = 'global';

/**
 * Get global settings with caching.
 * Creates the singleton row if it doesn't exist.
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
  // Check cache
  if (cachedSettings && cachedSettings.expires > Date.now() && cachedSettings.settings) {
    return cachedSettings.settings;
  }

  // Fetch or create singleton
  let settings = await prisma.globalSettings.findUnique({
    where: { id: GLOBAL_SETTINGS_ID },
  });

  if (!settings) {
    // Create singleton with null values (use env defaults)
    settings = await prisma.globalSettings.create({
      data: {
        id: GLOBAL_SETTINGS_ID,
        featureTrainings: null,
        featureSightings: null,
      },
    });
  }

  // Update cache
  cachedSettings = { settings, expires: Date.now() + CACHE_TTL };

  return settings;
}

/**
 * Update global settings.
 * Only accepts feature flag fields for now.
 */
export async function updateGlobalSettings(updates: {
  featureTrainings?: boolean | null;
  featureSightings?: boolean | null;
}): Promise<GlobalSettings> {
  const settings = await prisma.globalSettings.upsert({
    where: { id: GLOBAL_SETTINGS_ID },
    update: updates,
    create: {
      id: GLOBAL_SETTINGS_ID,
      ...updates,
    },
  });

  // Invalidate cache
  cachedSettings = null;

  return settings;
}

/**
 * Clear the global settings cache.
 * Useful for testing or after direct database changes.
 */
export function clearGlobalSettingsCache(): void {
  cachedSettings = null;
}

/**
 * Environment variable defaults for feature flags.
 * Used as the final fallback when both global and org settings are null.
 */
export const ENV_FEATURE_DEFAULTS = {
  trainings: process.env.NEXT_PUBLIC_FEATURE_TRAININGS === 'true',
  sightings: process.env.NEXT_PUBLIC_FEATURE_SIGHTINGS === 'true',
};

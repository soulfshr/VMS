/**
 * Feature flags for controlling feature visibility
 *
 * Environment variable defaults (set in Vercel):
 * - NEXT_PUBLIC_FEATURE_TRAININGS=true/false
 * - NEXT_PUBLIC_FEATURE_SIGHTINGS=true/false
 *
 * These can be overridden at runtime via Admin > Settings > Feature Flags
 */

// Static defaults from environment (used for SSR and initial render)
export const FEATURES = {
  trainings: process.env.NEXT_PUBLIC_FEATURE_TRAININGS === 'true',
  sightings: process.env.NEXT_PUBLIC_FEATURE_SIGHTINGS === 'true',
};

export type Features = typeof FEATURES;

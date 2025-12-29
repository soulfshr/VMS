'use client';

import { useState, useEffect } from 'react';
import { FEATURES, type Features } from '@/lib/features';

type FeatureSource = 'org' | 'global' | 'env';

export interface FeatureFlag {
  value: boolean;
  source: FeatureSource;
  adminConfigurable: boolean;
  globalValue: boolean | null;
  orgValue: boolean | null;
}

export interface FeaturesWithMetadata {
  trainings: FeatureFlag;
  sightings: FeatureFlag;
  resolved: Features;
}

const DEFAULT_FEATURE_FLAG: FeatureFlag = {
  value: false,
  source: 'env',
  adminConfigurable: false,
  globalValue: null,
  orgValue: null,
};

/**
 * Hook to get feature flags with database override support.
 * Falls back to environment variable defaults during loading or on error.
 *
 * Returns both simple resolved values and detailed metadata.
 */
export function useFeatures(): Features & { isLoading: boolean } {
  const [features, setFeatures] = useState<Features>(FEATURES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatures() {
      try {
        const response = await fetch('/api/features');
        if (response.ok) {
          const data = await response.json();
          // Use resolved values for backward compatibility
          if (data.resolved) {
            setFeatures(data.resolved);
          } else {
            // Fallback for old API format
            setFeatures(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch features, using defaults:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeatures();
  }, []);

  return { ...features, isLoading };
}

/**
 * Hook to get detailed feature flag information including metadata.
 * Use this when you need to know the source of the flag value or admin configurability.
 */
export function useFeaturesWithMetadata(): FeaturesWithMetadata & { isLoading: boolean } {
  const [features, setFeatures] = useState<FeaturesWithMetadata>({
    trainings: { ...DEFAULT_FEATURE_FLAG, value: FEATURES.trainings },
    sightings: { ...DEFAULT_FEATURE_FLAG, value: FEATURES.sightings },
    resolved: FEATURES,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatures() {
      try {
        const response = await fetch('/api/features');
        if (response.ok) {
          const data = await response.json();
          if (data.trainings && data.sightings) {
            setFeatures(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch features, using defaults:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeatures();
  }, []);

  return { ...features, isLoading };
}

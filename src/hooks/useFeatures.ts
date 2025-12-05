'use client';

import { useState, useEffect } from 'react';
import { FEATURES, type Features } from '@/lib/features';

/**
 * Hook to get feature flags with database override support.
 * Falls back to environment variable defaults during loading or on error.
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
          setFeatures(data);
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

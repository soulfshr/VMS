'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DevUser } from '@/types/auth';
import type { DashboardData, UpcomingTraining } from '@/types/dashboard';

interface UseDashboardDataResult {
  user: DevUser | null;
  dashboardData: DashboardData | null;
  upcomingTrainings: UpcomingTraining[];
  sightingCounts: Record<string, number>;
  isLoading: boolean;
  refreshDashboard: () => Promise<void>;
}

export function useDashboardData(featuresTrainings: boolean, featuresLoading: boolean): UseDashboardDataResult {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<DevUser | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sightingCounts, setSightingCounts] = useState<Record<string, number>>({});
  const [upcomingTrainings, setUpcomingTrainings] = useState<UpcomingTraining[]>([]);

  // Main dashboard data fetch
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/dashboard').then(res => {
        if (!res.ok) {
          throw new Error(`Dashboard API returned ${res.status}`);
        }
        return res.json();
      }),
    ])
      .then(([session, data]) => {
        if (!session.user) {
          router.push('/login');
          return;
        }
        if (!data.volunteerStats) {
          console.error('Dashboard data missing volunteerStats:', data);
          router.push('/login');
          return;
        }
        setSessionUser(session.user);
        setDashboardData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Dashboard error:', err);
        router.push('/login');
      });
  }, [router]);

  // Fetch sighting counts for each zone
  useEffect(() => {
    if (!dashboardData?.volunteerStats?.zones) return;

    const fetchSightingCounts = async () => {
      const counts: Record<string, number> = {};
      const today = new Date().toISOString().split('T')[0];

      for (const userZone of dashboardData.volunteerStats.zones) {
        try {
          const res = await fetch(
            `/api/sightings?zoneId=${userZone.zone.id}&date=${today}&status=ACTIVE`
          );
          if (res.ok) {
            const data = await res.json();
            counts[userZone.zone.id] = data.length;
          }
        } catch {
          counts[userZone.zone.id] = 0;
        }
      }
      setSightingCounts(counts);
    };

    fetchSightingCounts();
  }, [dashboardData?.volunteerStats?.zones]);

  // Fetch upcoming trainings when feature is enabled
  useEffect(() => {
    if (!featuresTrainings || featuresLoading) return;

    const fetchUpcomingTrainings = async () => {
      try {
        const res = await fetch('/api/trainings?upcoming=true&limit=3');
        if (res.ok) {
          const data = await res.json();
          setUpcomingTrainings(data.trainings || []);
        }
      } catch (error) {
        console.error('Failed to fetch trainings:', error);
      }
    };

    fetchUpcomingTrainings();
  }, [featuresTrainings, featuresLoading]);

  // Refresh dashboard data
  const refreshDashboard = useCallback(async () => {
    try {
      const data = await fetch('/api/dashboard').then(r => r.json());
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    }
  }, []);

  return {
    user: sessionUser,
    dashboardData,
    upcomingTrainings,
    sightingCounts,
    isLoading,
    refreshDashboard,
  };
}

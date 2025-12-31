'use client';

import { useEffect, useState } from 'react';
import CoverageDashboard from './CoverageDashboard';
import DashboardClient from './DashboardClient';

type SchedulingModel = 'COVERAGE_GRID' | 'SHIFTS';

export default function DashboardSwitcher() {
  const [schedulingModel, setSchedulingModel] = useState<SchedulingModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => {
        setSchedulingModel(data.primarySchedulingModel || 'COVERAGE_GRID');
        setIsLoading(false);
      })
      .catch(() => {
        // Default to coverage grid on error
        setSchedulingModel('COVERAGE_GRID');
        setIsLoading(false);
      });
  }, []);

  if (isLoading || !schedulingModel) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Render the appropriate dashboard based on org's scheduling model
  if (schedulingModel === 'SHIFTS') {
    return <DashboardClient />;
  }

  return <CoverageDashboard />;
}

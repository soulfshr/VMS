'use client';

import Link from 'next/link';
import type { CoordinatorStats, OrgStats, WeekCoverage } from '@/types/dashboard';

// Coverage Summary for Coordinators
interface CoverageSummaryProps {
  coordinatorStats: CoordinatorStats;
}

export function CoverageSummary({ coordinatorStats }: CoverageSummaryProps) {
  if (!coordinatorStats.weeklyCoverage) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200" data-tour="coverage-summary">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">Shift Coverage Summary</h2>
        <Link
          href="/coverage"
          className="text-sm text-cyan-600 hover:text-cyan-700"
        >
          View schedule →
        </Link>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-6">
          <WeekCoverageCard
            title="This Week"
            coverage={coordinatorStats.weeklyCoverage.thisWeek}
          />
          <WeekCoverageCard
            title="Next Week"
            coverage={coordinatorStats.weeklyCoverage.nextWeek}
          />
        </div>
      </div>
    </div>
  );
}

function WeekCoverageCard({ title, coverage }: { title: string; coverage: WeekCoverage }) {
  const colorClass = coverage.coveragePercent >= 80
    ? 'text-green-600'
    : coverage.coveragePercent >= 50
      ? 'text-yellow-600'
      : 'text-red-600';

  const barColorClass = coverage.coveragePercent >= 80
    ? 'bg-green-500'
    : coverage.coveragePercent >= 50
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Coverage</span>
            <span className={`font-medium ${colorClass}`}>
              {coverage.coveragePercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColorClass}`}
              style={{ width: `${coverage.coveragePercent}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 rounded p-2">
            <p className="text-gray-500">Shifts</p>
            <p className="font-semibold text-gray-900">{coverage.totalShifts}</p>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <p className="text-gray-500">Open Slots</p>
            <p className={`font-semibold ${coverage.openSlots > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {coverage.openSlots}
            </p>
          </div>
        </div>
        {coverage.shiftsNeedingHelp > 0 && (
          <p className="text-xs text-red-600">
            ⚠️ {coverage.shiftsNeedingHelp} shift{coverage.shiftsNeedingHelp !== 1 ? 's' : ''} without zone lead
          </p>
        )}
      </div>
    </div>
  );
}

// Organization Overview for Coordinators
interface OrgOverviewProps {
  orgStats: OrgStats;
  showTrainings: boolean;
}

export function OrgOverview({ orgStats, showTrainings }: OrgOverviewProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200" data-tour="coverage-overview">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Organization Overview</h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Total Volunteers</p>
            <p className="text-xl font-bold text-gray-900">{orgStats.totalVolunteers}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Active This Month</p>
            <p className="text-xl font-bold text-gray-900">{orgStats.activeThisMonth}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Zones</p>
            <p className="text-xl font-bold text-gray-900">{orgStats.totalZones}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Scheduled Shifts</p>
            <p className="text-xl font-bold text-gray-900">{orgStats.scheduledShifts}</p>
          </div>
        </div>
        {showTrainings && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Training Compliance</span>
              <span className="text-sm font-medium text-gray-900">{orgStats.trainingCompliance}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 rounded-full"
                style={{ width: `${orgStats.trainingCompliance}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

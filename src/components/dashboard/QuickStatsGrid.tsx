'use client';

import type { VolunteerStats, CoordinatorStats } from '@/types/dashboard';

interface QuickStatsGridProps {
  volunteerStats: VolunteerStats;
  coordinatorStats?: CoordinatorStats;
  isCoordinator: boolean;
  autoConfirmRsvp: boolean;
  showTrainings: boolean;
}

export function QuickStatsGrid({
  volunteerStats,
  coordinatorStats,
  isCoordinator,
  autoConfirmRsvp,
  showTrainings,
}: QuickStatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="quick-stats">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">My Shifts</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.myShifts}</p>
        <p className="text-xs text-gray-500 mt-1">upcoming</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Hours</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.hoursThisMonth}</p>
        <p className="text-xs text-gray-500 mt-1">this month</p>
      </div>
      {isCoordinator && coordinatorStats && !autoConfirmRsvp && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{coordinatorStats.pendingRsvps}</p>
          <p className="text-xs text-gray-500 mt-1">RSVPs</p>
        </div>
      )}
      {!isCoordinator && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">My Zones</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.zones.length}</p>
            <p className="text-xs text-gray-500 mt-1">assigned</p>
          </div>
          {showTrainings && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Training</p>
              <p className="text-2xl font-bold text-cyan-600 mt-1">100%</p>
              <p className="text-xs text-gray-500 mt-1">complete</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

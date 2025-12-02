'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';

interface Zone {
  id: string;
  name: string;
  signalGroup: string | null;
}

interface UserZone {
  isPrimary: boolean;
  zone: Zone;
}

interface Shift {
  id: string;
  type: 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT';
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  zone: Zone;
  userRsvpStatus: string | null;
}

interface CoordinatorStats {
  pendingRsvps: number;
  coverage: {
    full: number;
    partial: number;
    none: number;
    total: number;
  };
  gaps: {
    slotsNeedingDispatcher: number;
    zonesNeedingLeads: number;
  };
  topGaps: Array<{
    slot: string;
    needs: string[];
  }>;
}

interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    zones: UserZone[];
  };
  upcomingShifts: Shift[];
  stats: {
    upcomingShiftCount: number;
    availableShiftCount: number;
    hoursThisMonth: number;
    completedShiftCount: number;
    trainingProgress: number;
  };
  zoneStats: {
    zone: Zone;
    volunteerCount: number;
    shiftsThisWeek: number;
  } | null;
  coordinatorStats: CoordinatorStats | null;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  PATROL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COLLECTION: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ON_CALL_FIELD_SUPPORT: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const typeLabels: Record<string, string> = {
  PATROL: 'PATROL',
  COLLECTION: 'COLLECTION',
  ON_CALL_FIELD_SUPPORT: 'ON-CALL',
};

export default function DashboardPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<DevUser | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/dashboard').then(res => res.json()),
    ])
      .then(([sessionData, dashboard]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        setSessionUser(sessionData.user);
        if (!dashboard.error) {
          setDashboardData(dashboard);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const opts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return `${start.toLocaleTimeString('en-US', opts)} - ${end.toLocaleTimeString('en-US', opts)}`;
  };

  const getNextShiftText = () => {
    if (!dashboardData?.upcomingShifts.length) return 'None scheduled';
    const next = dashboardData.upcomingShifts[0];
    const date = new Date(next.date);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return formatDate(next.date);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sessionUser) return null;

  const roleColors: Record<string, string> = {
    ADMINISTRATOR: 'bg-purple-100 text-purple-700',
    COORDINATOR: 'bg-blue-100 text-blue-700',
    DISPATCHER: 'bg-orange-100 text-orange-700',
    VOLUNTEER: 'bg-teal-100 text-teal-700',
  };

  const stats = dashboardData?.stats;
  const zoneStats = dashboardData?.zoneStats;
  const coordinatorStats = dashboardData?.coordinatorStats;
  const primaryZone = dashboardData?.user.zones.find(uz => uz.isPrimary)?.zone;
  const isCoordinator = sessionUser.role === 'COORDINATOR' || sessionUser.role === 'ADMINISTRATOR';

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {sessionUser.name}!
          </h1>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[sessionUser.role]}`}>
              {sessionUser.role}
            </span>
            {primaryZone && (
              <span className="text-gray-500">• {primaryZone.name}</span>
            )}
          </div>
        </div>

        {/* Coordinator Staffing Overview - HERO SECTION */}
        {isCoordinator && coordinatorStats && (
          <div className="mb-8 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Left: Title and Summary */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">This Week&apos;s Coverage</h2>
                  {coordinatorStats.pendingRsvps > 0 && (
                    <Link
                      href="/shifts?pending=true"
                      className="px-3 py-1 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
                    >
                      {coordinatorStats.pendingRsvps} pending RSVP{coordinatorStats.pendingRsvps > 1 ? 's' : ''}
                    </Link>
                  )}
                </div>
                <p className="text-gray-500 text-sm">
                  {coordinatorStats.coverage.total} time slots scheduled •
                  {coordinatorStats.gaps.slotsNeedingDispatcher + coordinatorStats.gaps.zonesNeedingLeads > 0
                    ? ` ${coordinatorStats.gaps.slotsNeedingDispatcher + coordinatorStats.gaps.zonesNeedingLeads} gaps to fill`
                    : ' All positions filled!'}
                </p>
              </div>

              {/* Center: Coverage Stats */}
              <div className="flex gap-4">
                <div className="text-center px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-3xl font-bold text-green-600">{coordinatorStats.coverage.full}</p>
                  <p className="text-xs text-gray-500">Full</p>
                </div>
                <div className="text-center px-4 py-2 bg-yellow-50 rounded-xl border border-yellow-200">
                  <p className="text-3xl font-bold text-yellow-600">{coordinatorStats.coverage.partial}</p>
                  <p className="text-xs text-gray-500">Partial</p>
                </div>
                <div className="text-center px-4 py-2 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-3xl font-bold text-red-600">{coordinatorStats.coverage.none}</p>
                  <p className="text-xs text-gray-500">None</p>
                </div>
              </div>

              {/* Right: Quick Action */}
              <Link
                href="/schedule"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-colors shadow-md"
              >
                View Schedule
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Gap Alerts Row */}
            {(coordinatorStats.gaps.slotsNeedingDispatcher > 0 || coordinatorStats.gaps.zonesNeedingLeads > 0 || coordinatorStats.topGaps.length > 0) && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <div className="flex flex-wrap gap-3">
                  {coordinatorStats.gaps.slotsNeedingDispatcher > 0 && (
                    <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-amber-700 text-sm font-medium">
                        {coordinatorStats.gaps.slotsNeedingDispatcher} shift{coordinatorStats.gaps.slotsNeedingDispatcher > 1 ? 's' : ''} need dispatcher
                      </span>
                    </div>
                  )}
                  {coordinatorStats.gaps.zonesNeedingLeads > 0 && (
                    <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-amber-700 text-sm font-medium">
                        {coordinatorStats.gaps.zonesNeedingLeads} shift{coordinatorStats.gaps.zonesNeedingLeads > 1 ? 's' : ''} need zone leads
                      </span>
                    </div>
                  )}
                  {coordinatorStats.topGaps.slice(0, 3).map((gap, i) => (
                    <div key={i} className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-gray-700 text-sm">
                        <span className="font-medium">{gap.slot}</span>
                        <span className="text-gray-500"> – {gap.needs.join(', ')}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Upcoming Shifts</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.upcomingShiftCount || 0}</p>
            <p className="text-xs text-teal-600 mt-1">Next: {getNextShiftText()}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Hours This Month</p>
            <p className="text-3xl font-bold text-gray-900">{stats?.hoursThisMonth || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{stats?.completedShiftCount || 0} shifts completed</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Training Status</p>
            <p className={`text-3xl font-bold ${stats?.trainingProgress === 100 ? 'text-teal-600' : 'text-orange-600'}`}>
              {stats?.trainingProgress || 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.trainingProgress === 100 ? 'All required complete' : 'In progress'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Available Shifts</p>
            <p className="text-3xl font-bold text-teal-600">{stats?.availableShiftCount || 0}</p>
            <p className="text-xs text-teal-600 mt-1">Open for signup</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* My Upcoming Shifts */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">My Upcoming Shifts</h2>
              <Link href="/shifts" className="text-sm text-teal-600 hover:text-teal-700">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {dashboardData?.upcomingShifts.length ? (
                dashboardData.upcomingShifts.map(shift => (
                  <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{shift.title} - {shift.zone.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(shift.date)} • {formatTime(shift.startTime, shift.endTime)}
                        </p>
                        {shift.userRsvpStatus === 'PENDING' && (
                          <p className="text-xs text-yellow-600 mt-1">Pending confirmation</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${typeColors[shift.type].bg} ${typeColors[shift.type].text}`}>
                        {typeLabels[shift.type]}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 mb-4">No upcoming shifts scheduled</p>
                  <Link
                    href="/shifts"
                    className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                  >
                    Browse Available Shifts
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/shifts"
                  className="block p-3 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                >
                  <span className="font-medium">Browse Available Shifts</span>
                  <p className="text-xs text-teal-600 mt-0.5">
                    {stats?.availableShiftCount || 0} shifts open
                  </p>
                </Link>
                <Link
                  href="/profile"
                  className="block p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">Update Availability</span>
                  <p className="text-xs text-gray-500 mt-0.5">Set your schedule preferences</p>
                </Link>
                <Link
                  href="/training"
                  className="block p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">View Training</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {stats?.trainingProgress === 100 ? 'All modules completed' : 'Continue training'}
                  </p>
                </Link>
              </div>
            </div>

            {/* Zone Info */}
            {zoneStats && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900 mb-3">Your Zone: {zoneStats.zone.name}</h2>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>• {zoneStats.volunteerCount} volunteers assigned</p>
                  <p>• {zoneStats.shiftsThisWeek} shifts this week</p>
                  {zoneStats.zone.signalGroup && <p>• Signal group active</p>}
                </div>
                {zoneStats.zone.signalGroup && (
                  <a
                    href={zoneStats.zone.signalGroup}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium inline-block text-center"
                  >
                    Open Zone Signal Group
                  </a>
                )}
              </div>
            )}

            {/* Coordinator Quick Actions */}
            {isCoordinator && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900 mb-4">Coordinator Actions</h2>
                <div className="space-y-2">
                  <Link
                    href="/shifts/create"
                    className="block p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-medium">+ Create New Shift</span>
                    <p className="text-xs text-blue-600 mt-0.5">Schedule volunteer shifts</p>
                  </Link>
                  <Link
                    href="/volunteers"
                    className="block p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-medium">Manage Volunteers</span>
                    <p className="text-xs text-gray-500 mt-0.5">View and edit volunteer info</p>
                  </Link>
                  {coordinatorStats && coordinatorStats.pendingRsvps > 0 && (
                    <Link
                      href="/shifts"
                      className="block p-3 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      <span className="font-medium">Review Pending RSVPs</span>
                      <p className="text-xs text-orange-600 mt-0.5">{coordinatorStats.pendingRsvps} awaiting review</p>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

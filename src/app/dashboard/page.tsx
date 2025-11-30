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
  const primaryZone = dashboardData?.user.zones.find(uz => uz.isPrimary)?.zone;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Welcome Header */}
        <div className="mb-8">
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

            {/* Role-specific quick links */}
            {(sessionUser.role === 'COORDINATOR' || sessionUser.role === 'ADMINISTRATOR') && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <h3 className="font-semibold text-blue-800 mb-3">Coordinator Tools</h3>
                <div className="space-y-2">
                  <Link
                    href="/shifts/create"
                    className="block p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium"
                  >
                    + Create New Shift
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

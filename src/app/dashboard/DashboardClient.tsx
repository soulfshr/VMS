'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';
import { hasSeenWelcome } from '@/lib/onboarding';
import { useFeatures } from '@/hooks/useFeatures';

// Dynamic imports to prevent SSR issues with React 19.2.1
const WelcomeScreen = dynamic(
  () => import('@/components/onboarding').then(mod => ({ default: mod.WelcomeScreen })),
  { ssr: false }
);

const GuidedTour = dynamic(
  () => import('@/components/onboarding/GuidedTour'),
  { ssr: false }
);

const ZoneMapModal = dynamic(() => import('@/components/ZoneMapModal'), {
  ssr: false,
});

interface Zone {
  id: string;
  name: string;
  signalGroup: string | null;
}

interface UserZone {
  isPrimary: boolean;
  zone: Zone;
}

interface ZoneStats {
  zone: Zone;
  upcomingShifts: number;
  activeVolunteers: number;
  openSlots: number;
}

interface UpcomingShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    name: string;
  } | null;
  signedUpCount: number;
  minVolunteers: number;
  maxVolunteers: number;
  userRsvp?: {
    status: string;
  } | null;
}

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface VolunteerStats {
  myShifts: number;
  hoursThisMonth: number;
  zones: UserZone[];
  qualifiedRoles: QualifiedRole[];
}

interface CoordinatorStats {
  totalShifts: number;
  pendingRsvps: number;
  activeVolunteers: number;
  needsCoverage: number;
}

interface OrgStats {
  totalVolunteers: number;
  activeThisMonth: number;
  totalZones: number;
  scheduledShifts: number;
  trainingCompliance: number;
}

interface DashboardData {
  upcomingShifts: UpcomingShift[];
  volunteerStats: VolunteerStats;
  coordinatorStats?: CoordinatorStats;
  zoneStats?: ZoneStats;
  orgStats?: OrgStats;
}

interface UpcomingTraining {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  trainingType: {
    name: string;
    color: string;
  } | null;
  currentAttendees: number;
  maxAttendees: number | null;
  userRsvp?: {
    status: string;
  } | null;
}

export default function DashboardClient() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<DevUser | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [sightingCounts, setSightingCounts] = useState<Record<string, number>>({});
  const [sightingsExpanded, setSightingsExpanded] = useState(false);
  const [showZoneMapModal, setShowZoneMapModal] = useState(false);
  const [upcomingTrainings, setUpcomingTrainings] = useState<UpcomingTraining[]>([]);
  const features = useFeatures();

  // Check if user should see welcome screen
  useEffect(() => {
    if (!isLoading && sessionUser && !hasSeenWelcome()) {
      setShowWelcome(true);
    }
  }, [isLoading, sessionUser]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/dashboard').then(res => res.json()),
    ])
      .then(([session, data]) => {
        if (!session.user) {
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
    if (!features.trainings || features.isLoading) return;

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
  }, [features.trainings, features.isLoading]);

  if (isLoading || !sessionUser || !dashboardData) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Handle welcome screen completion
  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  // Show welcome screen if needed
  if (showWelcome) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} userRole={sessionUser.role} userName={sessionUser.name} />;
  }

  const { upcomingShifts, volunteerStats, coordinatorStats, zoneStats, orgStats } = dashboardData;
  const isCoordinator = sessionUser.role === 'COORDINATOR' || sessionUser.role === 'ADMINISTRATOR';
  const isDispatcher = sessionUser.role === 'DISPATCHER' || sessionUser.role === 'ADMINISTRATOR';

  return (
    <>
      {/* Guided Tour */}
      {sessionUser && (
        <GuidedTour
          pageName="dashboard"
          userRole={sessionUser.role}
          autoStart={true}
        />
      )}

    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Welcome Header */}
        <div className="mb-8" data-tour="welcome-header">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {sessionUser.name?.split(' ')[0] || sessionUser.email?.split('@')[0]}!
          </h1>
          <p className="text-gray-600 mt-2">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="quick-stats">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">My Shifts</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.myShifts}</p>
                <p className="text-xs text-gray-400 mt-1">upcoming</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Hours</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.hoursThisMonth}</p>
                <p className="text-xs text-gray-400 mt-1">this month</p>
              </div>
              {isCoordinator && coordinatorStats && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{coordinatorStats.pendingRsvps}</p>
                    <p className="text-xs text-gray-400 mt-1">RSVPs</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Coverage</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{coordinatorStats.needsCoverage}</p>
                    <p className="text-xs text-gray-400 mt-1">need help</p>
                  </div>
                </>
              )}
              {!isCoordinator && (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">My Zones</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{volunteerStats.zones.length}</p>
                    <p className="text-xs text-gray-400 mt-1">assigned</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm text-gray-500">Training</p>
                    <p className="text-2xl font-bold text-teal-600 mt-1">100%</p>
                    <p className="text-xs text-gray-400 mt-1">complete</p>
                  </div>
                </>
              )}
            </div>

            {/* Upcoming Shifts */}
            <div className="bg-white rounded-xl border border-gray-200" data-tour="upcoming-shifts">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="font-semibold text-gray-900">Upcoming Shifts</h2>
                <Link
                  href="/shifts"
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-gray-100">
                {upcomingShifts.length > 0 ? (
                  upcomingShifts.slice(0, 5).map((shift) => (
                    <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: shift.shiftType?.color || '#14b8a6' }}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{shift.shiftType?.name || 'Shift'}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(shift.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })} • {new Date(shift.startTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'America/New_York'
                              })} - {new Date(shift.endTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'America/New_York'
                              })}
                              {shift.zone && ` • ${shift.zone.name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {shift.signedUpCount}/{shift.maxVolunteers}
                          </span>
                          {shift.userRsvp ? (
                            <span className={`px-2 py-1 text-xs rounded ${
                              shift.userRsvp.status === 'CONFIRMED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {shift.userRsvp.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                            </span>
                          ) : (
                            <Link
                              href={`/shifts/${shift.id}`}
                              className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                            >
                              Sign Up
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No upcoming shifts</p>
                    <Link
                      href="/shifts"
                      className="text-teal-600 hover:text-teal-700 text-sm mt-2 inline-block"
                    >
                      Browse available shifts →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4" data-tour="quick-actions">
              <Link
                href="/shifts"
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <h3 className="font-semibold text-gray-900">Browse Shifts</h3>
                <p className="text-sm text-gray-500 mt-1">Find and sign up for shifts</p>
              </Link>

              {isCoordinator && (
                <Link
                  href="/shifts/create"
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl">➕</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">Create Shift</h3>
                  <p className="text-sm text-gray-500 mt-1">Schedule a new shift</p>
                </Link>
              )}

              {!isCoordinator && (
                <Link
                  href="/training"
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl">📚</span>
                  </div>
                  <h3 className="font-semibold text-gray-900">Training</h3>
                  <p className="text-sm text-gray-500 mt-1">View your training status</p>
                </Link>
              )}
            </div>

            {/* Coordinator Coverage Overview */}
            {isCoordinator && orgStats && (
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
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Training Compliance</span>
                      <span className="text-sm font-medium text-gray-900">{orgStats.trainingCompliance}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{ width: `${orgStats.trainingCompliance}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Zone Info Card */}
            {zoneStats && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Zone: {zoneStats.zone.name}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Upcoming Shifts</span>
                    <span className="font-medium">{zoneStats.upcomingShifts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Volunteers</span>
                    <span className="font-medium">{zoneStats.activeVolunteers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Open Slots</span>
                    <span className="font-medium text-orange-600">{zoneStats.openSlots}</span>
                  </div>
                </div>
                <div className="p-4 border-t border-gray-200 space-y-2">
                  {zoneStats.zone.signalGroup && (
                    <a
                      href={zoneStats.zone.signalGroup}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium inline-block text-center"
                    >
                      Open Zone Signal Group
                    </a>
                  )}
                  <button
                    onClick={() => setShowZoneMapModal(true)}
                    className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    View Zone Map
                  </button>
                </div>
              </div>
            )}

            {/* Qualified Roles Card */}
            {volunteerStats.qualifiedRoles && volunteerStats.qualifiedRoles.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">My Qualified Roles</h3>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {volunteerStats.qualifiedRoles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: `${role.color}20`,
                          color: role.color,
                          border: `1px solid ${role.color}40`,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    These roles determine which shift positions you can fill.
                  </p>
                </div>
              </div>
            )}

            {/* ICE Sightings Card - controlled by feature flag */}
            {features.sightings && volunteerStats.zones.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200">
                <button
                  onClick={() => setSightingsExpanded(!sightingsExpanded)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚨</span>
                    <h3 className="font-semibold text-gray-900">ICE Sightings Today</h3>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${sightingsExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {sightingsExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="p-4 space-y-3">
                      {volunteerStats.zones.map((userZone) => (
                        <div key={userZone.zone.id} className="flex justify-between items-center">
                          <span className="text-gray-600">{userZone.zone.name}</span>
                          <span className={`font-medium ${
                            (sightingCounts[userZone.zone.id] || 0) > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {sightingCounts[userZone.zone.id] || 0} active
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-gray-200">
                      <Link
                        href="/sightings"
                        className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium inline-block text-center"
                      >
                        Report New Sighting
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dispatcher Quick Access */}
            {isDispatcher && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Dispatcher Tools</h3>
                </div>
                <div className="p-4 space-y-2">
                  <Link
                    href="/schedule"
                    className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium inline-block text-center"
                  >
                    Weekly Schedule
                  </Link>
                </div>
              </div>
            )}

            {/* Upcoming Trainings - controlled by feature flag */}
            {features.trainings && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📚</span>
                    <h3 className="font-semibold text-gray-900">Upcoming Trainings</h3>
                  </div>
                  <Link
                    href="/trainings"
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    View all →
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {upcomingTrainings.length > 0 ? (
                    upcomingTrainings.map((training) => (
                      <Link
                        key={training.id}
                        href={`/trainings/${training.id}`}
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: training.trainingType?.color || '#8b5cf6' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {training.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(training.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })} • {new Date(training.startTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                timeZone: 'America/New_York'
                              })}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-400">
                                {training.currentAttendees}{training.maxAttendees ? `/${training.maxAttendees}` : ''} signed up
                              </span>
                              {training.userRsvp ? (
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  training.userRsvp.status === 'CONFIRMED'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {training.userRsvp.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                                </span>
                              ) : (
                                <span className="text-xs text-teal-600 font-medium">Sign up →</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No upcoming trainings scheduled
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>

    {/* Zone Map Modal */}
    <ZoneMapModal
      isOpen={showZoneMapModal}
      onClose={() => setShowZoneMapModal(false)}
    />
    </>
  );
}

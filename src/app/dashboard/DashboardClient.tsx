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
  shiftStatus: string; // PUBLISHED, CANCELLED, etc.
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
    isZoneLead?: boolean;
    roleName?: string;
    roleColor?: string;
  } | null;
}

interface QualifiedOpening {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  needsZoneLead: boolean;
  spotsRemaining: number;
}

interface QualifiedOpeningsData {
  userZones: QualifiedOpening[];
  otherZones: QualifiedOpening[];
  userQualifications: string[];
}

interface DispatcherSlotOpening {
  county: string;
  date: string;
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  zoneCount: number;
  zones: string[];
}

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface NextShiftTeammate {
  id: string;
  name: string | null;
  qualifiedRole: QualifiedRole | null;
}

interface DispatchCoordinator {
  id: string;
  name: string;
  isPrimary: boolean;
  notes: string | null;
}

interface NextShift {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: {
    name: string;
    color: string;
  } | null;
  zone: {
    id: string;
    name: string;
  } | null;
  userRole?: {
    name: string | null;
    color: string | null;
    isZoneLead: boolean;
  };
  teammates: NextShiftTeammate[];
  dispatchCoordinators: DispatchCoordinator[];
  dispatcher: {
    id: string;
    name: string;
    notes: string | null;
  } | null;
}

interface VolunteerStats {
  myShifts: number;
  hoursThisMonth: number;
  zones: UserZone[];
  qualifiedRoles: QualifiedRole[];
}

interface WeekCoverage {
  totalShifts: number;
  totalSlots: number;
  filledSlots: number;
  openSlots: number;
  shiftsNeedingHelp: number;
  coveragePercent: number;
}

interface CoordinatorStats {
  pendingRsvps: number;
  weeklyCoverage?: {
    thisWeek: WeekCoverage;
    nextWeek: WeekCoverage;
  };
}

interface OrgStats {
  totalVolunteers: number;
  activeThisMonth: number;
  totalZones: number;
  scheduledShifts: number;
  trainingCompliance: number;
}

interface UpcomingDispatcherAssignment {
  id: string;
  county: string;
  date: string;
  startTime: string;
  endTime: string;
  isBackup: boolean;
  notes: string | null;
}

interface RegionalLeadOpening {
  date: string;
  shiftCount: number;
  hasExistingAssignment: boolean;
}

interface UpcomingRegionalLeadAssignment {
  id: string;
  date: string;
  isPrimary: boolean;
  notes: string | null;
}

interface DashboardData {
  upcomingShifts: UpcomingShift[];
  qualifiedOpenings: QualifiedOpeningsData;
  dispatcherSlotOpenings?: DispatcherSlotOpening[];
  dispatcherSchedulingMode?: 'REGIONAL' | 'COUNTY' | 'ZONE';
  upcomingDispatcherAssignments?: UpcomingDispatcherAssignment[];
  regionalLeadOpenings?: RegionalLeadOpening[];
  upcomingRegionalLeadAssignments?: UpcomingRegionalLeadAssignment[];
  volunteerStats: VolunteerStats;
  coordinatorStats?: CoordinatorStats;
  zoneStats?: ZoneStats;
  orgStats?: OrgStats;
  nextShift?: NextShift | null;
  autoConfirmRsvp?: boolean;
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
  const [cancellingShiftId, setCancellingShiftId] = useState<string | null>(null);
  const [cancellingDispatcherId, setCancellingDispatcherId] = useState<string | null>(null);
  const [dismissedShiftIds, setDismissedShiftIds] = useState<Set<string>>(() => {
    // Initialize from localStorage on mount
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dismissedCancelledShifts');
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const features = useFeatures();

  // State for Openings widget
  type OpeningsTab = 'shifts' | 'dispatch' | 'coordinator';
  const [openingsTab, setOpeningsTab] = useState<OpeningsTab>('shifts');
  const [showOtherZones, setShowOtherZones] = useState(false);
  const [showAllZoneLeadOpenings, setShowAllZoneLeadOpenings] = useState(false);
  const [showAllDispatcherSlots, setShowAllDispatcherSlots] = useState(false);
  const [showAllRegionalLeadOpenings, setShowAllRegionalLeadOpenings] = useState(false);
  const [rsvpingOpeningId, setRsvpingOpeningId] = useState<string | null>(null);
  const [claimingSlotKey, setClaimingSlotKey] = useState<string | null>(null);
  const [claimingRegionalLeadDate, setClaimingRegionalLeadDate] = useState<string | null>(null);
  const [cancellingRegionalLeadId, setCancellingRegionalLeadId] = useState<string | null>(null);

  // Dismiss a cancelled shift from the dashboard
  const dismissCancelledShift = (shiftId: string) => {
    setDismissedShiftIds(prev => {
      const next = new Set([...prev, shiftId]);
      // Persist to localStorage
      localStorage.setItem('dismissedCancelledShifts', JSON.stringify([...next]));
      return next;
    });
  };

  // Check if user should see welcome screen
  useEffect(() => {
    if (!isLoading && sessionUser && !hasSeenWelcome()) {
      setShowWelcome(true);
    }
  }, [isLoading, sessionUser]);

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
        // Ensure data has the expected structure
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

  // Handle cancelling a shift RSVP
  const handleCancelRsvp = async (shiftId: string) => {
    if (!confirm('Are you sure you want to cancel your RSVP for this shift?')) {
      return;
    }

    setCancellingShiftId(shiftId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to cancel RSVP');
      }
    } catch (err) {
      console.error('Error cancelling RSVP:', err);
      alert('Failed to cancel RSVP');
    } finally {
      setCancellingShiftId(null);
    }
  };

  // Handle cancelling a dispatcher assignment
  const handleCancelDispatcherAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this dispatcher assignment?')) {
      return;
    }

    setCancellingDispatcherId(assignmentId);
    try {
      const res = await fetch(`/api/dispatcher-assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to cancel assignment');
      }
    } catch (err) {
      console.error('Error cancelling dispatcher assignment:', err);
      alert('Failed to cancel assignment');
    } finally {
      setCancellingDispatcherId(null);
    }
  };

  // Handle quick RSVP from Openings widget
  const handleQuickRsvp = async (shiftId: string, asZoneLead: boolean) => {
    setRsvpingOpeningId(shiftId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asZoneLead }),
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to sign up');
      }
    } catch (err) {
      console.error('Error signing up:', err);
      alert('Failed to sign up');
    } finally {
      setRsvpingOpeningId(null);
    }
  };

  // Handle claiming a dispatcher slot
  const handleClaimDispatcherSlot = async (slot: DispatcherSlotOpening) => {
    const slotKey = `${slot.county}-${slot.date}-${slot.startHour}-${slot.endHour}`;
    setClaimingSlotKey(slotKey);
    try {
      const res = await fetch('/api/dispatcher-assignments/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county: slot.county,
          date: slot.date.split('T')[0], // Extract date portion
          startTime: slot.startTime,
          endTime: slot.endTime,
        }),
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to claim dispatcher slot');
      }
    } catch (err) {
      console.error('Error claiming dispatcher slot:', err);
      alert('Failed to claim dispatcher slot');
    } finally {
      setClaimingSlotKey(null);
    }
  };

  // Handle claiming a regional lead (dispatch coordinator) slot
  const handleClaimRegionalLead = async (dateStr: string) => {
    setClaimingRegionalLeadDate(dateStr);
    try {
      const res = await fetch('/api/regional-lead-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          isPrimary: true, // Default to primary coordinator
        }),
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to claim coordinator slot');
      }
    } catch (err) {
      console.error('Error claiming coordinator slot:', err);
      alert('Failed to claim coordinator slot');
    } finally {
      setClaimingRegionalLeadDate(null);
    }
  };

  // Handle cancelling a regional lead assignment
  const handleCancelRegionalLeadAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this coordinator assignment?')) {
      return;
    }

    setCancellingRegionalLeadId(assignmentId);
    try {
      const res = await fetch(`/api/regional-lead-assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Refresh dashboard data
        const data = await fetch('/api/dashboard').then(r => r.json());
        setDashboardData(data);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to cancel assignment');
      }
    } catch (err) {
      console.error('Error cancelling coordinator assignment:', err);
      alert('Failed to cancel assignment');
    } finally {
      setCancellingRegionalLeadId(null);
    }
  };

  // Auto-select first available tab when data loads
  // Priority: Dispatch (highest priority) → Shifts (Zone Lead) → Coordinator
  useEffect(() => {
    if (!dashboardData) return;

    const { qualifiedOpenings, dispatcherSlotOpenings, regionalLeadOpenings } = dashboardData;
    const hasShifts = qualifiedOpenings && (qualifiedOpenings.userZones.length > 0 || qualifiedOpenings.otherZones.length > 0);
    const hasDispatch = dispatcherSlotOpenings && dispatcherSlotOpenings.length > 0;
    const hasCoord = regionalLeadOpenings && regionalLeadOpenings.length > 0;

    // Dispatch is highest priority
    if (hasDispatch) {
      setOpeningsTab('dispatch');
    } else if (hasShifts) {
      setOpeningsTab('shifts');
    } else if (hasCoord) {
      setOpeningsTab('coordinator');
    }
  }, [dashboardData]);

  if (isLoading || !sessionUser || !dashboardData) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
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

  const { upcomingShifts, qualifiedOpenings, dispatcherSlotOpenings, dispatcherSchedulingMode, upcomingDispatcherAssignments, regionalLeadOpenings, upcomingRegionalLeadAssignments, volunteerStats, coordinatorStats, zoneStats, orgStats, nextShift, autoConfirmRsvp } = dashboardData;
  // Harmonize COORDINATOR and DISPATCHER - both have leadership access
  const isLeader = sessionUser.role === 'COORDINATOR' || sessionUser.role === 'DISPATCHER' || sessionUser.role === 'ADMINISTRATOR';
  const isCoordinator = isLeader; // For backward compatibility
  const isDispatcher = isLeader;  // For backward compatibility

  // Helper to get role color from qualifications
  const getRoleColor = (roleSlug: string): string => {
    const role = volunteerStats.qualifiedRoles?.find(r => r.slug === roleSlug);
    return role?.color || '#6b7280'; // gray fallback
  };

  // Create unified list of all upcoming assignments
  type UnifiedAssignment = {
    type: 'shift' | 'dispatcher' | 'coordinator';
    id: string;
    date: Date;
    sortKey: number;
    data: UpcomingShift | UpcomingDispatcherAssignment | UpcomingRegionalLeadAssignment;
  };

  const unifiedAssignments: UnifiedAssignment[] = [
    // Regular shifts
    ...upcomingShifts
      .filter(s => !dismissedShiftIds.has(s.id))
      .map(s => ({
        type: 'shift' as const,
        id: `shift-${s.id}`,
        date: new Date(s.date),
        sortKey: new Date(s.startTime).getTime(),
        data: s,
      })),
    // Dispatcher assignments
    ...(upcomingDispatcherAssignments || []).map(a => ({
      type: 'dispatcher' as const,
      id: `dispatcher-${a.id}`,
      date: new Date(a.date),
      sortKey: new Date(a.startTime).getTime(),
      data: a,
    })),
    // Coordinator assignments
    ...(upcomingRegionalLeadAssignments || []).map(a => ({
      type: 'coordinator' as const,
      id: `coordinator-${a.id}`,
      date: new Date(a.date),
      sortKey: new Date(a.date).getTime(), // Coordinators are all-day, use date
      data: a,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);

  // Check which openings tabs have data
  const hasShiftOpenings = qualifiedOpenings && (qualifiedOpenings.userZones.length > 0 || qualifiedOpenings.otherZones.length > 0);
  const hasDispatcherOpenings = dispatcherSlotOpenings && dispatcherSlotOpenings.length > 0;
  const hasCoordinatorOpenings = regionalLeadOpenings && regionalLeadOpenings.length > 0;
  const hasAnyOpenings = hasShiftOpenings || hasDispatcherOpenings || hasCoordinatorOpenings;

  // Counts for tab badges
  const shiftOpeningsCount = (qualifiedOpenings?.userZones.length || 0) + (qualifiedOpenings?.otherZones.length || 0);
  const dispatcherOpeningsCount = dispatcherSlotOpenings?.length || 0;
  const coordinatorOpeningsCount = regionalLeadOpenings?.length || 0;

  // Get footer link based on active tab
  const getOpeningsFooterLink = () => {
    // All tabs link to the main schedule page
    return '/schedule';
  };

  const getOpeningsFooterText = () => {
    return 'View full schedule';
  };

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
                  {features.trainings && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm text-gray-500">Training</p>
                      <p className="text-2xl font-bold text-cyan-600 mt-1">100%</p>
                      <p className="text-xs text-gray-500 mt-1">complete</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Your Next Shift Widget */}
            {nextShift && (
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200" data-tour="next-shift">
                <div className="p-4 border-b border-cyan-200/50 flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <h2 className="font-semibold text-gray-900">Your Next Shift</h2>
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: nextShift.shiftType?.color || '#14b8a6' }}
                        />
                        <span className="font-semibold text-gray-900 text-lg">
                          {nextShift.shiftType?.name || nextShift.title}
                        </span>
                        {nextShift.userRole && nextShift.userRole.color && (
                          <span
                            className="px-2 py-0.5 text-xs rounded-full font-medium"
                            style={{
                              backgroundColor: `${nextShift.userRole.color}20`,
                              color: nextShift.userRole.color,
                            }}
                          >
                            {nextShift.userRole.name}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-600 mb-3">
                        <span className="font-medium">
                          {new Date(nextShift.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'America/New_York'
                          })}
                        </span>
                        <span className="mx-2">•</span>
                        <span>
                          {new Date(nextShift.startTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZone: 'America/New_York'
                          })} - {new Date(nextShift.endTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZone: 'America/New_York'
                          })}
                        </span>
                        {nextShift.zone && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{nextShift.zone.name}</span>
                          </>
                        )}
                      </div>
                      {/* Teammates Section */}
                      {nextShift.teammates.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-2">
                          Your teammates ({nextShift.teammates.length})
                        </p>
                          <div className="flex flex-wrap gap-2">
                            {nextShift.teammates.map((teammate) => {
                              const displayName = teammate.name || 'Unknown';
                              return (
                              <div
                                key={teammate.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-sm border border-gray-200"
                              >
                                <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                  {displayName.charAt(0)}
                                </span>
                                <span className="text-gray-700">{displayName.split(' ')[0]}</span>
                                {teammate.qualifiedRole && (
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: teammate.qualifiedRole.color }}
                                    title={teammate.qualifiedRole.name}
                                  />
                                )}
                              </div>
                              );
                            })}
                          </div>
                      </div>
                      )}
                      {/* Dispatch Support Section */}
                      {(nextShift.dispatchCoordinators.length > 0 || nextShift.dispatcher) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">Shift Support</p>
                          <div className="space-y-1.5">
                            {nextShift.dispatchCoordinators.length > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Coordinator{nextShift.dispatchCoordinators.length > 1 ? 's' : ''}:</span>{' '}
                                {nextShift.dispatchCoordinators.map((c, i) => (
                                  <span key={c.id}>
                                    {i > 0 && ', '}
                                    {c.name}
                                    {c.isPrimary && <span className="text-amber-500 ml-0.5">★</span>}
                                    {c.notes && <span className="text-gray-400 text-xs ml-1">({c.notes})</span>}
                                  </span>
                                ))}
                              </p>
                            )}
                            {nextShift.dispatcher && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Dispatcher:</span> {nextShift.dispatcher.name}
                                {nextShift.dispatcher.notes && (
                                  <span className="text-gray-400 text-xs ml-1">({nextShift.dispatcher.notes})</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Shifts - Unified table with role badges */}
            <div className="bg-white rounded-xl border border-gray-200" data-tour="upcoming-shifts">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">My Upcoming Schedule</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {unifiedAssignments.length > 0 ? (
                  unifiedAssignments.slice(0, 8).map((assignment) => {
                    // Render based on type
                    if (assignment.type === 'shift') {
                      const shift = assignment.data as UpcomingShift;
                      const isCancelled = shift.shiftStatus === 'CANCELLED';
                      const roleColor = shift.userRsvp?.roleColor || '#14b8a6';
                      const roleName = shift.userRsvp?.roleName || 'Volunteer';
                      return (
                        <div key={assignment.id} className={`p-4 transition-colors ${isCancelled ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-3 h-3 rounded-full ${isCancelled ? 'bg-red-400' : ''}`}
                                style={{ backgroundColor: isCancelled ? undefined : (shift.shiftType?.color || '#14b8a6') }}
                              />
                              <div>
                                <p className={`font-medium ${isCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                  {shift.shiftType?.name || 'Shift'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(shift.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'America/New_York'
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
                              {isCancelled ? (
                                <div className="flex items-center gap-1">
                                  <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
                                    Cancelled
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      dismissCancelledShift(shift.id);
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Remove from dashboard"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : shift.userRsvp ? (
                                <div className="flex items-center gap-1">
                                  {/* Role badge with qualification color */}
                                  <span
                                    className="px-2 py-1 text-xs rounded font-medium inline-flex items-center gap-1"
                                    style={{
                                      backgroundColor: `${roleColor}20`,
                                      color: roleColor,
                                      border: `1px solid ${roleColor}40`,
                                    }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: roleColor }}
                                    />
                                    {roleName}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleCancelRsvp(shift.id);
                                    }}
                                    disabled={cancellingShiftId === shift.id}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                    title="Cancel RSVP"
                                  >
                                    {cancellingShiftId === shift.id ? (
                                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <Link
                                  href={`/shifts/${shift.id}`}
                                  className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700"
                                >
                                  Sign Up
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else if (assignment.type === 'dispatcher') {
                      const dispatchAssignment = assignment.data as UpcomingDispatcherAssignment;
                      const isRegional = dispatchAssignment.county === 'REGIONAL';
                      const dispatcherColor = getRoleColor('DISPATCHER');
                      return (
                        <div key={assignment.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: dispatcherColor }}
                              />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {isRegional ? 'Regional Dispatcher' : `${dispatchAssignment.county} County Dispatcher`}
                                  {dispatchAssignment.isBackup && <span className="text-xs text-gray-400 ml-2">(Backup)</span>}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(dispatchAssignment.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'America/New_York'
                                  })} • {new Date(dispatchAssignment.startTime).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    timeZone: 'America/New_York'
                                  })} - {new Date(dispatchAssignment.endTime).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    timeZone: 'America/New_York'
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Dispatcher badge with qualification color */}
                              <span
                                className="px-2 py-1 text-xs rounded font-medium inline-flex items-center gap-1"
                                style={{
                                  backgroundColor: `${dispatcherColor}20`,
                                  color: dispatcherColor,
                                  border: `1px solid ${dispatcherColor}40`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: dispatcherColor }}
                                />
                                Dispatcher
                              </span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelDispatcherAssignment(dispatchAssignment.id);
                                }}
                                disabled={cancellingDispatcherId === dispatchAssignment.id}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Cancel assignment"
                              >
                                {cancellingDispatcherId === dispatchAssignment.id ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Coordinator
                      const coordAssignment = assignment.data as UpcomingRegionalLeadAssignment;
                      const coordinatorColor = getRoleColor('REGIONAL_LEAD');
                      return (
                        <div key={assignment.id} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: coordinatorColor }}
                              />
                              <div>
                                <p className="font-medium text-gray-900">
                                  Dispatch Coordinator
                                  {coordAssignment.isPrimary && <span style={{ color: coordinatorColor }} className="ml-1">★</span>}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(coordAssignment.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'America/New_York'
                                  })} • All day
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Coordinator badge with qualification color */}
                              <span
                                className="px-2 py-1 text-xs rounded font-medium inline-flex items-center gap-1"
                                style={{
                                  backgroundColor: `${coordinatorColor}20`,
                                  color: coordinatorColor,
                                  border: `1px solid ${coordinatorColor}40`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: coordinatorColor }}
                                />
                                Coordinator
                              </span>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelRegionalLeadAssignment(coordAssignment.id);
                                }}
                                disabled={cancellingRegionalLeadId === coordAssignment.id}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Cancel assignment"
                              >
                                {cancellingRegionalLeadId === coordAssignment.id ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p>No upcoming shifts or assignments</p>
                    <Link
                      href="/shifts"
                      className="text-cyan-600 hover:text-cyan-700 text-sm mt-2 inline-block"
                    >
                      Manage shifts →
                    </Link>
                  </div>
                )}
              </div>
            </div>


            {/* Shift Coverage Summary for Coordinators/Dispatchers */}
            {(isCoordinator || isDispatcher) && coordinatorStats?.weeklyCoverage && (
              <div className="bg-white rounded-xl border border-gray-200" data-tour="coverage-summary">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="font-semibold text-gray-900">Shift Coverage Summary</h2>
                  <Link
                    href="/schedule"
                    className="text-sm text-cyan-600 hover:text-cyan-700"
                  >
                    View schedule →
                  </Link>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* This Week */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">This Week</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Coverage</span>
                            <span className={`font-medium ${
                              coordinatorStats.weeklyCoverage.thisWeek.coveragePercent >= 80
                                ? 'text-green-600'
                                : coordinatorStats.weeklyCoverage.thisWeek.coveragePercent >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}>
                              {coordinatorStats.weeklyCoverage.thisWeek.coveragePercent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                coordinatorStats.weeklyCoverage.thisWeek.coveragePercent >= 80
                                  ? 'bg-green-500'
                                  : coordinatorStats.weeklyCoverage.thisWeek.coveragePercent >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${coordinatorStats.weeklyCoverage.thisWeek.coveragePercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-gray-500">Shifts</p>
                            <p className="font-semibold text-gray-900">{coordinatorStats.weeklyCoverage.thisWeek.totalShifts}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-gray-500">Open Slots</p>
                            <p className={`font-semibold ${coordinatorStats.weeklyCoverage.thisWeek.openSlots > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {coordinatorStats.weeklyCoverage.thisWeek.openSlots}
                            </p>
                          </div>
                        </div>
                        {coordinatorStats.weeklyCoverage.thisWeek.shiftsNeedingHelp > 0 && (
                          <p className="text-xs text-red-600">
                            ⚠️ {coordinatorStats.weeklyCoverage.thisWeek.shiftsNeedingHelp} shift{coordinatorStats.weeklyCoverage.thisWeek.shiftsNeedingHelp !== 1 ? 's' : ''} without zone lead
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Next Week */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Next Week</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Coverage</span>
                            <span className={`font-medium ${
                              coordinatorStats.weeklyCoverage.nextWeek.coveragePercent >= 80
                                ? 'text-green-600'
                                : coordinatorStats.weeklyCoverage.nextWeek.coveragePercent >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}>
                              {coordinatorStats.weeklyCoverage.nextWeek.coveragePercent}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                coordinatorStats.weeklyCoverage.nextWeek.coveragePercent >= 80
                                  ? 'bg-green-500'
                                  : coordinatorStats.weeklyCoverage.nextWeek.coveragePercent >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${coordinatorStats.weeklyCoverage.nextWeek.coveragePercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-gray-500">Shifts</p>
                            <p className="font-semibold text-gray-900">{coordinatorStats.weeklyCoverage.nextWeek.totalShifts}</p>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-gray-500">Open Slots</p>
                            <p className={`font-semibold ${coordinatorStats.weeklyCoverage.nextWeek.openSlots > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              {coordinatorStats.weeklyCoverage.nextWeek.openSlots}
                            </p>
                          </div>
                        </div>
                        {coordinatorStats.weeklyCoverage.nextWeek.shiftsNeedingHelp > 0 && (
                          <p className="text-xs text-red-600">
                            ⚠️ {coordinatorStats.weeklyCoverage.nextWeek.shiftsNeedingHelp} shift{coordinatorStats.weeklyCoverage.nextWeek.shiftsNeedingHelp !== 1 ? 's' : ''} without zone lead
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                  {features.trainings && (
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
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Unified Openings Widget with Tabs */}
            {hasAnyOpenings && (
              <div className="bg-white rounded-xl border border-gray-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎯</span>
                    <h3 className="font-semibold text-gray-900">Openings for You</h3>
                  </div>
                  <p className="text-xs text-gray-500">Based on your qualifications</p>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-gray-200 overflow-x-auto">
                  {hasShiftOpenings && (
                    <button
                      onClick={() => setOpeningsTab('shifts')}
                      className={`flex-1 min-w-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        openingsTab === 'shifts'
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Zone Lead
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                        openingsTab === 'shifts' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {shiftOpeningsCount}
                      </span>
                    </button>
                  )}
                  {hasDispatcherOpenings && (
                    <button
                      onClick={() => setOpeningsTab('dispatch')}
                      className={`flex-1 min-w-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        openingsTab === 'dispatch'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Dispatch
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                        openingsTab === 'dispatch' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {dispatcherOpeningsCount}
                      </span>
                    </button>
                  )}
                  {hasCoordinatorOpenings && (
                    <button
                      onClick={() => setOpeningsTab('coordinator')}
                      className={`flex-1 min-w-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        openingsTab === 'coordinator'
                          ? 'border-amber-500 text-amber-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Coordinator
                      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                        openingsTab === 'coordinator' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {coordinatorOpeningsCount}
                      </span>
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                <div className="divide-y divide-gray-100">
                  {/* Shifts Tab Content */}
                  {openingsTab === 'shifts' && hasShiftOpenings && qualifiedOpenings && (
                    <>
                      {/* User's zones - show first 3 by default */}
                      {qualifiedOpenings.userZones.length > 0 && (
                        <>
                          {(showAllZoneLeadOpenings ? qualifiedOpenings.userZones : qualifiedOpenings.userZones.slice(0, 3)).map((shift) => (
                            <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div
                                  className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                                  style={{ backgroundColor: shift.shiftType?.color || '#14b8a6' }}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">
                                    {shift.shiftType?.name || shift.title}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {new Date(shift.date).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                      timeZone: 'America/New_York'
                                    })} • {new Date(shift.startTime).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      timeZone: 'America/New_York'
                                    })}
                                  </p>
                                  <div className="flex items-center justify-between mt-1">
                                    <span className="text-xs text-gray-400">
                                      {shift.zone?.name}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                      shift.needsZoneLead
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {shift.needsZoneLead ? 'Needs Zone Lead' : `${shift.spotsRemaining} spot${shift.spotsRemaining !== 1 ? 's' : ''}`}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleQuickRsvp(shift.id, shift.needsZoneLead)}
                                    disabled={rsvpingOpeningId === shift.id}
                                    className="mt-2 w-full py-1.5 px-3 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                                  >
                                    {rsvpingOpeningId === shift.id ? 'Signing up...' : 'Sign Up as Zone Lead'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {/* Show more button for user zones */}
                          {qualifiedOpenings.userZones.length > 3 && (
                            <button
                              onClick={() => setShowAllZoneLeadOpenings(!showAllZoneLeadOpenings)}
                              className="w-full p-3 flex items-center justify-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-gray-50 transition-colors"
                            >
                              {showAllZoneLeadOpenings ? (
                                <>Show less</>
                              ) : (
                                <>Show {qualifiedOpenings.userZones.length - 3} more</>
                              )}
                              <svg
                                className={`w-4 h-4 transition-transform ${showAllZoneLeadOpenings ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}

                      {/* Empty state for user zones */}
                      {qualifiedOpenings.userZones.length === 0 && qualifiedOpenings.otherZones.length > 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          No openings in your zones
                        </div>
                      )}

                      {/* Other zones - collapsible */}
                      {qualifiedOpenings.otherZones.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowOtherZones(!showOtherZones)}
                            className="w-full p-3 flex items-center justify-between text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-700">
                              {showOtherZones ? 'Hide' : 'Show'} {qualifiedOpenings.otherZones.length} opening{qualifiedOpenings.otherZones.length !== 1 ? 's' : ''} in other zones
                            </span>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${showOtherZones ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showOtherZones && (
                            <>
                              {qualifiedOpenings.otherZones.map((shift) => (
                                <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                                      style={{ backgroundColor: shift.shiftType?.color || '#14b8a6' }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">
                                        {shift.shiftType?.name || shift.title}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {new Date(shift.date).toLocaleDateString('en-US', {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric',
                                          timeZone: 'America/New_York'
                                        })} • {new Date(shift.startTime).toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          timeZone: 'America/New_York'
                                        })}
                                      </p>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-400">
                                          {shift.zone?.name}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                          shift.needsZoneLead
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}>
                                          {shift.needsZoneLead ? 'Needs Zone Lead' : `${shift.spotsRemaining} spot${shift.spotsRemaining !== 1 ? 's' : ''}`}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleQuickRsvp(shift.id, shift.needsZoneLead)}
                                        disabled={rsvpingOpeningId === shift.id}
                                        className="mt-2 w-full py-1.5 px-3 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                                      >
                                        {rsvpingOpeningId === shift.id ? 'Signing up...' : 'Sign Up as Zone Lead'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Dispatch Tab Content */}
                  {openingsTab === 'dispatch' && hasDispatcherOpenings && dispatcherSlotOpenings && (
                    <>
                      {(showAllDispatcherSlots ? dispatcherSlotOpenings : dispatcherSlotOpenings.slice(0, 3)).map((slot) => {
                        const slotKey = `${slot.county}-${slot.date}-${slot.startHour}-${slot.endHour}`;
                        const formatHour = (hour: number) => {
                          if (hour === 0) return '12am';
                          if (hour === 12) return '12pm';
                          return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
                        };
                        const isRegional = slot.county === 'REGIONAL';
                        return (
                          <div key={slotKey} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 bg-blue-500" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">
                                  {isRegional ? 'Regional Coverage' : `${slot.county} County`}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(slot.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'America/New_York'
                                  })} • {formatHour(slot.startHour)} - {formatHour(slot.endHour)}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Covering {slot.zoneCount} zone{slot.zoneCount !== 1 ? 's' : ''}: {slot.zones.slice(0, 3).join(', ')}{slot.zones.length > 3 ? ` +${slot.zones.length - 3} more` : ''}
                                </p>
                                <button
                                  onClick={() => handleClaimDispatcherSlot(slot)}
                                  disabled={claimingSlotKey === slotKey}
                                  className="mt-2 w-full py-1.5 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  {claimingSlotKey === slotKey ? 'Claiming...' : 'Claim This Slot'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Show more button for dispatcher slots */}
                      {dispatcherSlotOpenings.length > 3 && (
                        <button
                          onClick={() => setShowAllDispatcherSlots(!showAllDispatcherSlots)}
                          className="w-full p-3 flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-gray-50 transition-colors"
                        >
                          {showAllDispatcherSlots ? (
                            <>Show less</>
                          ) : (
                            <>Show {dispatcherSlotOpenings.length - 3} more</>
                          )}
                          <svg
                            className={`w-4 h-4 transition-transform ${showAllDispatcherSlots ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}

                  {/* Coordinator Tab Content */}
                  {openingsTab === 'coordinator' && hasCoordinatorOpenings && regionalLeadOpenings && (
                    <>
                      {(showAllRegionalLeadOpenings ? regionalLeadOpenings : regionalLeadOpenings.slice(0, 3)).map((opening) => (
                        <div key={opening.date} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 bg-amber-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                {new Date(opening.date + 'T12:00:00').toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric',
                                  timeZone: 'America/New_York'
                                })}
                              </p>
                              <p className="text-sm text-gray-500">
                                {opening.shiftCount} shift{opening.shiftCount !== 1 ? 's' : ''} scheduled
                              </p>
                              <button
                                onClick={() => handleClaimRegionalLead(opening.date)}
                                disabled={claimingRegionalLeadDate === opening.date}
                                className="mt-2 w-full py-1.5 px-3 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
                              >
                                {claimingRegionalLeadDate === opening.date ? 'Claiming...' : 'Claim This Day'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* Show more button for coordinator slots */}
                      {regionalLeadOpenings.length > 3 && (
                        <button
                          onClick={() => setShowAllRegionalLeadOpenings(!showAllRegionalLeadOpenings)}
                          className="w-full p-3 flex items-center justify-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-gray-50 transition-colors"
                        >
                          {showAllRegionalLeadOpenings ? (
                            <>Show less</>
                          ) : (
                            <>Show {regionalLeadOpenings.length - 3} more</>
                          )}
                          <svg
                            className={`w-4 h-4 transition-transform ${showAllRegionalLeadOpenings ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Footer link */}
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <Link
                    href={getOpeningsFooterLink()}
                    className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
                  >
                    {getOpeningsFooterText()} →
                  </Link>
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
                    <div className="p-4 border-t border-gray-200 space-y-2">
                      <Link
                        href="/report"
                        className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium inline-block text-center"
                      >
                        Report New Sighting
                      </Link>
                      <Link
                        href="/sightings"
                        className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium inline-block text-center"
                      >
                        View All Sightings
                      </Link>
                    </div>
                  </div>
                )}
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
                    className="text-sm text-cyan-600 hover:text-cyan-700"
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
                                day: 'numeric',
                                timeZone: 'America/New_York'
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
                                <span className="text-xs text-cyan-600 font-medium">Sign up →</span>
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

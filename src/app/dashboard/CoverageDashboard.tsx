'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFeatures } from '@/hooks/useFeatures';

interface Signup {
  id: string;
  date: string;
  startHour: number;
  endHour: number;
  zoneId: string | null;
  zoneName: string | null;
  county: string | null;
  roleType: 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER' | 'DISPATCH_COORDINATOR';
  status: 'CONFIRMED' | 'PENDING';
}

interface Teammate {
  id: string;
  name: string;
  roleType: string;
}

interface NextSlot {
  date: string;
  startHour: number;
  endHour: number;
  zone: { id: string; name: string; county: string | null } | null;
  userRole: 'VERIFIER' | 'ZONE_LEAD' | 'DISPATCHER' | 'DISPATCH_COORDINATOR';
  teammates: Teammate[];
  dispatcher: { id: string; name: string } | null;
  coordinator: { id: string; name: string } | null;
}

interface SlotOpening {
  date: string;
  startHour: number;
  endHour: number;
  zoneId: string | null;
  zoneName: string | null;
  county: string | null;
  roleType: 'ZONE_LEAD' | 'VERIFIER' | 'DISPATCHER' | 'DISPATCH_COORDINATOR';
  spotsRemaining?: number;
}

interface Qualification {
  slug: string;
  name: string;
  color: string;
}

interface RoleStats {
  needed: number;
  filled: number;
}

interface WeekRoleStats {
  zoneLeads: RoleStats;
  dispatchers: RoleStats;
  verifiers: RoleStats;
  coordinators: RoleStats;
}

interface CoverageSummary {
  thisWeek: WeekRoleStats;
  nextWeek: WeekRoleStats;
}

interface DashboardData {
  mySignups: Signup[];
  nextSlot: NextSlot | null;
  stats: {
    slotsThisWeek: number;
    hoursThisWeek: number;
    primaryZone: { id: string; name: string } | null;
    qualifications: Qualification[];
  };
  openings: {
    zoneLeadSlots: SlotOpening[];
    verifierSlots: SlotOpening[];
    dispatcherSlots: SlotOpening[];
    coordinatorSlots: SlotOpening[];
  };
  coverageSummary: CoverageSummary | null;
  autoConfirmRsvp: boolean;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

interface UpcomingTraining {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  spotsRemaining: number;
}

export default function CoverageDashboard() {
  const router = useRouter();
  const features = useFeatures();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingsTab, setOpeningsTab] = useState<'zoneLead' | 'verifier' | 'dispatcher' | 'coordinator'>('zoneLead');
  const [upcomingTrainings, setUpcomingTrainings] = useState<UpcomingTraining[]>([]);
  const [signingUp, setSigningUp] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
    if (features.trainings) {
      fetchTrainings();
    }
  }, [features.trainings]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/dashboard/coverage');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch dashboard');
      }
      const result = await response.json();
      setData(result);

      // Auto-select tab based on available openings and qualifications
      const qualSlugs = result.stats.qualifications.map((q: Qualification) => q.slug);
      if (qualSlugs.includes('ZONE_LEAD') && result.openings.zoneLeadSlots.length > 0) {
        setOpeningsTab('zoneLead');
      } else if (qualSlugs.includes('VERIFIER') && result.openings.verifierSlots.length > 0) {
        setOpeningsTab('verifier');
      } else if (qualSlugs.includes('DISPATCHER') && result.openings.dispatcherSlots.length > 0) {
        setOpeningsTab('dispatcher');
      } else if ((qualSlugs.includes('REGIONAL_LEAD') || qualSlugs.includes('DISPATCH_COORDINATOR')) && result.openings.coordinatorSlots.length > 0) {
        setOpeningsTab('coordinator');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainings = async () => {
    try {
      const response = await fetch('/api/trainings?upcoming=true&limit=3');
      if (response.ok) {
        const result = await response.json();
        setUpcomingTrainings(result.trainings || []);
      }
    } catch {
      // Silently fail - trainings are optional
    }
  };

  const handleSignup = async (opening: SlotOpening) => {
    const key = `${opening.date}-${opening.zoneId}-${opening.startHour}-${opening.roleType}`;
    setSigningUp(key);

    try {
      const response = await fetch('/api/coverage/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: opening.date,
          zoneId: opening.zoneId,
          startHour: opening.startHour,
          endHour: opening.endHour,
          roleType: opening.roleType,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to sign up');
      }

      // Refresh dashboard
      await fetchDashboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setSigningUp(null);
    }
  };

  const handleCancelSignup = async (signupId: string) => {
    if (!confirm('Are you sure you want to cancel this signup?')) return;

    try {
      const response = await fetch(`/api/coverage/signup/${signupId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel signup');
      }

      await fetchDashboard();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  };

  const formatTimeRange = (startHour: number, endHour: number) => {
    return `${formatTime(startHour)}-${formatTime(endHour)}`;
  };

  const formatDate = (dateStr: string) => {
    // Get today and tomorrow as YYYY-MM-DD strings in user's local timezone
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD format

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA');

    // Compare as strings (dateStr is already YYYY-MM-DD from API)
    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';

    // Parse at noon local time to avoid DST edge cases for display
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getRoleBadge = (roleType: string) => {
    switch (roleType) {
      case 'ZONE_LEAD':
        return <span className="text-yellow-600">Zone Lead</span>;
      case 'VERIFIER':
        return <span className="text-green-600">Verifier</span>;
      case 'DISPATCHER':
        return <span className="text-blue-600">Dispatcher</span>;
      case 'DISPATCH_COORDINATOR':
        return <span className="text-purple-600">Coordinator</span>;
      default:
        return <span>{roleType}</span>;
    }
  };

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case 'ZONE_LEAD':
        return '👑';
      case 'VERIFIER':
        return '📋';
      case 'DISPATCHER':
        return '📡';
      case 'DISPATCH_COORDINATOR':
        return '🪄';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-500">{error || 'Failed to load dashboard'}</div>
      </div>
    );
  }

  const isLeader = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'].includes(data.user.role);
  const qualSlugs = data.stats.qualifications.map(q => q.slug);

  // Group signups by date
  const signupsByDate = data.mySignups.reduce((acc, signup) => {
    const key = signup.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(signup);
    return acc;
  }, {} as Record<string, Signup[]>);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {data.user.name?.split(' ')[0] || 'Volunteer'}
        </h1>
        <p className="text-gray-600 mt-1">
          Here&apos;s your coverage schedule and openings
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-cyan-600">{data.stats.slotsThisWeek}</div>
          <div className="text-sm text-gray-600">Slots This Week</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-cyan-600">{data.stats.hoursThisWeek}h</div>
          <div className="text-sm text-gray-600">Hours Committed</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-lg font-semibold text-gray-900 truncate">
            {data.stats.primaryZone?.name || 'No zone'}
          </div>
          <div className="text-sm text-gray-600">My Primary Zone</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-1">
            {data.stats.qualifications.slice(0, 2).map(q => (
              <span
                key={q.slug}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${q.color}20`, color: q.color }}
              >
                {q.name}
              </span>
            ))}
            {data.stats.qualifications.length > 2 && (
              <span className="text-xs text-gray-500">+{data.stats.qualifications.length - 2}</span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">Qualifications</div>
        </div>
      </div>

      {/* Triangle Coverage Summary (Coordinators Only) */}
      {isLeader && data.coverageSummary && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Triangle Coverage Summary</h2>
            <Link
              href="/coverage"
              className="text-sm text-cyan-700 hover:text-cyan-900"
            >
              View Schedule →
            </Link>
          </div>
          <p className="text-xs text-gray-500 mb-4">Filled / needed 2-hour slots across all zones</p>

          <div className="grid grid-cols-2 gap-6">
            {/* This Week */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">This Week</div>
              <div className="space-y-2">
                {/* Zone Leads */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">👑</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Zone Leads</span>
                      <span className={data.coverageSummary.thisWeek.zoneLeads.filled === data.coverageSummary.thisWeek.zoneLeads.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.thisWeek.zoneLeads.filled}/{data.coverageSummary.thisWeek.zoneLeads.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.thisWeek.zoneLeads.needed > 0 &&
                          data.coverageSummary.thisWeek.zoneLeads.filled / data.coverageSummary.thisWeek.zoneLeads.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.thisWeek.zoneLeads.filled / data.coverageSummary.thisWeek.zoneLeads.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.thisWeek.zoneLeads.needed > 0
                            ? Math.round((data.coverageSummary.thisWeek.zoneLeads.filled / data.coverageSummary.thisWeek.zoneLeads.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Dispatchers */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">📡</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Dispatchers</span>
                      <span className={data.coverageSummary.thisWeek.dispatchers.filled === data.coverageSummary.thisWeek.dispatchers.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.thisWeek.dispatchers.filled}/{data.coverageSummary.thisWeek.dispatchers.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.thisWeek.dispatchers.needed > 0 &&
                          data.coverageSummary.thisWeek.dispatchers.filled / data.coverageSummary.thisWeek.dispatchers.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.thisWeek.dispatchers.filled / data.coverageSummary.thisWeek.dispatchers.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.thisWeek.dispatchers.needed > 0
                            ? Math.round((data.coverageSummary.thisWeek.dispatchers.filled / data.coverageSummary.thisWeek.dispatchers.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Verifiers */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Verifiers</span>
                      <span className={data.coverageSummary.thisWeek.verifiers.filled === data.coverageSummary.thisWeek.verifiers.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.thisWeek.verifiers.filled}/{data.coverageSummary.thisWeek.verifiers.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.thisWeek.verifiers.needed > 0 &&
                          data.coverageSummary.thisWeek.verifiers.filled / data.coverageSummary.thisWeek.verifiers.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.thisWeek.verifiers.filled / data.coverageSummary.thisWeek.verifiers.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.thisWeek.verifiers.needed > 0
                            ? Math.round((data.coverageSummary.thisWeek.verifiers.filled / data.coverageSummary.thisWeek.verifiers.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Coordinators */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">🪄</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Coordinators</span>
                      <span className={data.coverageSummary.thisWeek.coordinators.filled === data.coverageSummary.thisWeek.coordinators.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.thisWeek.coordinators.filled}/{data.coverageSummary.thisWeek.coordinators.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.thisWeek.coordinators.needed > 0 &&
                          data.coverageSummary.thisWeek.coordinators.filled / data.coverageSummary.thisWeek.coordinators.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.thisWeek.coordinators.filled / data.coverageSummary.thisWeek.coordinators.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.thisWeek.coordinators.needed > 0
                            ? Math.round((data.coverageSummary.thisWeek.coordinators.filled / data.coverageSummary.thisWeek.coordinators.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Week */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-3">Next Week</div>
              <div className="space-y-2">
                {/* Zone Leads */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">👑</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Zone Leads</span>
                      <span className={data.coverageSummary.nextWeek.zoneLeads.filled === data.coverageSummary.nextWeek.zoneLeads.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.nextWeek.zoneLeads.filled}/{data.coverageSummary.nextWeek.zoneLeads.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.nextWeek.zoneLeads.needed > 0 &&
                          data.coverageSummary.nextWeek.zoneLeads.filled / data.coverageSummary.nextWeek.zoneLeads.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.nextWeek.zoneLeads.filled / data.coverageSummary.nextWeek.zoneLeads.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.nextWeek.zoneLeads.needed > 0
                            ? Math.round((data.coverageSummary.nextWeek.zoneLeads.filled / data.coverageSummary.nextWeek.zoneLeads.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Dispatchers */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">📡</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Dispatchers</span>
                      <span className={data.coverageSummary.nextWeek.dispatchers.filled === data.coverageSummary.nextWeek.dispatchers.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.nextWeek.dispatchers.filled}/{data.coverageSummary.nextWeek.dispatchers.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.nextWeek.dispatchers.needed > 0 &&
                          data.coverageSummary.nextWeek.dispatchers.filled / data.coverageSummary.nextWeek.dispatchers.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.nextWeek.dispatchers.filled / data.coverageSummary.nextWeek.dispatchers.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.nextWeek.dispatchers.needed > 0
                            ? Math.round((data.coverageSummary.nextWeek.dispatchers.filled / data.coverageSummary.nextWeek.dispatchers.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Verifiers */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Verifiers</span>
                      <span className={data.coverageSummary.nextWeek.verifiers.filled === data.coverageSummary.nextWeek.verifiers.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.nextWeek.verifiers.filled}/{data.coverageSummary.nextWeek.verifiers.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.nextWeek.verifiers.needed > 0 &&
                          data.coverageSummary.nextWeek.verifiers.filled / data.coverageSummary.nextWeek.verifiers.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.nextWeek.verifiers.filled / data.coverageSummary.nextWeek.verifiers.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.nextWeek.verifiers.needed > 0
                            ? Math.round((data.coverageSummary.nextWeek.verifiers.filled / data.coverageSummary.nextWeek.verifiers.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Coordinators */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">🪄</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Coordinators</span>
                      <span className={data.coverageSummary.nextWeek.coordinators.filled === data.coverageSummary.nextWeek.coordinators.needed ? 'text-green-600' : 'text-gray-900'}>
                        {data.coverageSummary.nextWeek.coordinators.filled}/{data.coverageSummary.nextWeek.coordinators.needed}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          data.coverageSummary.nextWeek.coordinators.needed > 0 &&
                          data.coverageSummary.nextWeek.coordinators.filled / data.coverageSummary.nextWeek.coordinators.needed >= 0.8
                            ? 'bg-green-500'
                            : data.coverageSummary.nextWeek.coordinators.filled / data.coverageSummary.nextWeek.coordinators.needed >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${data.coverageSummary.nextWeek.coordinators.needed > 0
                            ? Math.round((data.coverageSummary.nextWeek.coordinators.filled / data.coverageSummary.nextWeek.coordinators.needed) * 100)
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Your Next Slot */}
          {data.nextSlot && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm text-cyan-700 font-medium">Your Next Slot</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatDate(data.nextSlot.date)} at {formatTime(data.nextSlot.startHour)}
                  </div>
                  <div className="text-gray-600">
                    {data.nextSlot.zone?.name || 'Regional'} • {formatTimeRange(data.nextSlot.startHour, data.nextSlot.endHour)} • {getRoleBadge(data.nextSlot.userRole)}
                  </div>
                </div>
                <Link
                  href="/coverage"
                  className="text-sm text-cyan-700 hover:text-cyan-900"
                >
                  View Schedule →
                </Link>
              </div>

              {/* Team */}
              <div className="mt-4 pt-4 border-t border-cyan-200">
                <div className="text-sm font-medium text-gray-700 mb-2">Your Team</div>
                <div className="space-y-1">
                  {/* Current user */}
                  <div className="flex items-center gap-2 text-sm">
                    <span>{getRoleIcon(data.nextSlot.userRole)}</span>
                    <span className="font-medium">You</span>
                    <span className="text-gray-500">({data.nextSlot.userRole.replace('_', ' ')})</span>
                  </div>
                  {/* Teammates */}
                  {data.nextSlot.teammates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <span>{getRoleIcon(t.roleType)}</span>
                      <span>{t.name}</span>
                      <span className="text-gray-500">({t.roleType.replace('_', ' ')})</span>
                    </div>
                  ))}
                  {/* Dispatcher */}
                  {data.nextSlot.dispatcher && (
                    <div className="flex items-center gap-2 text-sm text-blue-700">
                      <span>📡</span>
                      <span>{data.nextSlot.dispatcher.name}</span>
                      <span className="text-gray-500">(Dispatcher)</span>
                    </div>
                  )}
                  {/* Coordinator */}
                  {data.nextSlot.coordinator && (
                    <div className="flex items-center gap-2 text-sm text-purple-700">
                      <span>🪄</span>
                      <span>{data.nextSlot.coordinator.name}</span>
                      <span className="text-gray-500">(Coordinator)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* My Upcoming Commitments */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">My Upcoming Commitments</h2>
              <Link
                href="/coverage"
                className="text-sm text-cyan-700 hover:text-cyan-900"
              >
                View Full Schedule →
              </Link>
            </div>

            {data.mySignups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📅</div>
                <p>No upcoming coverage slots</p>
                <p className="text-sm mt-1">Sign up from the openings on the right →</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(signupsByDate).slice(0, 5).map(([date, signups]) => (
                  <div key={date}>
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {formatDate(date)}
                    </div>
                    <div className="space-y-2">
                      {signups.map(signup => (
                        <div
                          key={signup.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getRoleIcon(signup.roleType)}</span>
                            <div>
                              <div className="font-medium text-gray-900">
                                {formatTimeRange(signup.startHour, signup.endHour)} • {signup.zoneName || 'Regional'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {getRoleBadge(signup.roleType)}
                                {signup.status === 'PENDING' && (
                                  <span className="ml-2 text-yellow-600">(Pending)</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancelSignup(signup.id)}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.mySignups.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
                {data.stats.slotsThisWeek} slots • {data.stats.hoursThisWeek} hours this week
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Openings For You */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Openings For You</h2>
              <Link
                href="/coverage"
                className="text-sm text-cyan-700 hover:text-cyan-900"
              >
                Coverage Schedule →
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {qualSlugs.includes('ZONE_LEAD') && (
                <button
                  onClick={() => setOpeningsTab('zoneLead')}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    openingsTab === 'zoneLead'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Zone Lead ({data.openings.zoneLeadSlots.length})
                </button>
              )}
              {qualSlugs.includes('VERIFIER') && (
                <button
                  onClick={() => setOpeningsTab('verifier')}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    openingsTab === 'verifier'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Verifier ({data.openings.verifierSlots.length})
                </button>
              )}
              {qualSlugs.includes('DISPATCHER') && (
                <button
                  onClick={() => setOpeningsTab('dispatcher')}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    openingsTab === 'dispatcher'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Dispatcher ({data.openings.dispatcherSlots.length})
                </button>
              )}
              {(qualSlugs.includes('REGIONAL_LEAD') || qualSlugs.includes('DISPATCH_COORDINATOR')) && (
                <button
                  onClick={() => setOpeningsTab('coordinator')}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    openingsTab === 'coordinator'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Coordinator ({data.openings.coordinatorSlots.length})
                </button>
              )}
            </div>

            {/* Opening list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {openingsTab === 'zoneLead' && data.openings.zoneLeadSlots.map(opening => (
                <OpeningCard
                  key={`${opening.date}-${opening.zoneId}-${opening.startHour}`}
                  opening={opening}
                  onSignup={handleSignup}
                  signingUp={signingUp === `${opening.date}-${opening.zoneId}-${opening.startHour}-${opening.roleType}`}
                  formatDate={formatDate}
                  formatTimeRange={formatTimeRange}
                />
              ))}
              {openingsTab === 'verifier' && data.openings.verifierSlots.map(opening => (
                <OpeningCard
                  key={`${opening.date}-${opening.zoneId}-${opening.startHour}`}
                  opening={opening}
                  onSignup={handleSignup}
                  signingUp={signingUp === `${opening.date}-${opening.zoneId}-${opening.startHour}-${opening.roleType}`}
                  formatDate={formatDate}
                  formatTimeRange={formatTimeRange}
                />
              ))}
              {openingsTab === 'dispatcher' && data.openings.dispatcherSlots.map(opening => (
                <OpeningCard
                  key={`${opening.date}-${opening.zoneId}-${opening.startHour}`}
                  opening={opening}
                  onSignup={handleSignup}
                  signingUp={signingUp === `${opening.date}-${opening.zoneId}-${opening.startHour}-${opening.roleType}`}
                  formatDate={formatDate}
                  formatTimeRange={formatTimeRange}
                />
              ))}
              {openingsTab === 'coordinator' && data.openings.coordinatorSlots.map(opening => (
                <OpeningCard
                  key={`${opening.date}-${opening.startHour}`}
                  opening={opening}
                  onSignup={handleSignup}
                  signingUp={signingUp === `${opening.date}-${opening.zoneId}-${opening.startHour}-${opening.roleType}`}
                  formatDate={formatDate}
                  formatTimeRange={formatTimeRange}
                />
              ))}

              {/* Empty state */}
              {((openingsTab === 'zoneLead' && data.openings.zoneLeadSlots.length === 0) ||
                (openingsTab === 'verifier' && data.openings.verifierSlots.length === 0) ||
                (openingsTab === 'dispatcher' && data.openings.dispatcherSlots.length === 0) ||
                (openingsTab === 'coordinator' && data.openings.coordinatorSlots.length === 0)) && (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No openings available
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              {isLeader && (
                <Link
                  href="/volunteers"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
                >
                  <span>👥</span> Volunteer Directory
                </Link>
              )}
              {isLeader && (
                <Link
                  href="/coordinator"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
                >
                  <span>⚙️</span> Coordinator Console
                </Link>
              )}
              <Link
                href="/settings/profile"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
              >
                <span>👤</span> My Profile
              </Link>
            </div>
          </div>

          {/* Upcoming Trainings */}
          {features.trainings && upcomingTrainings.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Upcoming Trainings</h2>
                <Link
                  href="/trainings"
                  className="text-sm text-cyan-700 hover:text-cyan-900"
                >
                  View All →
                </Link>
              </div>
              <div className="space-y-3">
                {upcomingTrainings.map(training => (
                  <Link
                    key={training.id}
                    href={`/trainings/${training.id}`}
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div className="font-medium text-gray-900 text-sm">{training.title}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {new Date(training.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {training.spotsRemaining > 0 && (
                        <span className="text-green-600 ml-2">{training.spotsRemaining} spots</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function OpeningCard({
  opening,
  onSignup,
  signingUp,
  formatDate,
  formatTimeRange,
}: {
  opening: SlotOpening;
  onSignup: (opening: SlotOpening) => void;
  signingUp: boolean;
  formatDate: (date: string) => string;
  formatTimeRange: (start: number, end: number) => string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <div className="font-medium text-gray-900 text-sm">
          {formatDate(opening.date)}: {formatTimeRange(opening.startHour, opening.endHour)}
        </div>
        <div className="text-xs text-gray-600">
          {opening.zoneName || 'Regional'}
          {opening.spotsRemaining && opening.spotsRemaining > 1 && (
            <span className="text-green-600 ml-2">({opening.spotsRemaining} spots)</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onSignup(opening)}
        disabled={signingUp}
        className="text-sm px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
      >
        {signingUp ? '...' : 'Sign Up'}
      </button>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { hasSeenWelcome } from '@/lib/onboarding';
import { useFeatures } from '@/hooks/useFeatures';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { DispatcherSlotOpening } from '@/types/dashboard';

// Dashboard components
import {
  QuickStatsGrid,
  NextShiftWidget,
  UpcomingScheduleTable,
  OpeningsWidget,
  QualifiedRolesCard,
  SightingsCard,
  TrainingsCard,
  CoverageSummary,
  OrgOverview,
} from '@/components/dashboard';

// Dynamic imports to prevent SSR issues
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

export default function DashboardClient() {
  const features = useFeatures();
  const { user, dashboardData, upcomingTrainings, sightingCounts, isLoading, refreshDashboard } = useDashboardData(
    features.trainings,
    features.isLoading
  );

  // Welcome screen state
  const [showWelcome, setShowWelcome] = useState(false);
  const [showZoneMapModal, setShowZoneMapModal] = useState(false);

  // Dismissed cancelled shifts (persisted in localStorage)
  const [dismissedShiftIds, setDismissedShiftIds] = useState<Set<string>>(() => {
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

  // Action states
  const [cancellingShiftId, setCancellingShiftId] = useState<string | null>(null);
  const [cancellingDispatcherId, setCancellingDispatcherId] = useState<string | null>(null);
  const [cancellingRegionalLeadId, setCancellingRegionalLeadId] = useState<string | null>(null);
  const [rsvpingOpeningId, setRsvpingOpeningId] = useState<string | null>(null);
  const [claimingSlotKey, setClaimingSlotKey] = useState<string | null>(null);
  const [claimingRegionalLeadDate, setClaimingRegionalLeadDate] = useState<string | null>(null);

  // Check if user should see welcome screen
  useEffect(() => {
    if (!isLoading && user && !hasSeenWelcome()) {
      setShowWelcome(true);
    }
  }, [isLoading, user]);

  // Dismiss a cancelled shift
  const dismissCancelledShift = useCallback((shiftId: string) => {
    setDismissedShiftIds(prev => {
      const next = new Set([...prev, shiftId]);
      localStorage.setItem('dismissedCancelledShifts', JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Cancel shift RSVP
  const handleCancelShiftRsvp = useCallback(async (shiftId: string) => {
    if (!confirm('Are you sure you want to cancel your RSVP for this shift?')) return;
    setCancellingShiftId(shiftId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, { method: 'DELETE' });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Cancel dispatcher assignment
  const handleCancelDispatcherAssignment = useCallback(async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this dispatcher assignment?')) return;
    setCancellingDispatcherId(assignmentId);
    try {
      const res = await fetch(`/api/dispatcher-assignments/${assignmentId}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Cancel regional lead assignment
  const handleCancelRegionalLeadAssignment = useCallback(async (assignmentId: string) => {
    if (!confirm('Are you sure you want to cancel this coordinator assignment?')) return;
    setCancellingRegionalLeadId(assignmentId);
    try {
      const res = await fetch(`/api/regional-lead-assignments/${assignmentId}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Quick RSVP for openings
  const handleQuickRsvp = useCallback(async (shiftId: string, asZoneLead: boolean) => {
    setRsvpingOpeningId(shiftId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asZoneLead }),
      });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Claim dispatcher slot
  const handleClaimDispatcherSlot = useCallback(async (slot: DispatcherSlotOpening) => {
    const slotKey = `${slot.county}-${slot.date}-${slot.startHour}-${slot.endHour}`;
    setClaimingSlotKey(slotKey);
    try {
      const res = await fetch('/api/dispatcher-assignments/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          county: slot.county,
          date: slot.date.split('T')[0],
          startTime: slot.startTime,
          endTime: slot.endTime,
        }),
      });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Claim regional lead slot
  const handleClaimRegionalLead = useCallback(async (dateStr: string) => {
    setClaimingRegionalLeadDate(dateStr);
    try {
      const res = await fetch('/api/regional-lead-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, isPrimary: true }),
      });
      if (res.ok) {
        await refreshDashboard();
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
  }, [refreshDashboard]);

  // Loading state
  if (isLoading || !user || !dashboardData) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Welcome screen
  if (showWelcome) {
    return <WelcomeScreen onComplete={() => setShowWelcome(false)} userRole={user.role} userName={user.name} />;
  }

  // Destructure dashboard data
  const {
    upcomingShifts,
    qualifiedOpenings,
    dispatcherSlotOpenings,
    upcomingDispatcherAssignments,
    regionalLeadOpenings,
    upcomingRegionalLeadAssignments,
    volunteerStats,
    coordinatorStats,
    orgStats,
    nextShift,
    autoConfirmRsvp,
    schedulingMode,
  } = dashboardData;

  const isFullSchedulingMode = schedulingMode === 'FULL';
  const isCoordinator = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR'].includes(user.role);

  // Check if openings widget should be shown
  const hasShiftOpenings = qualifiedOpenings && (qualifiedOpenings.userZones.length > 0 || qualifiedOpenings.otherZones.length > 0);
  const hasDispatcherOpenings = isFullSchedulingMode && dispatcherSlotOpenings && dispatcherSlotOpenings.length > 0;
  const hasCoordinatorOpenings = isFullSchedulingMode && regionalLeadOpenings && regionalLeadOpenings.length > 0;
  const hasAnyOpenings = hasShiftOpenings || hasDispatcherOpenings || hasCoordinatorOpenings;

  return (
    <>
      <GuidedTour pageName="dashboard" userRole={user.role} autoStart={true} />

      <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-8" data-tour="welcome-header">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.name?.split(' ')[0] || user.email?.split('@')[0]}!
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
              {/* Quick Stats */}
              <QuickStatsGrid
                volunteerStats={volunteerStats}
                coordinatorStats={coordinatorStats}
                isCoordinator={isCoordinator}
                autoConfirmRsvp={autoConfirmRsvp || false}
                showTrainings={features.trainings}
              />

              {/* Next Shift Widget */}
              {nextShift && <NextShiftWidget nextShift={nextShift} />}

              {/* Upcoming Schedule (exclude next shift if shown above) */}
              <UpcomingScheduleTable
                upcomingShifts={nextShift ? upcomingShifts.filter(s => s.id !== nextShift.id) : upcomingShifts}
                upcomingDispatcherAssignments={upcomingDispatcherAssignments || []}
                upcomingRegionalLeadAssignments={upcomingRegionalLeadAssignments || []}
                dismissedShiftIds={dismissedShiftIds}
                qualifiedRoles={volunteerStats.qualifiedRoles}
                onDismissCancelledShift={dismissCancelledShift}
                onCancelShiftRsvp={handleCancelShiftRsvp}
                onCancelDispatcherAssignment={handleCancelDispatcherAssignment}
                onCancelRegionalLeadAssignment={handleCancelRegionalLeadAssignment}
                cancellingShiftId={cancellingShiftId}
                cancellingDispatcherId={cancellingDispatcherId}
                cancellingRegionalLeadId={cancellingRegionalLeadId}
              />

              {/* Coverage Summary (Coordinators only, FULL mode) */}
              {isFullSchedulingMode && isCoordinator && coordinatorStats && (
                <CoverageSummary coordinatorStats={coordinatorStats} />
              )}

              {/* Org Overview (Coordinators only) */}
              {isCoordinator && orgStats && (
                <OrgOverview orgStats={orgStats} showTrainings={features.trainings} />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Openings Widget */}
              {hasAnyOpenings && (
                <OpeningsWidget
                  qualifiedOpenings={qualifiedOpenings}
                  dispatcherSlotOpenings={dispatcherSlotOpenings}
                  regionalLeadOpenings={regionalLeadOpenings}
                  userZones={volunteerStats.zones}
                  isFullSchedulingMode={isFullSchedulingMode}
                  onQuickRsvp={handleQuickRsvp}
                  onClaimDispatcherSlot={handleClaimDispatcherSlot}
                  onClaimRegionalLead={handleClaimRegionalLead}
                  rsvpingOpeningId={rsvpingOpeningId}
                  claimingSlotKey={claimingSlotKey}
                  claimingRegionalLeadDate={claimingRegionalLeadDate}
                  footerLink={isFullSchedulingMode ? '/coverage' : '/shifts'}
                  footerText={isFullSchedulingMode ? 'View full schedule' : 'View all shifts'}
                />
              )}

              {/* Qualified Roles */}
              <QualifiedRolesCard qualifiedRoles={volunteerStats.qualifiedRoles} />

              {/* ICE Sightings */}
              {features.sightings && (
                <SightingsCard zones={volunteerStats.zones} sightingCounts={sightingCounts} />
              )}

              {/* Upcoming Trainings */}
              {features.trainings && <TrainingsCard trainings={upcomingTrainings} />}
            </div>
          </div>
        </div>
      </div>

      {/* Zone Map Modal */}
      <ZoneMapModal isOpen={showZoneMapModal} onClose={() => setShowZoneMapModal(false)} />
    </>
  );
}

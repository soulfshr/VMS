'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type {
  UpcomingShift,
  UpcomingDispatcherAssignment,
  UpcomingRegionalLeadAssignment,
  UnifiedAssignment,
  QualifiedRole,
} from '@/types/dashboard';

interface UpcomingScheduleTableProps {
  upcomingShifts: UpcomingShift[];
  upcomingDispatcherAssignments: UpcomingDispatcherAssignment[];
  upcomingRegionalLeadAssignments: UpcomingRegionalLeadAssignment[];
  dismissedShiftIds: Set<string>;
  qualifiedRoles: QualifiedRole[];
  onDismissCancelledShift: (shiftId: string) => void;
  onCancelShiftRsvp: (shiftId: string) => void;
  onCancelDispatcherAssignment: (assignmentId: string) => void;
  onCancelRegionalLeadAssignment: (assignmentId: string) => void;
  cancellingShiftId: string | null;
  cancellingDispatcherId: string | null;
  cancellingRegionalLeadId: string | null;
}

export function UpcomingScheduleTable({
  upcomingShifts,
  upcomingDispatcherAssignments,
  upcomingRegionalLeadAssignments,
  dismissedShiftIds,
  qualifiedRoles,
  onDismissCancelledShift,
  onCancelShiftRsvp,
  onCancelDispatcherAssignment,
  onCancelRegionalLeadAssignment,
  cancellingShiftId,
  cancellingDispatcherId,
  cancellingRegionalLeadId,
}: UpcomingScheduleTableProps) {
  // Helper to get role color from qualifications
  const getRoleColor = (roleSlug: string): string => {
    const role = qualifiedRoles?.find(r => r.slug === roleSlug);
    return role?.color || '#6b7280';
  };

  // Create unified list of all upcoming assignments
  const unifiedAssignments = useMemo<UnifiedAssignment[]>(() => {
    return [
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
        sortKey: new Date(a.date).getTime(),
        data: a,
      })),
    ].sort((a, b) => a.sortKey - b.sortKey);
  }, [upcomingShifts, upcomingDispatcherAssignments, upcomingRegionalLeadAssignments, dismissedShiftIds]);

  const dispatcherColor = getRoleColor('DISPATCHER');
  const coordinatorColor = getRoleColor('REGIONAL_LEAD');

  return (
    <div className="bg-white rounded-xl border border-gray-200" data-tour="upcoming-shifts">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">My Upcoming Schedule</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {unifiedAssignments.length > 0 ? (
          unifiedAssignments.slice(0, 8).map((assignment) => {
            if (assignment.type === 'shift') {
              const shift = assignment.data as UpcomingShift;
              const isCancelled = shift.shiftStatus === 'CANCELLED';
              const roleColor = shift.userRsvp?.roleColor || '#14b8a6';
              const roleName = shift.userRsvp?.roleName || 'Volunteer';
              return (
                <ShiftRow
                  key={assignment.id}
                  shift={shift}
                  isCancelled={isCancelled}
                  roleColor={roleColor}
                  roleName={roleName}
                  cancellingShiftId={cancellingShiftId}
                  onDismiss={onDismissCancelledShift}
                  onCancelRsvp={onCancelShiftRsvp}
                />
              );
            } else if (assignment.type === 'dispatcher') {
              const dispatchAssignment = assignment.data as UpcomingDispatcherAssignment;
              return (
                <DispatcherRow
                  key={assignment.id}
                  assignment={dispatchAssignment}
                  color={dispatcherColor}
                  cancellingId={cancellingDispatcherId}
                  onCancel={onCancelDispatcherAssignment}
                />
              );
            } else {
              const coordAssignment = assignment.data as UpcomingRegionalLeadAssignment;
              return (
                <CoordinatorRow
                  key={assignment.id}
                  assignment={coordAssignment}
                  color={coordinatorColor}
                  cancellingId={cancellingRegionalLeadId}
                  onCancel={onCancelRegionalLeadAssignment}
                />
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
  );
}

// Sub-components for each row type
function ShiftRow({
  shift,
  isCancelled,
  roleColor,
  roleName,
  cancellingShiftId,
  onDismiss,
  onCancelRsvp,
}: {
  shift: UpcomingShift;
  isCancelled: boolean;
  roleColor: string;
  roleName: string;
  cancellingShiftId: string | null;
  onDismiss: (id: string) => void;
  onCancelRsvp: (id: string) => void;
}) {
  return (
    <div className={`p-4 transition-colors ${isCancelled ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
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
                  onDismiss(shift.id);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Remove from dashboard"
              >
                <XIcon />
              </button>
            </div>
          ) : shift.userRsvp ? (
            <div className="flex items-center gap-1">
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
                  onCancelRsvp(shift.id);
                }}
                disabled={cancellingShiftId === shift.id}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Cancel RSVP"
              >
                {cancellingShiftId === shift.id ? <SpinnerIcon /> : <XIcon />}
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
}

function DispatcherRow({
  assignment,
  color,
  cancellingId,
  onCancel,
}: {
  assignment: UpcomingDispatcherAssignment;
  color: string;
  cancellingId: string | null;
  onCancel: (id: string) => void;
}) {
  const isRegional = assignment.county === 'REGIONAL';
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <p className="font-medium text-gray-900">
              {isRegional ? 'Regional Dispatcher' : `${assignment.county} County Dispatcher`}
              {assignment.isBackup && <span className="text-xs text-gray-400 ml-2">(Backup)</span>}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(assignment.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'America/New_York'
              })} • {new Date(assignment.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/New_York'
              })} - {new Date(assignment.endTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'America/New_York'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="px-2 py-1 text-xs rounded font-medium inline-flex items-center gap-1"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            Dispatcher
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel(assignment.id);
            }}
            disabled={cancellingId === assignment.id}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Cancel assignment"
          >
            {cancellingId === assignment.id ? <SpinnerIcon /> : <XIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoordinatorRow({
  assignment,
  color,
  cancellingId,
  onCancel,
}: {
  assignment: UpcomingRegionalLeadAssignment;
  color: string;
  cancellingId: string | null;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div>
            <p className="font-medium text-gray-900">
              Dispatch Coordinator
              {assignment.isPrimary && <span style={{ color }} className="ml-1">★</span>}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(assignment.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                timeZone: 'America/New_York'
              })} • All day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="px-2 py-1 text-xs rounded font-medium inline-flex items-center gap-1"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            Coordinator
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel(assignment.id);
            }}
            disabled={cancellingId === assignment.id}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Cancel assignment"
          >
            {cancellingId === assignment.id ? <SpinnerIcon /> : <XIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

// Icon components
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  QualifiedOpeningsData,
  DispatcherSlotOpening,
  RegionalLeadOpening,
  OpeningsTab,
  UserZone,
} from '@/types/dashboard';

interface OpeningsWidgetProps {
  qualifiedOpenings: QualifiedOpeningsData;
  dispatcherSlotOpenings?: DispatcherSlotOpening[];
  regionalLeadOpenings?: RegionalLeadOpening[];
  userZones: UserZone[];
  isFullSchedulingMode: boolean;
  onQuickRsvp: (shiftId: string, asZoneLead: boolean) => Promise<void>;
  onClaimDispatcherSlot: (slot: DispatcherSlotOpening) => Promise<void>;
  onClaimRegionalLead: (date: string) => Promise<void>;
  rsvpingOpeningId: string | null;
  claimingSlotKey: string | null;
  claimingRegionalLeadDate: string | null;
  footerLink: string;
  footerText: string;
}

export function OpeningsWidget({
  qualifiedOpenings,
  dispatcherSlotOpenings,
  regionalLeadOpenings,
  userZones,
  isFullSchedulingMode,
  onQuickRsvp,
  onClaimDispatcherSlot,
  onClaimRegionalLead,
  rsvpingOpeningId,
  claimingSlotKey,
  claimingRegionalLeadDate,
  footerLink,
  footerText,
}: OpeningsWidgetProps) {
  const [openingsTab, setOpeningsTab] = useState<OpeningsTab>('shifts');
  const [showOtherZones, setShowOtherZones] = useState(false);
  const [showAllZoneLeadOpenings, setShowAllZoneLeadOpenings] = useState(false);
  const [showAllDispatcherSlots, setShowAllDispatcherSlots] = useState(false);
  const [showAllRegionalLeadOpenings, setShowAllRegionalLeadOpenings] = useState(false);

  // Check which tabs have data
  const hasShiftOpenings = qualifiedOpenings && (qualifiedOpenings.userZones.length > 0 || qualifiedOpenings.otherZones.length > 0);
  const hasDispatcherOpenings = isFullSchedulingMode && dispatcherSlotOpenings && dispatcherSlotOpenings.length > 0;
  const hasCoordinatorOpenings = isFullSchedulingMode && regionalLeadOpenings && regionalLeadOpenings.length > 0;

  // Counts for tab badges
  const shiftOpeningsCount = (qualifiedOpenings?.userZones.length || 0) + (qualifiedOpenings?.otherZones.length || 0);
  const dispatcherOpeningsCount = dispatcherSlotOpenings?.length || 0;
  const coordinatorOpeningsCount = regionalLeadOpenings?.length || 0;

  // Auto-select first available tab when data loads
  useEffect(() => {
    if (hasDispatcherOpenings) {
      setOpeningsTab('dispatch');
    } else if (hasShiftOpenings) {
      setOpeningsTab('shifts');
    } else if (hasCoordinatorOpenings) {
      setOpeningsTab('coordinator');
    }
  }, [hasShiftOpenings, hasDispatcherOpenings, hasCoordinatorOpenings]);

  return (
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
          <TabButton
            active={openingsTab === 'shifts'}
            onClick={() => setOpeningsTab('shifts')}
            label={isFullSchedulingMode ? 'Zone Lead' : 'Shift Lead'}
            count={shiftOpeningsCount}
            activeColor="cyan"
          />
        )}
        {hasDispatcherOpenings && (
          <TabButton
            active={openingsTab === 'dispatch'}
            onClick={() => setOpeningsTab('dispatch')}
            label="Dispatch"
            count={dispatcherOpeningsCount}
            activeColor="blue"
          />
        )}
        {hasCoordinatorOpenings && (
          <TabButton
            active={openingsTab === 'coordinator'}
            onClick={() => setOpeningsTab('coordinator')}
            label="Coordinator"
            count={coordinatorOpeningsCount}
            activeColor="amber"
          />
        )}
      </div>

      {/* Tab Content */}
      <div className="divide-y divide-gray-100">
        {/* Shifts Tab */}
        {openingsTab === 'shifts' && hasShiftOpenings && (
          <ShiftsTabContent
            qualifiedOpenings={qualifiedOpenings}
            userZones={userZones}
            isFullSchedulingMode={isFullSchedulingMode}
            showOtherZones={showOtherZones}
            setShowOtherZones={setShowOtherZones}
            showAllZoneLeadOpenings={showAllZoneLeadOpenings}
            setShowAllZoneLeadOpenings={setShowAllZoneLeadOpenings}
            onQuickRsvp={onQuickRsvp}
            rsvpingOpeningId={rsvpingOpeningId}
          />
        )}

        {/* Dispatch Tab */}
        {openingsTab === 'dispatch' && hasDispatcherOpenings && dispatcherSlotOpenings && (
          <DispatchTabContent
            slots={dispatcherSlotOpenings}
            showAll={showAllDispatcherSlots}
            setShowAll={setShowAllDispatcherSlots}
            onClaimSlot={onClaimDispatcherSlot}
            claimingSlotKey={claimingSlotKey}
          />
        )}

        {/* Coordinator Tab */}
        {openingsTab === 'coordinator' && hasCoordinatorOpenings && regionalLeadOpenings && (
          <CoordinatorTabContent
            openings={regionalLeadOpenings}
            showAll={showAllRegionalLeadOpenings}
            setShowAll={setShowAllRegionalLeadOpenings}
            onClaimDate={onClaimRegionalLead}
            claimingDate={claimingRegionalLeadDate}
          />
        )}
      </div>

      {/* Footer link */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <Link
          href={footerLink}
          className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
        >
          {footerText} →
        </Link>
      </div>
    </div>
  );
}

// Tab button component
function TabButton({
  active,
  onClick,
  label,
  count,
  activeColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  activeColor: 'cyan' | 'blue' | 'amber';
}) {
  const colorClasses = {
    cyan: {
      border: 'border-cyan-500 text-cyan-600',
      badge: 'bg-cyan-100 text-cyan-700',
    },
    blue: {
      border: 'border-blue-500 text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
    },
    amber: {
      border: 'border-amber-500 text-amber-600',
      badge: 'bg-amber-100 text-amber-700',
    },
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? colorClasses[activeColor].border
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
        active ? colorClasses[activeColor].badge : 'bg-gray-100 text-gray-600'
      }`}>
        {count}
      </span>
    </button>
  );
}

// Shifts tab content
function ShiftsTabContent({
  qualifiedOpenings,
  userZones,
  isFullSchedulingMode,
  showOtherZones,
  setShowOtherZones,
  showAllZoneLeadOpenings,
  setShowAllZoneLeadOpenings,
  onQuickRsvp,
  rsvpingOpeningId,
}: {
  qualifiedOpenings: QualifiedOpeningsData;
  userZones: UserZone[];
  isFullSchedulingMode: boolean;
  showOtherZones: boolean;
  setShowOtherZones: (val: boolean) => void;
  showAllZoneLeadOpenings: boolean;
  setShowAllZoneLeadOpenings: (val: boolean) => void;
  onQuickRsvp: (shiftId: string, asZoneLead: boolean) => Promise<void>;
  rsvpingOpeningId: string | null;
}) {
  // When user has no zones, show all shifts in a flat list
  if (userZones.length === 0) {
    const allShifts = [...qualifiedOpenings.userZones, ...qualifiedOpenings.otherZones];
    const shiftsToShow = showAllZoneLeadOpenings ? allShifts : allShifts.slice(0, 3);
    return (
      <>
        {shiftsToShow.map((shift) => (
          <ShiftOpeningRow
            key={shift.id}
            shift={shift}
            isFullSchedulingMode={isFullSchedulingMode}
            onQuickRsvp={onQuickRsvp}
            rsvpingOpeningId={rsvpingOpeningId}
            showZone={false}
          />
        ))}
        {allShifts.length > 3 && (
          <ShowMoreButton
            expanded={showAllZoneLeadOpenings}
            onClick={() => setShowAllZoneLeadOpenings(!showAllZoneLeadOpenings)}
            remainingCount={allShifts.length - 3}
            color="cyan"
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* User's zones */}
      {qualifiedOpenings.userZones.length > 0 && (
        <>
          {(showAllZoneLeadOpenings ? qualifiedOpenings.userZones : qualifiedOpenings.userZones.slice(0, 3)).map((shift) => (
            <ShiftOpeningRow
              key={shift.id}
              shift={shift}
              isFullSchedulingMode={isFullSchedulingMode}
              onQuickRsvp={onQuickRsvp}
              rsvpingOpeningId={rsvpingOpeningId}
              showZone={true}
            />
          ))}
          {qualifiedOpenings.userZones.length > 3 && (
            <ShowMoreButton
              expanded={showAllZoneLeadOpenings}
              onClick={() => setShowAllZoneLeadOpenings(!showAllZoneLeadOpenings)}
              remainingCount={qualifiedOpenings.userZones.length - 3}
              color="cyan"
            />
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
            <ChevronIcon expanded={showOtherZones} />
          </button>
          {showOtherZones && (
            <>
              {qualifiedOpenings.otherZones.map((shift) => (
                <ShiftOpeningRow
                  key={shift.id}
                  shift={shift}
                  isFullSchedulingMode={isFullSchedulingMode}
                  onQuickRsvp={onQuickRsvp}
                  rsvpingOpeningId={rsvpingOpeningId}
                  showZone={true}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

// Shift opening row
function ShiftOpeningRow({
  shift,
  isFullSchedulingMode,
  onQuickRsvp,
  rsvpingOpeningId,
  showZone,
}: {
  shift: QualifiedOpeningsData['userZones'][0];
  isFullSchedulingMode: boolean;
  onQuickRsvp: (shiftId: string, asZoneLead: boolean) => Promise<void>;
  rsvpingOpeningId: string | null;
  showZone: boolean;
}) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
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
            {showZone && (
              <span className="text-xs text-gray-400">
                {shift.zone?.name || 'No zone'}
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
              shift.needsZoneLead
                ? 'bg-purple-100 text-purple-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {shift.needsZoneLead
                ? (isFullSchedulingMode ? 'Needs Zone Lead' : 'Needs Shift Lead')
                : `${shift.spotsRemaining} spot${shift.spotsRemaining !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={() => onQuickRsvp(shift.id, shift.needsZoneLead)}
            disabled={rsvpingOpeningId === shift.id}
            className="mt-2 w-full py-1.5 px-3 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {rsvpingOpeningId === shift.id
              ? 'Signing up...'
              : (shift.needsZoneLead
                  ? (isFullSchedulingMode ? 'Sign Up as Zone Lead' : 'Sign Up as Shift Lead')
                  : 'Sign Up')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dispatch tab content
function DispatchTabContent({
  slots,
  showAll,
  setShowAll,
  onClaimSlot,
  claimingSlotKey,
}: {
  slots: DispatcherSlotOpening[];
  showAll: boolean;
  setShowAll: (val: boolean) => void;
  onClaimSlot: (slot: DispatcherSlotOpening) => Promise<void>;
  claimingSlotKey: string | null;
}) {
  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  return (
    <>
      {(showAll ? slots : slots.slice(0, 3)).map((slot) => {
        const slotKey = `${slot.county}-${slot.date}-${slot.startHour}-${slot.endHour}`;
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
                  onClick={() => onClaimSlot(slot)}
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
      {slots.length > 3 && (
        <ShowMoreButton
          expanded={showAll}
          onClick={() => setShowAll(!showAll)}
          remainingCount={slots.length - 3}
          color="blue"
        />
      )}
    </>
  );
}

// Coordinator tab content
function CoordinatorTabContent({
  openings,
  showAll,
  setShowAll,
  onClaimDate,
  claimingDate,
}: {
  openings: RegionalLeadOpening[];
  showAll: boolean;
  setShowAll: (val: boolean) => void;
  onClaimDate: (date: string) => Promise<void>;
  claimingDate: string | null;
}) {
  return (
    <>
      {(showAll ? openings : openings.slice(0, 3)).map((opening) => (
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
                onClick={() => onClaimDate(opening.date)}
                disabled={claimingDate === opening.date}
                className="mt-2 w-full py-1.5 px-3 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {claimingDate === opening.date ? 'Claiming...' : 'Claim This Day'}
              </button>
            </div>
          </div>
        </div>
      ))}
      {openings.length > 3 && (
        <ShowMoreButton
          expanded={showAll}
          onClick={() => setShowAll(!showAll)}
          remainingCount={openings.length - 3}
          color="amber"
        />
      )}
    </>
  );
}

// Show more button
function ShowMoreButton({
  expanded,
  onClick,
  remainingCount,
  color,
}: {
  expanded: boolean;
  onClick: () => void;
  remainingCount: number;
  color: 'cyan' | 'blue' | 'amber';
}) {
  const colorClasses = {
    cyan: 'text-cyan-600 hover:text-cyan-700',
    blue: 'text-blue-600 hover:text-blue-700',
    amber: 'text-amber-600 hover:text-amber-700',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors ${colorClasses[color]}`}
    >
      {expanded ? 'Show less' : `Show ${remainingCount} more`}
      <ChevronIcon expanded={expanded} />
    </button>
  );
}

// Chevron icon
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

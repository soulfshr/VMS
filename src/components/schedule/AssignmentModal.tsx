'use client';

import { useState, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface TimeBlock {
  startTime: string;      // Eastern time format "6:00"
  endTime: string;        // Eastern time format "10:00"
  label: string;          // Display label "6am - 10am"
  startTimeUTC: string;   // UTC ISO string for saving
  endTimeUTC: string;     // UTC ISO string for saving
}

interface ZoneData {
  zoneId: string;
  zoneName: string;
  zoneLeads: Array<{
    id: string;
    name: string;
    rsvpId: string;
  }>;
  volunteers: Array<{
    id: string;
    name: string;
    rsvpId: string;
    status: string;
  }>;
  shifts: Array<{
    id: string;
    title: string;
    type: string;
    typeConfigName: string | null;
  }>;
}

interface CellData {
  county: string;
  date: string;
  timeBlock: TimeBlock;
  dispatcher: {
    id: string;
    name: string;
    assignmentId: string;
    isBackup: boolean;
    notes: string | null;
  } | null;
  backupDispatchers: Array<{
    id: string;
    name: string;
    assignmentId: string;
    notes: string | null;
  }>;
  zones: ZoneData[];
  coverage: 'full' | 'partial' | 'none';
}

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface QualifiedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface AssignmentModalProps {
  cell: CellData;
  zones: Zone[];
  onClose: () => void;
  onSave: () => void;
  dispatcherMode?: 'REGIONAL' | 'COUNTY' | 'ZONE';
  schedulingMode?: 'SIMPLE' | 'FULL';
}

export default function AssignmentModal({ cell, zones: allZones, onClose, onSave, dispatcherMode = 'ZONE', schedulingMode = 'SIMPLE' }: AssignmentModalProps) {
  const focusTrapRef = useFocusTrap(true); // Modal is always open when rendered

  // Detect if this is a backup dispatcher assignment (county === 'REGIONAL')
  const isBackupDispatcherMode = cell.county === 'REGIONAL';

  // Detect if this is an "ALL counties" assignment (for Regional dispatcher aggregation)
  const isAllCountiesMode = cell.county === 'ALL';

  // Get unique counties from all zones
  const uniqueCounties = [...new Set(
    allZones
      .map(z => z.county)
      .filter((c): c is string => c !== null)
  )];

  const [qualifiedDispatchers, setQualifiedDispatchers] = useState<QualifiedUser[]>([]);
  const [qualifiedZoneLeads, setQualifiedZoneLeads] = useState<QualifiedUser[]>([]);
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>(cell.dispatcher?.id || '');
  const [dispatcherNotes, setDispatcherNotes] = useState<string>(cell.dispatcher?.notes || '');
  const [isBackup, setIsBackup] = useState<boolean>(isBackupDispatcherMode || false);
  const [saving, setSaving] = useState(false);
  const [savingZoneLead, setSavingZoneLead] = useState<string | null>(null);
  const [addingZoneLead, setAddingZoneLead] = useState<string | null>(null);
  const [selectedZoneLeads, setSelectedZoneLeads] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [dispatcherExpanded, setDispatcherExpanded] = useState(true);

  // Get all unique shifts from all zones
  const allShifts = cell.zones.flatMap(z => z.shifts.map(s => ({
    ...s,
    zoneId: z.zoneId,
    zoneName: z.zoneName,
    zoneLeads: z.zoneLeads,
    volunteers: z.volunteers,
  })));

  // Fetch qualified dispatchers when dispatcher section is expanded
  useEffect(() => {
    if (dispatcherExpanded) {
      // In REGIONAL mode, backup dispatcher mode, or ALL counties mode, don't filter by county
      const url = (dispatcherMode === 'REGIONAL' || isBackupDispatcherMode || isAllCountiesMode)
        ? '/api/users/qualified?role=DISPATCHER'
        : `/api/users/qualified?role=DISPATCHER&county=${cell.county}`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setQualifiedDispatchers(data);
          }
        })
        .catch(err => console.error('Error fetching dispatchers:', err));
    }
  }, [dispatcherExpanded, cell.county, dispatcherMode, isBackupDispatcherMode, isAllCountiesMode]);

  // Fetch qualified zone leads on mount
  useEffect(() => {
    fetch(`/api/users/qualified?role=ZONE_LEAD&county=${cell.county}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setQualifiedZoneLeads(data);
        }
      })
      .catch(err => console.error('Error fetching zone leads:', err));
  }, [cell.county]);

  const handleSaveDispatcher = async () => {
    setSaving(true);
    setError(null);

    try {
      // Use the UTC times directly from the schedule API
      // These are proper UTC times derived from actual shift times
      const startTime = cell.timeBlock.startTimeUTC;
      const endTime = cell.timeBlock.endTimeUTC;

      // Handle ALL counties mode - create assignments for each county
      if (isAllCountiesMode && selectedDispatcher) {
        const errors: string[] = [];
        for (const county of uniqueCounties) {
          try {
            const res = await fetch('/api/dispatcher-assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: selectedDispatcher,
                county,
                date: cell.date,
                startTime,
                endTime,
                notes: dispatcherNotes || null,
                isBackup,
              }),
            });
            if (!res.ok) {
              const data = await res.json();
              // Don't error on "already assigned" - just skip
              if (!data.error?.includes('already assigned')) {
                errors.push(`${county}: ${data.error || 'Failed'}`);
              }
            }
          } catch (err) {
            errors.push(`${county}: ${(err as Error).message}`);
          }
        }

        if (errors.length > 0) {
          throw new Error(errors.join('; '));
        }
      } else if (cell.dispatcher?.assignmentId) {
        if (!selectedDispatcher) {
          const res = await fetch(`/api/dispatcher-assignments/${cell.dispatcher.assignmentId}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed to remove dispatcher');
        } else {
          const res = await fetch(`/api/dispatcher-assignments/${cell.dispatcher.assignmentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: selectedDispatcher,
              notes: dispatcherNotes || null,
              isBackup,
            }),
          });
          if (!res.ok) throw new Error('Failed to update dispatcher');
        }
      } else if (selectedDispatcher) {
        const res = await fetch('/api/dispatcher-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedDispatcher,
            county: cell.county,
            date: cell.date,
            startTime,  // Already an ISO string from the schedule API
            endTime,    // Already an ISO string from the schedule API
            notes: dispatcherNotes || null,
            isBackup,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to assign dispatcher');
        }
      }

      setDispatcherExpanded(false);
      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleZoneLead = async (shiftId: string, volunteerId: string, currentIsZoneLead: boolean) => {
    setSavingZoneLead(volunteerId);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volunteerId,
          isZoneLead: !currentIsZoneLead,
        }),
      });
      if (!res.ok) throw new Error('Failed to update zone lead status');
      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingZoneLead(null);
    }
  };

  const handleSaveAllZoneLeads = async () => {
    // Get all shift IDs that have a zone lead selected
    const shiftsToUpdate = Object.entries(selectedZoneLeads).filter(([, userId]) => userId);
    if (shiftsToUpdate.length === 0) return;

    setAddingZoneLead('all');
    setError(null);
    const errors: string[] = [];

    for (const [shiftId, userId] of shiftsToUpdate) {
      try {
        const res = await fetch(`/api/shifts/${shiftId}/add-volunteer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            volunteerId: userId,
            isZoneLead: true,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          errors.push(data.error || `Failed to add zone lead to shift`);
        }
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    // Clear all selections and refresh
    setSelectedZoneLeads({});
    setAddingZoneLead(null);
    onSave();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCoverageIcon = (coverage: string) => {
    switch (coverage) {
      case 'full': return '🟢';
      case 'partial': return '🟡';
      default: return '🔴';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">{getCoverageIcon(cell.coverage)}</span>
                <h2 id="assignment-modal-title" className="text-lg font-semibold text-gray-900">
                  {isBackupDispatcherMode
                    ? `Backup Dispatcher - ${cell.timeBlock.label}`
                    : isAllCountiesMode
                    ? `Regional Dispatcher - ${cell.timeBlock.label}`
                    : dispatcherMode === 'REGIONAL'
                    ? `Regional Dispatcher - ${cell.timeBlock.label}`
                    : dispatcherMode === 'COUNTY'
                    ? `${cell.county} County Dispatcher - ${cell.timeBlock.label}`
                    : `${cell.county} County - ${cell.timeBlock.label}`}
                </h2>
              </div>
              <p className="text-sm text-gray-600">
                {formatDate(cell.date)}
                {(dispatcherMode === 'REGIONAL' || isBackupDispatcherMode || isAllCountiesMode) && ' (Region-wide)'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
          {/* Dispatcher Section - Collapsible */}
          <div className="mb-6">
            <button
              onClick={() => setDispatcherExpanded(!dispatcherExpanded)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                <span>🎧</span>
                <span className="font-medium text-gray-900">Dispatcher</span>
                {cell.dispatcher ? (
                  <span className="text-gray-600">- {cell.dispatcher.name}</span>
                ) : (
                  <span className="text-gray-500">- Not assigned</span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${dispatcherExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dispatcherExpanded && (
              <div className="mt-3 p-4 border border-gray-200 rounded-lg space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Dispatcher
                  </label>
                  <select
                    value={selectedDispatcher}
                    onChange={e => setSelectedDispatcher(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">-- No dispatcher assigned --</option>
                    {qualifiedDispatchers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={dispatcherNotes}
                    onChange={e => setDispatcherNotes(e.target.value)}
                    placeholder="e.g., Only available until 8am"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>

                {isBackupDispatcherMode ? (
                  <div className="flex items-center gap-2 text-sm text-cyan-700 bg-cyan-50 px-3 py-2 rounded">
                    <span>✓</span>
                    <span>This is a backup dispatcher assignment (region-wide)</span>
                  </div>
                ) : isAllCountiesMode ? (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded">
                    <span>ℹ</span>
                    <span>This will assign the dispatcher to all counties: {uniqueCounties.join(', ')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isBackup"
                      checked={isBackup}
                      onChange={e => setIsBackup(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                    />
                    <label htmlFor="isBackup" className="text-sm text-gray-700">
                      Mark as backup dispatcher
                    </label>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveDispatcher}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Dispatcher'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Shift Rosters - Not shown for backup dispatcher mode or ALL counties mode */}
          {!isBackupDispatcherMode && !isAllCountiesMode && (
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Shift Rosters</h3>

            {allShifts.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No shifts scheduled for this time block.
              </div>
            ) : (
              <div className="space-y-2">
                {allShifts.map(shift => {
                  // In SIMPLE mode, only show zone leads; in FULL mode show all volunteers
                  const allVolunteers = schedulingMode === 'SIMPLE'
                    ? shift.zoneLeads.map(zl => ({ ...zl, isZoneLead: true }))
                    : [
                        ...shift.zoneLeads.map(zl => ({ ...zl, isZoneLead: true })),
                        ...shift.volunteers.map(v => ({ ...v, isZoneLead: false })),
                      ];

                  return (
                    <div key={shift.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Shift Header - Compact */}
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-gray-900 text-sm truncate">{shift.title}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-600 truncate">{shift.zoneName}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                          shift.type === 'VERIFICATION'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {shift.typeConfigName || shift.type}
                        </span>
                      </div>

                      {/* Volunteer List */}
                      <div className="divide-y divide-gray-100">
                        {allVolunteers.length === 0 ? (
                          <div className="px-3 py-1.5 text-xs text-gray-500 italic">
                            {schedulingMode === 'SIMPLE' ? 'No zone leads assigned' : 'No volunteers yet'}
                          </div>
                        ) : (
                          allVolunteers.map(volunteer => (
                            <div
                              key={volunteer.id}
                              className="px-3 py-1.5 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-900">
                                  {volunteer.name}
                                </span>
                                {volunteer.isZoneLead && (
                                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                    Lead
                                  </span>
                                )}
                                {'status' in volunteer && volunteer.status === 'PENDING' && (
                                  <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleToggleZoneLead(shift.id, volunteer.id, volunteer.isZoneLead)}
                                disabled={savingZoneLead === volunteer.id}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  volunteer.isZoneLead
                                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                                } disabled:opacity-50`}
                              >
                                {savingZoneLead === volunteer.id
                                  ? '...'
                                  : volunteer.isZoneLead
                                  ? '− Remove'
                                  : '+ Lead'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Assign Zone Lead Dropdown - Inline */}
                      <div className="px-3 py-2 bg-amber-50 border-t border-gray-200 flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                          Assign Lead:
                        </label>
                        <select
                          value={selectedZoneLeads[shift.id] || ''}
                          onChange={e => setSelectedZoneLeads(prev => ({ ...prev, [shift.id]: e.target.value }))}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="">-- Select --</option>
                          {qualifiedZoneLeads
                            .filter(zl => !allVolunteers.some(v => v.id === zl.id))
                            .map(user => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
          )}
        </div>

        {/* Footer - Save Zone Leads Button */}
        {!isBackupDispatcherMode && !isAllCountiesMode && Object.values(selectedZoneLeads).some(v => v) && (
          <div className="px-6 py-3 border-t border-gray-200 flex justify-end bg-gray-50">
            <button
              onClick={handleSaveAllZoneLeads}
              disabled={addingZoneLead === 'all'}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {addingZoneLead === 'all' ? 'Saving...' : 'Save Zone Leads'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

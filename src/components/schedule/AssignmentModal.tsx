'use client';

import { useState, useEffect } from 'react';

interface TimeBlock {
  startTime: string;
  endTime: string;
  label: string;
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
}

export default function AssignmentModal({ cell, zones: _zones, onClose, onSave }: AssignmentModalProps) {
  // Note: _zones prop available for future use showing zones without shifts
  const [qualifiedDispatchers, setQualifiedDispatchers] = useState<QualifiedUser[]>([]);
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>(cell.dispatcher?.id || '');
  const [dispatcherNotes, setDispatcherNotes] = useState<string>(cell.dispatcher?.notes || '');
  const [isBackup, setIsBackup] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [savingZoneLead, setSavingZoneLead] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dispatcherExpanded, setDispatcherExpanded] = useState(false);

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
      fetch(`/api/users/qualified?role=DISPATCHER&county=${cell.county}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setQualifiedDispatchers(data);
          }
        })
        .catch(err => console.error('Error fetching dispatchers:', err));
    }
  }, [dispatcherExpanded, cell.county]);

  const handleSaveDispatcher = async () => {
    setSaving(true);
    setError(null);

    try {
      // Pad the time strings for proper ISO format (e.g., "6:00" -> "06:00")
      const padTime = (time: string) => {
        const [h, m] = time.split(':');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      };

      // Create UTC dates directly from the date and time strings
      // The schedule API returns times in UTC, so we construct UTC dates
      const startTime = new Date(`${cell.date}T${padTime(cell.timeBlock.startTime)}:00Z`);
      const endTime = new Date(`${cell.date}T${padTime(cell.timeBlock.endTime)}:00Z`);

      if (cell.dispatcher?.assignmentId) {
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
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{getCoverageIcon(cell.coverage)}</span>
                <h2 className="text-lg font-semibold text-gray-900">
                  {cell.county} County - {cell.timeBlock.label}
                </h2>
              </div>
              <p className="text-sm text-gray-600">{formatDate(cell.date)}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <span className="text-gray-400">- Not assigned</span>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isBackup"
                    checked={isBackup}
                    onChange={e => setIsBackup(e.target.checked)}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="isBackup" className="text-sm text-gray-700">
                    Mark as backup dispatcher
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDispatcherExpanded(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDispatcher}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Shift Rosters */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Shift Rosters</h3>

            {allShifts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No shifts scheduled for this time block.
              </div>
            ) : (
              <div className="space-y-4">
                {allShifts.map(shift => {
                  const allVolunteers = [
                    ...shift.zoneLeads.map(zl => ({ ...zl, isZoneLead: true })),
                    ...shift.volunteers.map(v => ({ ...v, isZoneLead: false })),
                  ];

                  return (
                    <div key={shift.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Shift Header */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">{shift.title}</span>
                            <span className="text-gray-500 mx-2">•</span>
                            <span className="text-sm text-gray-600">{shift.zoneName}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            shift.type === 'VERIFICATION'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {shift.type}
                          </span>
                        </div>
                      </div>

                      {/* Volunteer List */}
                      <div className="divide-y divide-gray-100">
                        {allVolunteers.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                            No volunteers signed up yet
                          </div>
                        ) : (
                          allVolunteers.map(volunteer => (
                            <div
                              key={volunteer.id}
                              className="px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-900">
                                  {volunteer.name}
                                </span>
                                {volunteer.isZoneLead && (
                                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                    Zone Lead
                                  </span>
                                )}
                                {'status' in volunteer && volunteer.status === 'PENDING' && (
                                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleToggleZoneLead(shift.id, volunteer.id, volunteer.isZoneLead)}
                                disabled={savingZoneLead === volunteer.id}
                                className={`text-xs px-2 py-1 rounded ${
                                  volunteer.isZoneLead
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                } disabled:opacity-50`}
                              >
                                {savingZoneLead === volunteer.id
                                  ? '...'
                                  : volunteer.isZoneLead
                                  ? 'Remove Lead'
                                  : 'Make Lead'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* View Full Roster Link */}
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                        <a
                          href={`/shifts/${shift.id}/roster`}
                          className="text-sm text-teal-600 hover:text-teal-700"
                        >
                          View full roster & add volunteers →
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

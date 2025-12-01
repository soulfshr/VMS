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

export default function AssignmentModal({ cell, zones, onClose, onSave }: AssignmentModalProps) {
  const [activeTab, setActiveTab] = useState<'dispatcher' | 'zoneLeads'>('dispatcher');
  const [qualifiedDispatchers, setQualifiedDispatchers] = useState<QualifiedUser[]>([]);
  const [selectedDispatcher, setSelectedDispatcher] = useState<string>(cell.dispatcher?.id || '');
  const [dispatcherNotes, setDispatcherNotes] = useState<string>(cell.dispatcher?.notes || '');
  const [isBackup, setIsBackup] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch qualified dispatchers
  useEffect(() => {
    fetch(`/api/users/qualified?role=DISPATCHER&county=${cell.county}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setQualifiedDispatchers(data);
        }
      })
      .catch(err => console.error('Error fetching dispatchers:', err));
  }, [cell.county]);

  const handleSaveDispatcher = async () => {
    setSaving(true);
    setError(null);

    try {
      // Parse time block to get start/end times
      const [startHour] = cell.timeBlock.startTime.split(':').map(Number);
      const [endHour] = cell.timeBlock.endTime.split(':').map(Number);

      const dateObj = new Date(cell.date);
      const startTime = new Date(dateObj);
      startTime.setHours(startHour, 0, 0, 0);
      const endTime = new Date(dateObj);
      endTime.setHours(endHour, 0, 0, 0);

      // If there's an existing assignment, update or delete it
      if (cell.dispatcher?.assignmentId) {
        if (!selectedDispatcher) {
          // Delete existing assignment
          const res = await fetch(`/api/dispatcher-assignments/${cell.dispatcher.assignmentId}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error('Failed to remove dispatcher');
        } else {
          // Update existing assignment
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
        // Create new assignment
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

      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {cell.county} County - {cell.timeBlock.label}
              </h2>
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

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('dispatcher')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'dispatcher'
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Dispatcher
            </button>
            <button
              onClick={() => setActiveTab('zoneLeads')}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                activeTab === 'zoneLeads'
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Zone Leads & Volunteers
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {activeTab === 'dispatcher' && (
            <div className="space-y-4">
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
                {qualifiedDispatchers.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    No qualified dispatchers found. Users qualify by completing Dispatcher training.
                  </p>
                )}
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

              {/* Current backup dispatchers */}
              {cell.backupDispatchers.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Backup Dispatchers
                  </h4>
                  <ul className="space-y-1">
                    {cell.backupDispatchers.map(backup => (
                      <li key={backup.assignmentId} className="text-sm text-gray-600">
                        {backup.name}
                        {backup.notes && (
                          <span className="text-gray-400 ml-2">({backup.notes})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {activeTab === 'zoneLeads' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Zone leads are assigned from volunteers who have RSVPed to shifts in each zone.
                To designate a zone lead, go to the shift roster page.
              </p>

              {zones.map(zone => {
                const zoneData = cell.zones.find(z => z.zoneId === zone.id);
                return (
                  <div key={zone.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{zone.name}</h4>

                    {/* Zone Lead */}
                    <div className="text-sm mb-2">
                      <span className="text-gray-600">Zone Lead: </span>
                      {zoneData?.zoneLeads.length ? (
                        <span className="font-medium text-gray-900">
                          {zoneData.zoneLeads.map(zl => zl.name).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not assigned</span>
                      )}
                    </div>

                    {/* Volunteers */}
                    <div className="text-sm">
                      <span className="text-gray-600">Volunteers: </span>
                      {zoneData?.volunteers.length ? (
                        <span className="text-gray-800">
                          {zoneData.volunteers.map(v => v.name).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-400">None signed up</span>
                      )}
                    </div>

                    {/* Link to shifts */}
                    {zoneData?.shifts.map(shift => (
                      <a
                        key={shift.id}
                        href={`/shifts/${shift.id}/roster`}
                        className="inline-block mt-2 text-sm text-teal-600 hover:text-teal-700"
                      >
                        View roster for {shift.title} →
                      </a>
                    ))}
                  </div>
                );
              })}

              {zones.length === 0 && (
                <p className="text-gray-500 text-sm">No zones found for this county.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          {activeTab === 'dispatcher' && (
            <button
              onClick={handleSaveDispatcher}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Dispatcher'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

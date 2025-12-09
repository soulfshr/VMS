'use client';

import { useState, useEffect } from 'react';

interface RegionalLead {
  id: string;
  userId: string;
  userName: string;
  date: string;
  isPrimary: boolean;
  notes: string | null;
}

interface QualifiedUser {
  id: string;
  name: string;
  email: string;
}

interface RegionalLeadModalProps {
  date: string;
  existingLeads: RegionalLead[];
  onClose: () => void;
  onSave: () => void;
}

export default function RegionalLeadModal({
  date,
  existingLeads,
  onClose,
  onSave,
}: RegionalLeadModalProps) {
  const [qualifiedUsers, setQualifiedUsers] = useState<QualifiedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');

  // Fetch qualified users (those with REGIONAL_LEAD qualification)
  useEffect(() => {
    const fetchQualifiedUsers = async () => {
      try {
        const res = await fetch('/api/volunteers?qualification=REGIONAL_LEAD');
        if (!res.ok) throw new Error('Failed to fetch qualified users');
        const data = await res.json();
        setQualifiedUsers(data.volunteers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchQualifiedUsers();
  }, []);

  const handleAdd = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/regional-lead-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          date,
          isPrimary,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create assignment');
      }

      setSelectedUserId('');
      setIsPrimary(false);
      setNotes('');
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!confirm('Remove this Regional Lead assignment?')) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/regional-lead-assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove assignment');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async (assignmentId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/regional-lead-assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update assignment');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter out users who are already assigned
  const availableUsers = qualifiedUsers.filter(
    u => !existingLeads.some(l => l.userId === u.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-purple-50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Regional Lead</h2>
              <p className="text-sm text-gray-600">{formatDate(date)}</p>
            </div>
          </div>
        </div>

        {/* Current Assignments */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Current Assignments</h3>
          {existingLeads.length > 0 ? (
            <div className="space-y-2">
              {existingLeads.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {lead.isPrimary && (
                      <span className="text-yellow-500" title="Primary">★</span>
                    )}
                    <span className="font-medium text-gray-900">{lead.userName}</span>
                    {lead.notes && (
                      <span className="text-xs text-gray-500">({lead.notes})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!lead.isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(lead.id)}
                        disabled={saving}
                        className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(lead.id)}
                      disabled={saving}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No Regional Leads assigned for this day</p>
          )}
        </div>

        {/* Add New Assignment */}
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Add Assignment</h3>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : availableUsers.length > 0 ? (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Volunteer</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Select a qualified volunteer...</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={isPrimary}
                  onChange={e => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="isPrimary" className="text-sm text-gray-700">
                  Primary Regional Lead
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g., Available after 2pm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={!selectedUserId || saving}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Saving...' : 'Add Regional Lead'}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              {qualifiedUsers.length === 0
                ? 'No volunteers have the Regional Lead qualification'
                : 'All qualified volunteers are already assigned'}
            </p>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

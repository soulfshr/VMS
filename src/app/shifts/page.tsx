'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { DevUser } from '@/types/auth';

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface Shift {
  id: string;
  type: 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT';
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  zone: Zone;
  minVolunteers: number;
  idealVolunteers: number;
  maxVolunteers: number;
  status: string;
  confirmedCount: number;
  pendingCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
}

// Cancel Modal Component
function CancelModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  selectedCount: number;
  isSubmitting: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Shifts</h2>
        <p className="text-gray-600 mb-4">
          Are you sure you want to cancel {selectedCount} shift{selectedCount > 1 ? 's' : ''}?
          All signed-up volunteers will be notified by email.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Weather conditions, scheduling conflict..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            Keep Shifts
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Shifts'}
          </button>
        </div>
      </div>
    </div>
  );
}

const typeColors: Record<string, { bg: string; text: string }> = {
  PATROL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COLLECTION: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ON_CALL_FIELD_SUPPORT: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const typeLabels: Record<string, string> = {
  PATROL: 'Patrol',
  COLLECTION: 'Collection',
  ON_CALL_FIELD_SUPPORT: 'On-Call',
};

export default function ShiftsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [rsvpingShiftId, setRsvpingShiftId] = useState<string | null>(null);

  // Selection state for coordinators
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      if (filterZone !== 'all') params.set('zoneId', filterZone);

      const res = await fetch(`/api/shifts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data);
    } catch {
      setError('Failed to load shifts');
    }
  }, [filterType, filterZone]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/zones').then(res => res.json()),
    ])
      .then(([sessionData, zonesData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        setUser(sessionData.user);
        if (Array.isArray(zonesData)) {
          setZones(zonesData);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user, fetchShifts]);

  const handleRsvp = async (shiftId: string) => {
    setRsvpingShiftId(shiftId);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      // Refresh shifts to show updated status
      await fetchShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setRsvpingShiftId(null);
    }
  };

  const handleCancelRsvp = async (shiftId: string) => {
    setRsvpingShiftId(shiftId);
    setError(null);

    try {
      const res = await fetch(`/api/shifts/${shiftId}/rsvp`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      await fetchShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setRsvpingShiftId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const formatOpts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return `${start.toLocaleTimeString('en-US', formatOpts)} - ${end.toLocaleTimeString('en-US', formatOpts)}`;
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShifts(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) {
        next.delete(shiftId);
      } else {
        next.add(shiftId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedShifts(new Set());
  };

  const handleCancelShifts = async (reason: string) => {
    setIsCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/shifts/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel shifts');
      }

      // Refresh shifts and clear selection
      await fetchShifts();
      setSelectedShifts(new Set());
      setShowCancelModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel shifts');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const canCreateShift = user.role === 'COORDINATOR' || user.role === 'ADMINISTRATOR';

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Shifts</h1>
            <p className="text-gray-600">Find and sign up for available volunteer shifts</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/shifts/calendar"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Calendar View
            </Link>
            {canCreateShift && (
                <Link
                  href="/shifts/create"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  + Create Shift
                </Link>
            )}
          </div>
        </div>

        {/* Selection Toolbar (Coordinator only) */}
        {canCreateShift && selectedShifts.size > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium text-red-700">
                {selectedShifts.size} shift{selectedShifts.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                Clear selection
              </button>
            </div>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Cancel Selected
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Types</option>
                <option value="PATROL">Patrol</option>
                <option value="COLLECTION">Collection</option>
                <option value="ON_CALL_FIELD_SUPPORT">On-Call Support</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Shifts Grid */}
        {shifts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                  shift.status === 'CANCELLED'
                    ? 'border-red-300 bg-red-50 opacity-75'
                    : selectedShifts.has(shift.id)
                    ? 'border-red-400 ring-2 ring-red-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {/* Checkbox for coordinators (non-cancelled shifts only) */}
                    {canCreateShift && shift.status !== 'CANCELLED' && (
                      <input
                        type="checkbox"
                        checked={selectedShifts.has(shift.id)}
                        onChange={() => toggleShiftSelection(shift.id)}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                      />
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      shift.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-700'
                        : `${typeColors[shift.type].bg} ${typeColors[shift.type].text}`
                    }`}>
                      {shift.status === 'CANCELLED' ? 'Cancelled' : typeLabels[shift.type]}
                    </span>
                  </div>
                  <span className={`text-sm ${shift.spotsLeft <= 1 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                    {shift.spotsLeft}/{shift.maxVolunteers} spots
                  </span>
                </div>

                <Link href={`/shifts/${shift.id}`} className="block group">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-teal-600 transition-colors">
                    {shift.title}
                  </h3>
                </Link>
                <p className="text-sm text-gray-500 mb-3">{shift.zone.name}</p>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDate(shift.date)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatTime(shift.startTime, shift.endTime)}</span>
                </div>

                {/* Show different UI based on shift status */}
                {shift.status === 'CANCELLED' ? (
                  <div className="text-center py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                    This shift has been cancelled
                  </div>
                ) : shift.userRsvpStatus ? (
                  <div className="space-y-2">
                    <div className={`text-center py-2 px-4 rounded-lg text-sm font-medium ${
                      shift.userRsvpStatus === 'CONFIRMED'
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {shift.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending Confirmation'}
                    </div>
                    <button
                      onClick={() => handleCancelRsvp(shift.id)}
                      disabled={rsvpingShiftId === shift.id}
                      className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {rsvpingShiftId === shift.id ? 'Canceling...' : 'Cancel RSVP'}
                    </button>
                  </div>
                ) : shift.spotsLeft > 0 ? (
                  <button
                    onClick={() => handleRsvp(shift.id)}
                    disabled={rsvpingShiftId === shift.id}
                    className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {rsvpingShiftId === shift.id ? 'Signing up...' : 'Sign Up'}
                  </button>
                ) : (
                  <div className="text-center py-2 px-4 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
                    Shift Full
                  </div>
                )}

                {/* Coordinator: Manage link (not for cancelled shifts) */}
                {canCreateShift && shift.status !== 'CANCELLED' && (
                  <Link
                    href={`/shifts/${shift.id}/roster`}
                    className="block text-center text-sm text-teal-600 hover:text-teal-700 mt-2"
                  >
                    Manage Roster {shift.pendingCount > 0 && `(${shift.pendingCount} pending)`}
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No shifts available matching your filters.</p>
            {canCreateShift && (
              <Link
                href="/shifts/create"
                className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                Create First Shift
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <CancelModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelShifts}
        selectedCount={selectedShifts.size}
        isSubmitting={isCancelling}
      />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { DevUser } from '@/types/auth';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useFeatures } from '@/hooks/useFeatures';

interface Zone {
  id: string;
  name: string;
}

interface TrainingType {
  id: string;
  name: string;
  slug: string;
  color: string;
  grantsRole: string | null;
}

interface Training {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingLink: string | null;
  status: string;
  maxAttendees: number;
  confirmedCount: number;
  pendingCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
  trainingType: TrainingType;
  zone: Zone | null;
}

export default function TrainingsPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.trainings]);

  const [user, setUser] = useState<DevUser | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [rsvpingTrainingId, setRsvpingTrainingId] = useState<string | null>(null);

  // View mode: 'cards' or 'list'
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');

  // Selection state for coordinators (with shift+click range selection)
  const selectableTrainings = trainings.filter(t => t.status !== 'CANCELLED');
  const {
    selectedIds: selectedTrainings,
    isSelected: isTrainingSelected,
    toggleSelection: toggleTrainingSelection,
    clearSelection,
    selectedCount,
  } = useMultiSelect({
    items: selectableTrainings,
    getId: (training) => training.id,
  });

  // Bulk action state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const fetchTrainings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('typeId', filterType);
      if (filterZone !== 'all') params.set('zoneId', filterZone);

      const res = await fetch(`/api/trainings?${params}`);
      if (!res.ok) throw new Error('Failed to fetch trainings');
      const data = await res.json();
      setTrainings(data);
    } catch {
      setError('Failed to load trainings');
    }
  }, [filterType, filterZone]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/training-types').then(res => res.json()),
      fetch('/api/zones').then(res => res.json()),
    ])
      .then(([sessionData, typesData, zonesData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        setUser(sessionData.user);
        if (Array.isArray(typesData)) {
          setTrainingTypes(typesData);
        }
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
      fetchTrainings();
    }
  }, [user, fetchTrainings]);

  const handleRsvp = async (trainingId: string) => {
    setRsvpingTrainingId(trainingId);
    setError(null);

    try {
      const res = await fetch(`/api/trainings/${trainingId}/rsvp`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }

      await fetchTrainings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setRsvpingTrainingId(null);
    }
  };

  const handleCancelRsvp = async (trainingId: string) => {
    setRsvpingTrainingId(trainingId);
    setError(null);

    try {
      const res = await fetch(`/api/trainings/${trainingId}/rsvp`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel');
      }

      await fetchTrainings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setRsvpingTrainingId(null);
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

  const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  // Bulk cancel handler
  const handleCancelTrainings = async (reason: string) => {
    setIsCancelling(true);
    setError(null);

    try {
      const res = await fetch('/api/trainings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: Array.from(selectedTrainings),
          reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel trainings');
      }

      await fetchTrainings();
      clearSelection();
      setShowCancelModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel trainings');
    } finally {
      setIsCancelling(false);
    }
  };

  // Bulk confirm RSVPs handler
  const handleConfirmRsvps = async () => {
    setIsConfirming(true);
    setError(null);

    try {
      const res = await fetch('/api/trainings/confirm-rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: Array.from(selectedTrainings),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm RSVPs');
      }

      await fetchTrainings();
      clearSelection();
      setShowConfirmModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm RSVPs');
    } finally {
      setIsConfirming(false);
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

  const canCreateTraining = user.role === 'COORDINATOR' || user.role === 'ADMINISTRATOR';

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Trainings</h1>
            <p className="text-gray-600">Browse and sign up for available training sessions</p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateTraining && (
              <Link
                href="/trainings/create"
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                + Schedule Training
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Selection Toolbar (Coordinator only) */}
        {canCreateTraining && selectedCount > 0 && (
          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium text-gray-700">
                {selectedCount} training{selectedCount > 1 ? 's' : ''} selected
              </span>
              <span className="text-xs text-gray-500">(Shift+click to select range)</span>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* Show pending count for selected trainings */}
              {(() => {
                const pendingCount = trainings
                  .filter(t => isTrainingSelected(t.id))
                  .reduce((sum, t) => sum + t.pendingCount, 0);
                return pendingCount > 0 ? (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                  >
                    Confirm {pendingCount} Pending
                  </button>
                ) : null;
              })()}
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Cancel Selected
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Types</option>
                  {trainingTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
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
            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Card View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Trainings Display */}
        {trainings.length > 0 ? (
          viewMode === 'list' ? (
            /* List View */
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {canCreateTraining && <th className="w-10 px-3 py-3"></th>}
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Training</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Spots</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="w-32 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trainings.map((training) => (
                    <tr
                      key={training.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        training.status === 'CANCELLED' ? 'bg-red-50/50 text-gray-500' : ''
                      } ${isTrainingSelected(training.id) ? 'bg-red-50' : ''}`}
                    >
                      {canCreateTraining && (
                        <td className="px-3 py-3">
                          {training.status !== 'CANCELLED' && (
                            <input
                              type="checkbox"
                              checked={isTrainingSelected(training.id)}
                              onClick={(e) => toggleTrainingSelection(training.id, e)}
                              onChange={() => {}} // Controlled by onClick for shift+click support
                              className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatDate(training.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatTime(training.startTime, training.endTime)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/trainings/${training.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-teal-600 transition-colors"
                        >
                          {training.title}
                        </Link>
                        {training.zone && (
                          <p className="text-xs text-gray-500">{training.zone.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${training.trainingType.color}20`,
                            color: training.trainingType.color,
                          }}
                        >
                          {training.trainingType.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {training.location || (training.meetingLink ? 'Virtual' : '—')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${training.spotsLeft <= 2 && training.status !== 'CANCELLED' ? 'text-orange-600 font-medium' : 'text-gray-600'}`}>
                          {training.confirmedCount}/{training.maxAttendees}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {training.status === 'CANCELLED' ? (
                          <span className="text-xs text-red-600">Cancelled</span>
                        ) : training.userRsvpStatus ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            training.userRsvpStatus === 'CONFIRMED'
                              ? 'bg-teal-100 text-teal-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {training.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                          </span>
                        ) : training.spotsLeft > 0 ? (
                          <span className="text-xs text-gray-500">Open</span>
                        ) : (
                          <span className="text-xs text-gray-400">Full</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {training.status === 'CANCELLED' ? null : training.userRsvpStatus ? (
                          <button
                            onClick={() => handleCancelRsvp(training.id)}
                            disabled={rsvpingTrainingId === training.id}
                            className="text-xs text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            {rsvpingTrainingId === training.id ? '...' : 'Cancel'}
                          </button>
                        ) : training.spotsLeft > 0 ? (
                          <button
                            onClick={() => handleRsvp(training.id)}
                            disabled={rsvpingTrainingId === training.id}
                            className="text-xs px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                          >
                            {rsvpingTrainingId === training.id ? '...' : 'Sign Up'}
                          </button>
                        ) : null}
                        {canCreateTraining && training.status !== 'CANCELLED' && (
                          <Link
                            href={`/trainings/${training.id}/roster`}
                            className="ml-2 text-xs text-teal-600 hover:text-teal-700"
                          >
                            Roster{training.pendingCount > 0 && ` (${training.pendingCount})`}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card View */
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainings.map((training) => (
                <div
                  key={training.id}
                  className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                    training.status === 'CANCELLED'
                      ? 'border-red-300 bg-red-50 opacity-75'
                      : isTrainingSelected(training.id)
                      ? 'border-red-400 ring-2 ring-red-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for coordinators (non-cancelled trainings only) */}
                      {canCreateTraining && training.status !== 'CANCELLED' && (
                        <input
                          type="checkbox"
                          checked={isTrainingSelected(training.id)}
                          onClick={(e) => toggleTrainingSelection(training.id, e)}
                          onChange={() => {}} // Controlled by onClick for shift+click support
                          className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                        />
                      )}
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${training.trainingType.color}20`,
                          color: training.trainingType.color,
                        }}
                      >
                        {training.trainingType.name}
                      </span>
                    </div>
                    <span className={`text-sm ${training.spotsLeft <= 2 ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                      {training.spotsLeft}/{training.maxAttendees} spots
                    </span>
                  </div>

                  <Link href={`/trainings/${training.id}`} className="block group">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-teal-600 transition-colors">
                      {training.title}
                    </h3>
                  </Link>
                  {training.zone && (
                    <p className="text-sm text-gray-500 mb-3">{training.zone.name}</p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(training.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatTime(training.startTime, training.endTime)}</span>
                    <span className="text-gray-400">({formatDuration(training.startTime, training.endTime)})</span>
                  </div>

                  {(training.location || training.meetingLink) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{training.location || 'Virtual'}</span>
                    </div>
                  )}

                  {/* Show different UI based on training status */}
                  {training.status === 'CANCELLED' ? (
                    <div className="text-center py-2 px-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                      This training has been cancelled
                    </div>
                  ) : training.userRsvpStatus ? (
                    <div className="space-y-2">
                      <div className={`text-center py-2 px-4 rounded-lg text-sm font-medium ${
                        training.userRsvpStatus === 'CONFIRMED'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {training.userRsvpStatus === 'CONFIRMED' ? 'Confirmed' : 'Pending Confirmation'}
                      </div>
                      <button
                        onClick={() => handleCancelRsvp(training.id)}
                        disabled={rsvpingTrainingId === training.id}
                        className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {rsvpingTrainingId === training.id ? 'Canceling...' : 'Cancel RSVP'}
                      </button>
                    </div>
                  ) : training.spotsLeft > 0 ? (
                    <button
                      onClick={() => handleRsvp(training.id)}
                      disabled={rsvpingTrainingId === training.id}
                      className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {rsvpingTrainingId === training.id ? 'Signing up...' : 'Sign Up'}
                    </button>
                  ) : (
                    <div className="text-center py-2 px-4 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
                      Training Full
                    </div>
                  )}

                  {/* Coordinator: Manage link */}
                  {canCreateTraining && training.status !== 'CANCELLED' && (
                    <Link
                      href={`/trainings/${training.id}/roster`}
                      className="block text-center text-sm text-teal-600 hover:text-teal-700 mt-2"
                    >
                      Manage Roster {training.pendingCount > 0 && `(${training.pendingCount} pending)`}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No trainings available matching your filters.</p>
            {canCreateTraining && (
              <Link
                href="/trainings/create"
                className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                Schedule First Training
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Trainings</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel {selectedCount} training{selectedCount > 1 ? 's' : ''}?
              All signed-up attendees will be notified by email.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <textarea
                id="cancel-reason"
                placeholder="e.g., Instructor unavailable, low enrollment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Keep Trainings
              </button>
              <button
                onClick={() => {
                  const reason = (document.getElementById('cancel-reason') as HTMLTextAreaElement)?.value || '';
                  handleCancelTrainings(reason);
                }}
                disabled={isCancelling}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Trainings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm RSVPs Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Pending RSVPs</h2>
            <p className="text-gray-600 mb-4">
              This will confirm all pending RSVPs across {selectedCount} selected training{selectedCount > 1 ? 's' : ''}.
              {(() => {
                const pendingCount = trainings
                  .filter(t => isTrainingSelected(t.id))
                  .reduce((sum, t) => sum + t.pendingCount, 0);
                return pendingCount > 0 ? (
                  <span className="block mt-2 font-medium text-teal-700">
                    {pendingCount} pending RSVP{pendingCount > 1 ? 's' : ''} will be confirmed.
                  </span>
                ) : null;
              })()}
            </p>

            <p className="text-sm text-gray-500 mb-4">
              Each attendee will receive a confirmation email.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isConfirming}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRsvps}
                disabled={isConfirming}
                className="flex-1 py-2 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50"
              >
                {isConfirming ? 'Confirming...' : 'Confirm All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

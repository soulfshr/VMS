'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFeatures } from '@/hooks/useFeatures';

interface Attendee {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW';
  createdAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
}

interface Training {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  trainingType: {
    name: string;
    color: string;
    grantsRole: string | null;
    grantsQualifiedRole: {
      id: string;
      name: string;
    } | null;
  };
  zone: {
    name: string;
  } | null;
  attendees: Attendee[];
  confirmedCount: number;
  pendingCount: number;
  maxAttendees: number;
  isCoordinator: boolean;
}

export default function TrainingRosterPage() {
  const params = useParams();
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.trainings]);

  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [resetModal, setResetModal] = useState<{ attendee: Attendee; revokeQualification: boolean } | null>(null);

  useEffect(() => {
    fetchTraining();
  }, [params.id]);

  const fetchTraining = async () => {
    try {
      const res = await fetch(`/api/trainings/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.isCoordinator) {
          router.push(`/trainings/${params.id}`);
          return;
        }
        setTraining(data);
      }
    } catch (error) {
      console.error('Error fetching training:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (attendeeId: string, status: string, markCompleted = false) => {
    setUpdating(attendeeId);
    try {
      const res = await fetch(`/api/trainings/${params.id}/rsvp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendeeId,
          status,
          completedAt: markCompleted ? new Date().toISOString() : undefined,
        }),
      });
      if (res.ok) {
        fetchTraining();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkConfirm = async () => {
    const pending = training?.attendees.filter(a => a.status === 'PENDING') || [];
    for (const attendee of pending) {
      await handleUpdateStatus(attendee.id, 'CONFIRMED');
    }
  };

  const handleBulkComplete = async () => {
    const confirmed = training?.attendees.filter(a => a.status === 'CONFIRMED' && !a.completedAt) || [];
    for (const attendee of confirmed) {
      await handleUpdateStatus(attendee.id, 'CONFIRMED', true);
    }
  };

  const handleResetCompletion = async () => {
    if (!resetModal) return;
    setUpdating(resetModal.attendee.id);
    try {
      const res = await fetch(`/api/trainings/${params.id}/rsvp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendeeId: resetModal.attendee.id,
          status: 'CONFIRMED',
          resetCompletion: true,
          revokeQualification: resetModal.revokeQualification,
        }),
      });
      if (res.ok) {
        fetchTraining();
      }
    } catch (error) {
      console.error('Error resetting completion:', error);
    } finally {
      setUpdating(null);
      setResetModal(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading roster...</div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Training not found or access denied</p>
        <Link href="/trainings" className="text-cyan-600 hover:underline">
          ← Back to trainings
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    });
  };

  const filteredAttendees = filter === 'all'
    ? training.attendees
    : filter === 'COMPLETED'
    ? training.attendees.filter(a => a.completedAt)
    : training.attendees.filter(a => a.status === filter && !a.completedAt);

  const statusCounts = {
    PENDING: training.attendees.filter(a => a.status === 'PENDING').length,
    CONFIRMED: training.attendees.filter(a => a.status === 'CONFIRMED' && !a.completedAt).length,
    COMPLETED: training.attendees.filter(a => a.completedAt).length,
    DECLINED: training.attendees.filter(a => a.status === 'DECLINED').length,
  };

  const roleLabels: Record<string, string> = {
    VOLUNTEER: 'Volunteer',
    COORDINATOR: 'Coordinator',
    DISPATCHER: 'Dispatcher',
    ADMINISTRATOR: 'Administrator',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/trainings/${training.id}`} className="text-cyan-600 hover:underline mb-2 inline-block">
          ← Back to training details
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Training Roster</h1>
            <p className="text-gray-600">
              {training.title} • {training.zone?.name || 'All Zones'} • {formatDate(training.date)} {formatTime(training.startTime)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${training.trainingType.color}20`,
                  color: training.trainingType.color,
                }}
              >
                {training.trainingType.name}
              </span>
              {training.trainingType.grantsRole && (
                <span className="text-xs text-purple-600">
                  Grants {roleLabels[training.trainingType.grantsRole]} role
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-cyan-600">{training.confirmedCount}/{training.maxAttendees}</p>
              <p className="text-sm text-gray-500">confirmed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{statusCounts.PENDING}</p>
          <p className="text-sm text-yellow-700">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{statusCounts.CONFIRMED}</p>
          <p className="text-sm text-green-700">Confirmed</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{statusCounts.COMPLETED}</p>
          <p className="text-sm text-purple-700">Completed</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{statusCounts.DECLINED}</p>
          <p className="text-sm text-red-700">Declined</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({training.attendees.length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'PENDING' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending ({statusCounts.PENDING})
          </button>
          <button
            onClick={() => setFilter('CONFIRMED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'CONFIRMED' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Confirmed ({statusCounts.CONFIRMED})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'COMPLETED' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed ({statusCounts.COMPLETED})
          </button>
        </div>
        <div className="flex gap-2">
          {statusCounts.PENDING > 0 && (
            <button
              onClick={handleBulkConfirm}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Confirm All Pending
            </button>
          )}
          {statusCounts.CONFIRMED > 0 && (
            <button
              onClick={handleBulkComplete}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              Mark All Complete
            </button>
          )}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attendee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAttendees.map((attendee) => (
              <tr key={attendee.id} className={`
                ${attendee.status === 'PENDING' ? 'bg-yellow-50' : ''}
                ${attendee.status === 'CONFIRMED' && !attendee.completedAt ? 'bg-green-50' : ''}
                ${attendee.completedAt ? 'bg-purple-50' : ''}
                ${attendee.status === 'DECLINED' ? 'bg-red-50' : ''}
              `}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{attendee.user.name}</div>
                  <div className="text-sm text-gray-500">
                    Signed up {new Date(attendee.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{attendee.user.email}</div>
                  {attendee.user.phone && (
                    <div className="text-sm text-gray-500">{attendee.user.phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {attendee.completedAt ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      COMPLETED
                    </span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      attendee.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      attendee.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                      attendee.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {attendee.status}
                    </span>
                  )}
                  {attendee.completedAt && training.trainingType.grantsRole && (
                    <span className="block text-xs text-purple-600 mt-1">
                      ✓ {roleLabels[training.trainingType.grantsRole]} granted
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {attendee.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'CONFIRMED')}
                        disabled={updating === attendee.id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        {updating === attendee.id ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'DECLINED')}
                        disabled={updating === attendee.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {attendee.status === 'CONFIRMED' && !attendee.completedAt && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'CONFIRMED', true)}
                        disabled={updating === attendee.id}
                        className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                      >
                        {updating === attendee.id ? 'Saving...' : 'Mark Complete'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'NO_SHOW')}
                        disabled={updating === attendee.id}
                        className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        No-Show
                      </button>
                    </div>
                  )}
                  {attendee.completedAt && (
                    <div className="flex justify-end items-center gap-3">
                      <span className="text-gray-400 text-xs">
                        {new Date(attendee.completedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => setResetModal({ attendee, revokeQualification: false })}
                        disabled={updating === attendee.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  {attendee.status === 'DECLINED' && (
                    <button
                      onClick={() => handleUpdateStatus(attendee.id, 'CONFIRMED')}
                      disabled={updating === attendee.id}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                    >
                      Re-confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAttendees.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {filter === 'all' ? 'No signups yet for this training.' : `No ${filter.toLowerCase()} attendees.`}
          </div>
        )}
      </div>

      {/* Reset Completion Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reset Training Completion</h3>
            <p className="text-gray-600 mb-4">
              This will reset the completion status for <strong>{resetModal.attendee.user.name}</strong> back to &quot;Confirmed&quot;.
            </p>
            {training?.trainingType.grantsQualifiedRole && (
              <label className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetModal.revokeQualification}
                  onChange={(e) => setResetModal({ ...resetModal, revokeQualification: e.target.checked })}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-red-800">Also revoke qualification</span>
                  <p className="text-sm text-red-600">
                    Remove the &quot;{training.trainingType.grantsQualifiedRole.name}&quot; qualification that was granted by this training.
                  </p>
                </div>
              </label>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResetModal(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetCompletion}
                disabled={updating === resetModal.attendee.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {updating === resetModal.attendee.id ? 'Resetting...' : 'Reset Completion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

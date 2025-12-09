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

interface TrainingSession {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  location: string | null;
  meetingLink: string | null;
  minAttendees: number;
  maxAttendees: number;
  trainingType: {
    id: string;
    name: string;
    slug: string;
    color: string;
    grantsRole: string | null;
    description: string | null;
  };
  zone: {
    id: string;
    name: string;
  } | null;
  attendees: Attendee[];
  createdBy: {
    id: string;
    name: string;
  };
  confirmedCount: number;
  pendingCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
  isCoordinator: boolean;
}

export default function TrainingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.trainings]);

  const [training, setTraining] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchTraining();
  }, [params.id]);

  const fetchTraining = async () => {
    try {
      const res = await fetch(`/api/trainings/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setTraining(data);
      }
    } catch (error) {
      console.error('Error fetching training:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async () => {
    try {
      const res = await fetch(`/api/trainings/${params.id}/rsvp`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchTraining();
      }
    } catch (error) {
      console.error('Error signing up:', error);
    }
  };

  const handleCancelRsvp = async () => {
    try {
      const res = await fetch(`/api/trainings/${params.id}/rsvp`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchTraining();
      }
    } catch (error) {
      console.error('Error canceling:', error);
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading training details...</div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Training not found</p>
        <Link href="/trainings" className="text-cyan-600 hover:underline">
          ← Back to trainings
        </Link>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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

  const formatDuration = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-green-100 text-green-800',
      DECLINED: 'bg-red-100 text-red-800',
      NO_SHOW: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  const pendingAttendees = training.attendees.filter(a => a.status === 'PENDING');
  const confirmedAttendees = training.attendees.filter(a => a.status === 'CONFIRMED');
  const otherAttendees = training.attendees.filter(a => !['PENDING', 'CONFIRMED'].includes(a.status));

  const roleLabels: Record<string, string> = {
    VOLUNTEER: 'Volunteer',
    COORDINATOR: 'Coordinator',
    DISPATCHER: 'Dispatcher',
    ADMINISTRATOR: 'Administrator',
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back link */}
      <Link href="/trainings" className="text-cyan-600 hover:underline mb-4 inline-block">
        ← Back to trainings
      </Link>

      {/* Training Details Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-2"
              style={{
                backgroundColor: `${training.trainingType.color}20`,
                color: training.trainingType.color,
              }}
            >
              {training.trainingType.name}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{training.title}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            training.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
            training.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {training.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-gray-600"><strong>Date:</strong> {formatDate(training.date)}</p>
            <p className="text-gray-600">
              <strong>Time:</strong> {formatTime(training.startTime)} - {formatTime(training.endTime)}
              <span className="text-gray-500 ml-2">({formatDuration(training.startTime, training.endTime)})</span>
            </p>
            {training.zone && (
              <p className="text-gray-600"><strong>Zone:</strong> {training.zone.name}</p>
            )}
            {training.location && (
              <p className="text-gray-600"><strong>Location:</strong> {training.location}</p>
            )}
            {training.meetingLink && (
              <p className="text-gray-600">
                <strong>Virtual:</strong>{' '}
                <a
                  href={training.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 hover:underline"
                >
                  Join Meeting
                </a>
              </p>
            )}
          </div>
          <div>
            <p className="text-gray-600">
              <strong>Attendees:</strong> {training.confirmedCount} confirmed / {training.maxAttendees} max
            </p>
            {training.pendingCount > 0 && (
              <p className="text-yellow-600">
                <strong>{training.pendingCount}</strong> pending approval
              </p>
            )}
            <p className="text-gray-600"><strong>Created by:</strong> {training.createdBy.name}</p>
            {training.trainingType.grantsRole && (
              <p className="text-purple-600">
                <strong>Grants Role:</strong> {roleLabels[training.trainingType.grantsRole]}
              </p>
            )}
          </div>
        </div>

        {(training.description || training.trainingType.description) && (
          <div className="border-t pt-4 mt-4">
            <p className="text-gray-700">{training.description || training.trainingType.description}</p>
          </div>
        )}

        {/* Volunteer Actions */}
        {!training.isCoordinator && training.status !== 'CANCELLED' && (
          <div className="border-t pt-4 mt-4">
            {training.userRsvpStatus === null && training.spotsLeft > 0 && (
              <button
                onClick={handleRsvp}
                className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Sign Up for this Training
              </button>
            )}
            {training.userRsvpStatus === 'PENDING' && (
              <div className="flex items-center gap-4">
                <span className="text-yellow-600 font-medium">Your signup is pending approval</span>
                <button
                  onClick={handleCancelRsvp}
                  className="text-red-600 hover:underline"
                >
                  Cancel Signup
                </button>
              </div>
            )}
            {training.userRsvpStatus === 'CONFIRMED' && (
              <div className="flex items-center gap-4">
                <span className="text-green-600 font-medium">You are confirmed for this training!</span>
                <button
                  onClick={handleCancelRsvp}
                  className="text-red-600 hover:underline"
                >
                  Cancel Signup
                </button>
              </div>
            )}
          </div>
        )}

        {training.status === 'CANCELLED' && (
          <div className="border-t pt-4 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              This training session has been cancelled.
            </div>
          </div>
        )}
      </div>

      {/* Roster Section (Coordinator Only) */}
      {training.isCoordinator && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Training Roster</h2>
            <Link
              href={`/trainings/${training.id}/roster`}
              className="text-cyan-600 hover:underline text-sm"
            >
              Open Full Roster View →
            </Link>
          </div>

          {/* Pending Approvals */}
          {pendingAttendees.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                Pending Approval ({pendingAttendees.length})
              </h3>
              <div className="space-y-3">
                {pendingAttendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{attendee.user.name}</p>
                      <p className="text-sm text-gray-600">{attendee.user.email}</p>
                      {attendee.user.phone && (
                        <p className="text-sm text-gray-600">{attendee.user.phone}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'CONFIRMED')}
                        disabled={updating === attendee.id}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {updating === attendee.id ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(attendee.id, 'DECLINED')}
                        disabled={updating === attendee.id}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed Attendees */}
          {confirmedAttendees.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Confirmed ({confirmedAttendees.length})
              </h3>
              <div className="space-y-2">
                {confirmedAttendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{attendee.user.name}</p>
                      <p className="text-sm text-gray-600">
                        {attendee.user.email} {attendee.user.phone && `• ${attendee.user.phone}`}
                      </p>
                      {attendee.completedAt && (
                        <p className="text-xs text-purple-600 font-medium">
                          ✓ Training Completed
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(attendee.status)}
                      {!attendee.completedAt && (
                        <button
                          onClick={() => handleUpdateStatus(attendee.id, 'CONFIRMED', true)}
                          disabled={updating === attendee.id}
                          className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other statuses */}
          {otherAttendees.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Other ({otherAttendees.length})</h3>
              <div className="space-y-2">
                {otherAttendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{attendee.user.name}</p>
                      <p className="text-sm text-gray-600">{attendee.user.email}</p>
                    </div>
                    {getStatusBadge(attendee.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {training.attendees.length === 0 && (
            <p className="text-gray-500 text-center py-8">No signups yet for this training.</p>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Volunteer {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW';
  createdAt: string;
  confirmedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    primaryLanguage: string;
  };
}

interface Shift {
  id: string;
  type: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  minVolunteers: number;
  idealVolunteers: number;
  maxVolunteers: number;
  meetingLocation: string | null;
  zone: {
    id: string;
    name: string;
  };
  typeConfig: {
    id: string;
    name: string;
    slug: string;
    color: string;
  } | null;
  volunteers: Volunteer[];
  createdBy: {
    id: string;
    name: string;
  };
  confirmedCount: number;
  pendingCount: number;
  spotsLeft: number;
  userRsvpStatus: string | null;
  isCoordinator: boolean;
  // Exception fields
  hasRoleException: boolean;
  exceptionNotes: string | null;
  exceptionReviewedById: string | null;
  exceptionReviewedAt: string | null;
}

export default function ShiftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [dismissingException, setDismissingException] = useState(false);

  useEffect(() => {
    fetchShift();
  }, [params.id]);

  const fetchShift = async () => {
    try {
      const res = await fetch(`/api/shifts/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setShift(data);
      } else if (res.status === 403) {
        // Access restricted in SIMPLE mode
        setAccessRestricted(true);
      }
    } catch (error) {
      console.error('Error fetching shift:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async () => {
    try {
      const res = await fetch(`/api/shifts/${params.id}/rsvp`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchShift();
      }
    } catch (error) {
      console.error('Error signing up:', error);
    }
  };

  const handleCancelRsvp = async () => {
    try {
      const res = await fetch(`/api/shifts/${params.id}/rsvp`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchShift();
      }
    } catch (error) {
      console.error('Error canceling:', error);
    }
  };

  const handleUpdateStatus = async (volunteerId: string, status: string) => {
    setUpdating(volunteerId);
    try {
      const res = await fetch(`/api/shifts/${params.id}/rsvp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId, status }),
      });
      if (res.ok) {
        fetchShift();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleDismissException = async (dismiss: boolean) => {
    setDismissingException(true);
    try {
      const res = await fetch(`/api/shifts/${params.id}/review-exception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss }),
      });
      if (res.ok) {
        fetchShift();
      }
    } catch (error) {
      console.error('Error updating exception:', error);
    } finally {
      setDismissingException(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading shift details...</div>
      </div>
    );
  }

  if (accessRestricted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium mb-2">Access Restricted</p>
          <p className="text-yellow-700 text-sm mb-4">
            Shift signup is currently restricted to qualified zone leads and dispatchers.
          </p>
          <Link href="/shifts" className="text-cyan-600 hover:underline">
            ← Back to shifts
          </Link>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Shift not found</p>
        <Link href="/shifts" className="text-cyan-600 hover:underline">
          ← Back to shifts
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

  const pendingVolunteers = shift.volunteers.filter(v => v.status === 'PENDING');
  const confirmedVolunteers = shift.volunteers.filter(v => v.status === 'CONFIRMED');
  const otherVolunteers = shift.volunteers.filter(v => !['PENDING', 'CONFIRMED'].includes(v.status));

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back link */}
      <Link href="/shifts" className="text-cyan-600 hover:underline mb-4 inline-block">
        ← Back to shifts
      </Link>

      {/* Shift Details Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm font-medium mb-2">
              {shift.typeConfig?.name || shift.type.replace(/_/g, ' ')}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{shift.title}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            shift.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {shift.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-gray-600"><strong>Date:</strong> {formatDate(shift.date)}</p>
            <p className="text-gray-600"><strong>Time:</strong> {formatTime(shift.startTime)} - {formatTime(shift.endTime)}</p>
            <p className="text-gray-600"><strong>Zone:</strong> {shift.zone?.name || 'No zone assigned'}</p>
            {shift.meetingLocation && (
              <p className="text-gray-600"><strong>Meeting Location:</strong> {shift.meetingLocation}</p>
            )}
          </div>
          <div>
            <p className="text-gray-600">
              <strong>Volunteers:</strong> {shift.confirmedCount} confirmed / {shift.maxVolunteers} max
            </p>
            {shift.pendingCount > 0 && (
              <p className="text-yellow-600">
                <strong>{shift.pendingCount}</strong> pending approval
              </p>
            )}
            <p className="text-gray-600"><strong>Created by:</strong> {shift.createdBy.name}</p>
          </div>
        </div>

        {shift.description && (
          <div className="border-t pt-4 mt-4">
            <p className="text-gray-700">{shift.description}</p>
          </div>
        )}

        {/* Exception Panel (Coordinator Only) */}
        {shift.isCoordinator && shift.hasRoleException && (
          <div className={`border-t pt-4 mt-4 ${shift.exceptionReviewedAt ? 'opacity-60' : ''}`}>
            <div className={`p-4 rounded-lg ${shift.exceptionReviewedAt ? 'bg-gray-50 border border-gray-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${shift.exceptionReviewedAt ? 'bg-gray-200' : 'bg-amber-200'}`}>
                    <svg className={`w-5 h-5 ${shift.exceptionReviewedAt ? 'text-gray-600' : 'text-amber-700'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${shift.exceptionReviewedAt ? 'text-gray-700' : 'text-amber-800'}`}>
                      {shift.exceptionReviewedAt ? 'Exception Reviewed' : 'Role Requirements Not Met'}
                    </h4>
                    {shift.exceptionNotes && (
                      <p className={`text-sm mt-1 ${shift.exceptionReviewedAt ? 'text-gray-600' : 'text-amber-700'}`}>
                        {shift.exceptionNotes}
                      </p>
                    )}
                    {shift.exceptionReviewedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Reviewed on {new Date(shift.exceptionReviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {shift.exceptionReviewedAt ? (
                    <button
                      onClick={() => handleDismissException(false)}
                      disabled={dismissingException}
                      className="text-sm text-gray-600 hover:text-gray-800 underline disabled:opacity-50"
                    >
                      {dismissingException ? 'Updating...' : 'Reopen'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDismissException(true)}
                      disabled={dismissingException}
                      className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {dismissingException ? 'Updating...' : 'Dismiss'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Volunteer Actions */}
        {!shift.isCoordinator && (
          <div className="border-t pt-4 mt-4">
            {shift.userRsvpStatus === null && shift.spotsLeft > 0 && (
              <button
                onClick={handleRsvp}
                className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Sign Up for this Shift
              </button>
            )}
            {shift.userRsvpStatus === 'PENDING' && (
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
            {shift.userRsvpStatus === 'CONFIRMED' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className="text-green-600 font-medium">You are confirmed for this shift!</span>
                  <button
                    onClick={handleCancelRsvp}
                    className="text-red-600 hover:underline"
                  >
                    Cancel Signup
                  </button>
                </div>
                <p className="text-sm text-gray-600">Check your email for a calendar invite.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OPTION 1: Roster Section (Coordinator Only) */}
      {shift.isCoordinator && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Shift Roster</h2>
            <Link
              href={`/shifts/${shift.id}/roster`}
              className="text-cyan-600 hover:underline text-sm"
            >
              Open Full Roster View →
            </Link>
          </div>

          {/* Pending Approvals */}
          {pendingVolunteers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                Pending Approval ({pendingVolunteers.length})
              </h3>
              <div className="space-y-3">
                {pendingVolunteers.map((volunteer) => (
                  <div
                    key={volunteer.id}
                    className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{volunteer.user.name}</p>
                      <p className="text-sm text-gray-600">{volunteer.user.email}</p>
                      {volunteer.user.phone && (
                        <p className="text-sm text-gray-600">{volunteer.user.phone}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateStatus(volunteer.user.id, 'CONFIRMED')}
                        disabled={updating === volunteer.user.id}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {updating === volunteer.user.id ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(volunteer.user.id, 'DECLINED')}
                        disabled={updating === volunteer.user.id}
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

          {/* Confirmed Volunteers */}
          {confirmedVolunteers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Confirmed ({confirmedVolunteers.length})
              </h3>
              <div className="space-y-2">
                {confirmedVolunteers.map((volunteer) => (
                  <div
                    key={volunteer.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{volunteer.user.name}</p>
                      <p className="text-sm text-gray-600">
                        {volunteer.user.email} {volunteer.user.phone && `• ${volunteer.user.phone}`}
                      </p>
                    </div>
                    {getStatusBadge(volunteer.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other statuses */}
          {otherVolunteers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Other ({otherVolunteers.length})</h3>
              <div className="space-y-2">
                {otherVolunteers.map((volunteer) => (
                  <div
                    key={volunteer.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{volunteer.user.name}</p>
                      <p className="text-sm text-gray-600">{volunteer.user.email}</p>
                    </div>
                    {getStatusBadge(volunteer.status)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {shift.volunteers.length === 0 && (
            <p className="text-gray-500 text-center py-8">No signups yet for this shift.</p>
          )}
        </div>
      )}
    </div>
  );
}

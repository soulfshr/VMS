'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Volunteer {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW';
  isZoneLead: boolean;
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
  date: string;
  startTime: string;
  endTime: string;
  zone: {
    name: string;
  };
  volunteers: Volunteer[];
  confirmedCount: number;
  pendingCount: number;
  maxVolunteers: number;
  isCoordinator: boolean;
}

export default function RosterPage() {
  const params = useParams();
  const router = useRouter();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchShift();
  }, [params.id]);

  const fetchShift = async () => {
    try {
      const res = await fetch(`/api/shifts/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.isCoordinator) {
          router.push(`/shifts/${params.id}`);
          return;
        }
        setShift(data);
      }
    } catch (error) {
      console.error('Error fetching shift:', error);
    } finally {
      setLoading(false);
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

  const handleBulkConfirm = async () => {
    const pending = shift?.volunteers.filter(v => v.status === 'PENDING') || [];
    for (const volunteer of pending) {
      await handleUpdateStatus(volunteer.user.id, 'CONFIRMED');
    }
  };

  const handleToggleZoneLead = async (volunteerId: string, isZoneLead: boolean) => {
    setUpdating(volunteerId);
    try {
      const res = await fetch(`/api/shifts/${params.id}/rsvp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteerId, isZoneLead }),
      });
      if (res.ok) {
        fetchShift();
      }
    } catch (error) {
      console.error('Error updating zone lead status:', error);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">Loading roster...</div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Shift not found or access denied</p>
        <Link href="/shifts" className="text-teal-600 hover:underline">
          ← Back to shifts
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
    });
  };

  const filteredVolunteers = filter === 'all'
    ? shift.volunteers
    : shift.volunteers.filter(v => v.status === filter);

  const statusCounts = {
    PENDING: shift.volunteers.filter(v => v.status === 'PENDING').length,
    CONFIRMED: shift.volunteers.filter(v => v.status === 'CONFIRMED').length,
    DECLINED: shift.volunteers.filter(v => v.status === 'DECLINED').length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/shifts/${shift.id}`} className="text-teal-600 hover:underline mb-2 inline-block">
          ← Back to shift details
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roster Management</h1>
            <p className="text-gray-600">
              {shift.title} • {shift.zone.name} • {formatDate(shift.date)} {formatTime(shift.startTime)}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-teal-600">{shift.confirmedCount}/{shift.maxVolunteers}</p>
              <p className="text-sm text-gray-500">confirmed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{statusCounts.PENDING}</p>
          <p className="text-sm text-yellow-700">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{statusCounts.CONFIRMED}</p>
          <p className="text-sm text-green-700">Confirmed</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{statusCounts.DECLINED}</p>
          <p className="text-sm text-red-700">Declined</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({shift.volunteers.length})
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
        </div>
        {statusCounts.PENDING > 0 && (
          <button
            onClick={handleBulkConfirm}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Confirm All Pending ({statusCounts.PENDING})
          </button>
        )}
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volunteer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Language
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zone Lead
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
            {filteredVolunteers.map((volunteer) => (
              <tr key={volunteer.id} className={`
                ${volunteer.status === 'PENDING' ? 'bg-yellow-50' : ''}
                ${volunteer.status === 'CONFIRMED' ? 'bg-green-50' : ''}
                ${volunteer.status === 'DECLINED' ? 'bg-red-50' : ''}
              `}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{volunteer.user.name}</div>
                  <div className="text-sm text-gray-500">
                    Signed up {new Date(volunteer.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{volunteer.user.email}</div>
                  {volunteer.user.phone && (
                    <div className="text-sm text-gray-500">{volunteer.user.phone}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {volunteer.user.primaryLanguage}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => handleToggleZoneLead(volunteer.user.id, !volunteer.isZoneLead)}
                    disabled={updating === volunteer.user.id || volunteer.status === 'DECLINED'}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                      volunteer.isZoneLead
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={volunteer.isZoneLead ? 'Remove zone lead designation' : 'Designate as zone lead'}
                  >
                    {volunteer.isZoneLead ? 'Zone Lead' : 'Volunteer'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    volunteer.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    volunteer.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                    volunteer.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {volunteer.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {volunteer.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleUpdateStatus(volunteer.user.id, 'CONFIRMED')}
                        disabled={updating === volunteer.user.id}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        {updating === volunteer.user.id ? 'Saving...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(volunteer.user.id, 'DECLINED')}
                        disabled={updating === volunteer.user.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {volunteer.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleUpdateStatus(volunteer.user.id, 'NO_SHOW')}
                      disabled={updating === volunteer.user.id}
                      className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      Mark No-Show
                    </button>
                  )}
                  {volunteer.status === 'DECLINED' && (
                    <button
                      onClick={() => handleUpdateStatus(volunteer.user.id, 'CONFIRMED')}
                      disabled={updating === volunteer.user.id}
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
        {filteredVolunteers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {filter === 'all' ? 'No signups yet for this shift.' : `No ${filter.toLowerCase()} volunteers.`}
          </div>
        )}
      </div>
    </div>
  );
}

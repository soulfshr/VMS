'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DevUser } from '@/types/auth';

interface Zone {
  id: string;
  name: string;
  county: string | null;
  isPrimary?: boolean;
}

interface Training {
  id: string;
  name: string;
  slug: string;
  completedAt: string | null;
}

interface UpcomingShift {
  id: string;
  title: string;
  date: string;
  isZoneLead: boolean;
}

interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  primaryLanguage: string;
  otherLanguages: string[];
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  zones: Zone[];
  completedTrainings: Training[];
  upcomingShifts: UpcomingShift[];
  totalConfirmedShifts: number;
}

interface VolunteersData {
  volunteers: Volunteer[];
  zones: Zone[];
  total: number;
}

export default function VolunteersPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VolunteersData | null>(null);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expandedVolunteer, setExpandedVolunteer] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else if (!['COORDINATOR', 'ADMINISTRATOR'].includes(data.user.role)) {
          router.push('/dashboard');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // Fetch volunteers
  const fetchVolunteers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (zoneFilter !== 'all') params.set('zone', zoneFilter);
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/volunteers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch volunteers');
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    } finally {
      setLoading(false);
    }
  }, [user, search, zoneFilter, roleFilter, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVolunteers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchVolunteers]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMINISTRATOR':
        return 'bg-red-100 text-red-800';
      case 'COORDINATOR':
        return 'bg-purple-100 text-purple-800';
      case 'DISPATCHER':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrainingBadgeColor = (slug: string) => {
    switch (slug) {
      case 'DISPATCHER':
        return 'bg-blue-100 text-blue-800';
      case 'ZONE_LEAD':
        return 'bg-purple-100 text-purple-800';
      case 'VERIFIER':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Volunteer Roster</h1>
          <p className="text-gray-600 mt-1">
            View and manage all volunteers across the organization
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Zone filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select
                value={zoneFilter}
                onChange={e => setZoneFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="all">All Zones</option>
                {data?.zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="all">All Roles</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="COORDINATOR">Coordinator</option>
                <option value="DISPATCHER">Dispatcher</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-teal-600">{data.total}</p>
              <p className="text-sm text-gray-600">Total Volunteers</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-green-600">
                {data.volunteers.filter(v => v.isActive).length}
              </p>
              <p className="text-sm text-gray-600">Active</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-blue-600">
                {data.volunteers.filter(v => v.completedTrainings.some(t => t.slug === 'DISPATCHER')).length}
              </p>
              <p className="text-sm text-gray-600">Qualified Dispatchers</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-3xl font-bold text-purple-600">
                {data.volunteers.filter(v => v.completedTrainings.some(t => t.slug === 'ZONE_LEAD')).length}
              </p>
              <p className="text-sm text-gray-600">Qualified Zone Leads</p>
            </div>
          </div>
        )}

        {/* Volunteer List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : data && data.volunteers.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
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
                      Zones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qualifications
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shifts
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.volunteers.map(volunteer => (
                    <>
                      <tr
                        key={volunteer.id}
                        className={`hover:bg-gray-50 cursor-pointer ${!volunteer.isActive ? 'opacity-60' : ''}`}
                        onClick={() => setExpandedVolunteer(expandedVolunteer === volunteer.id ? null : volunteer.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-medium">
                              {volunteer.name.charAt(0)}
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">{volunteer.name}</div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(volunteer.role)}`}>
                                  {volunteer.role}
                                </span>
                                <span className="text-xs text-gray-500">{volunteer.primaryLanguage}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{volunteer.email}</div>
                          {volunteer.phone && (
                            <div className="text-sm text-gray-500">{volunteer.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {volunteer.zones.length > 0 ? (
                              volunteer.zones.map(zone => (
                                <span
                                  key={zone.id}
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    zone.isPrimary
                                      ? 'bg-teal-100 text-teal-800 font-medium'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {zone.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-sm">No zones</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {volunteer.completedTrainings.length > 0 ? (
                              volunteer.completedTrainings.map(training => (
                                <span
                                  key={training.id}
                                  className={`px-2 py-0.5 rounded text-xs ${getTrainingBadgeColor(training.slug)}`}
                                >
                                  {training.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-sm">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {volunteer.totalConfirmedShifts}
                          </div>
                          <div className="text-xs text-gray-500">completed</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            volunteer.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {volunteer.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                      {/* Expanded Details */}
                      {expandedVolunteer === volunteer.id && (
                        <tr key={`${volunteer.id}-details`}>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Upcoming Shifts */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Upcoming Shifts</h4>
                                {volunteer.upcomingShifts.length > 0 ? (
                                  <ul className="space-y-1">
                                    {volunteer.upcomingShifts.map(shift => (
                                      <li key={shift.id} className="text-sm">
                                        <Link
                                          href={`/shifts/${shift.id}`}
                                          className="text-teal-600 hover:text-teal-800"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {shift.title}
                                        </Link>
                                        <span className="text-gray-500 ml-2">
                                          {formatDate(shift.date)}
                                        </span>
                                        {shift.isZoneLead && (
                                          <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                            Zone Lead
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-400">No upcoming shifts</p>
                                )}
                              </div>

                              {/* Additional Info */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Info</h4>
                                <div className="space-y-1 text-sm">
                                  <p>
                                    <span className="text-gray-500">Languages:</span>{' '}
                                    {[volunteer.primaryLanguage, ...volunteer.otherLanguages].join(', ')}
                                  </p>
                                  <p>
                                    <span className="text-gray-500">Member since:</span>{' '}
                                    {formatDate(volunteer.createdAt)}
                                  </p>
                                  <p>
                                    <span className="text-gray-500">Verified:</span>{' '}
                                    {volunteer.isVerified ? 'Yes' : 'No'}
                                  </p>
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Actions</h4>
                                <div className="space-y-2">
                                  <a
                                    href={`mailto:${volunteer.email}`}
                                    className="block px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Send Email
                                  </a>
                                  {volunteer.phone && (
                                    <a
                                      href={`tel:${volunteer.phone}`}
                                      className="block px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      Call
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">No volunteers found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

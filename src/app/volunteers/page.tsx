'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  errors: { row: number; email: string; error: string }[];
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
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle role change
  const handleRoleChange = async (volunteerId: string, newRole: string) => {
    if (!user || user.role !== 'ADMINISTRATOR') return;

    setUpdatingRole(volunteerId);
    try {
      const res = await fetch(`/api/volunteers/${volunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        // Update local state
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            volunteers: prev.volunteers.map(v =>
              v.id === volunteerId ? { ...v, role: newRole } : v
            ),
          };
        });
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  };

  // Handle active status toggle
  const handleToggleActive = async (volunteerId: string, isActive: boolean) => {
    if (!user || user.role !== 'ADMINISTRATOR') return;

    try {
      const res = await fetch(`/api/volunteers/${volunteerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            volunteers: prev.volunteers.map(v =>
              v.id === volunteerId ? { ...v, isActive } : v
            ),
          };
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Parse CSV data
  const parseCSV = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const volunteers = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const volunteer: Record<string, string | string[]> = {};

      headers.forEach((header, idx) => {
        const value = values[idx] || '';
        // Map common header variations
        if (header === 'name' || header === 'full name' || header === 'fullname') {
          volunteer.name = value;
        } else if (header === 'email' || header === 'email address') {
          volunteer.email = value;
        } else if (header === 'phone' || header === 'phone number') {
          volunteer.phone = value;
        } else if (header === 'role') {
          volunteer.role = value.toUpperCase();
        } else if (header === 'language' || header === 'primary language' || header === 'primarylanguage') {
          volunteer.primaryLanguage = value;
        } else if (header === 'zones' || header === 'zone') {
          volunteer.zones = value.split(';').map(z => z.trim()).filter(Boolean);
        }
      });

      if (volunteer.email && volunteer.name) {
        volunteers.push(volunteer);
      }
    }

    return volunteers;
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportData(text);
    };
    reader.readAsText(file);
  };

  // Handle bulk import
  const handleImport = async () => {
    if (!importData.trim()) {
      alert('Please paste CSV data or upload a file');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const volunteers = parseCSV(importData);
      if (volunteers.length === 0) {
        alert('No valid volunteers found in the CSV data');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volunteers }),
      });

      const result = await res.json();
      setImportResult(result);

      if (result.created > 0 || result.updated > 0) {
        fetchVolunteers();
      }
    } catch (error) {
      console.error('Error importing volunteers:', error);
      alert('Failed to import volunteers');
    } finally {
      setImporting(false);
    }
  };

  // Close import modal and reset
  const closeImportModal = () => {
    setShowImportModal(false);
    setImportData('');
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMINISTRATOR';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Volunteer Roster</h1>
            <p className="text-gray-600 mt-1">
              View and manage all volunteers across the organization
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowImportModal(true)}
              className="mt-4 md:mt-0 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Volunteers
            </button>
          )}
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
                      Role
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
                              <span className="text-xs text-gray-500">{volunteer.primaryLanguage}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{volunteer.email}</div>
                          {volunteer.phone && (
                            <div className="text-sm text-gray-500">{volunteer.phone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <select
                              value={volunteer.role}
                              onChange={e => handleRoleChange(volunteer.id, e.target.value)}
                              disabled={updatingRole === volunteer.id || volunteer.id === user.id}
                              className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${getRoleBadgeColor(volunteer.role)} ${
                                updatingRole === volunteer.id ? 'opacity-50' : ''
                              } ${volunteer.id === user.id ? 'cursor-not-allowed' : ''}`}
                              title={volunteer.id === user.id ? 'Cannot change your own role' : 'Change role'}
                            >
                              <option value="VOLUNTEER">VOLUNTEER</option>
                              <option value="COORDINATOR">COORDINATOR</option>
                              <option value="DISPATCHER">DISPATCHER</option>
                              <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(volunteer.role)}`}>
                              {volunteer.role}
                            </span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <button
                              onClick={() => handleToggleActive(volunteer.id, !volunteer.isActive)}
                              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                volunteer.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {volunteer.isActive ? 'Active' : 'Inactive'}
                            </button>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              volunteer.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {volunteer.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                      </tr>
                      {/* Expanded Details */}
                      {expandedVolunteer === volunteer.id && (
                        <tr key={`${volunteer.id}-details`}>
                          <td colSpan={7} className="px-6 py-4 bg-gray-50">
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Import Volunteers</h2>
                <button
                  onClick={closeImportModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!importResult ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Upload a CSV file or paste CSV data. Required columns: <strong>name</strong>, <strong>email</strong>
                    </p>
                    <p className="text-sm text-gray-500">
                      Optional columns: phone, role (VOLUNTEER/COORDINATOR/DISPATCHER/ADMINISTRATOR), primaryLanguage, zones (semicolon-separated)
                    </p>
                  </div>

                  {/* Download Template */}
                  <div className="mb-4 p-3 bg-teal-50 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-teal-800">Need a template?</p>
                      <p className="text-xs text-teal-600">Download a CSV template with example data</p>
                    </div>
                    <button
                      onClick={() => {
                        const template = `name,email,phone,role,primaryLanguage,zones
John Doe,john.doe@example.com,919-555-1234,VOLUNTEER,English,Durham Zone 1;Durham Zone 2
Maria Garcia,maria.garcia@example.com,919-555-5678,COORDINATOR,Spanish,Wake Zone 1
James Wilson,james.wilson@example.com,919-555-9012,VOLUNTEER,English,Orange Zone 1
Ana Martinez,ana.martinez@example.com,919-555-3456,DISPATCHER,Spanish,Durham Zone 3
Michael Chen,michael.chen@example.com,919-555-7890,VOLUNTEER,Mandarin,Wake Zone 2`;
                        const blob = new Blob([template], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'volunteer_import_template.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Template
                    </button>
                  </div>

                  {/* File Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                    />
                  </div>

                  {/* Or paste data */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Or Paste CSV Data</label>
                    <textarea
                      value={importData}
                      onChange={e => setImportData(e.target.value)}
                      placeholder={`name,email,phone,role,primaryLanguage,zones
John Doe,john@example.com,555-1234,VOLUNTEER,English,Zone 1;Zone 2
Jane Smith,jane@example.com,555-5678,COORDINATOR,Spanish,Zone 3`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                      rows={8}
                    />
                  </div>

                  {/* Preview count */}
                  {importData && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Found <strong>{parseCSV(importData).length}</strong> volunteers to import
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={closeImportModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || !importData.trim()}
                      className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importing ? 'Importing...' : 'Import Volunteers'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Import Results */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                        <p className="text-sm text-green-700">Created</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                        <p className="text-sm text-blue-700">Updated</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{importResult.errors.length}</p>
                        <p className="text-sm text-red-700">Errors</p>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Errors:</h3>
                        <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                          {importResult.errors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-700">
                              Row {err.row} ({err.email}): {err.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={closeImportModal}
                      className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

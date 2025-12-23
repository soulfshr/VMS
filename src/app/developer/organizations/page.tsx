'use client';

import { useEffect, useState } from 'react';

interface OrgStats {
  users: number;
  zones: number;
  shifts?: number;
  trainingSessions?: number;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: string;
  settings: {
    orgName: string;
    logoUrl: string | null;
  } | null;
  stats: OrgStats;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    website: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/developer/organizations');
      if (!res.ok) throw new Error('Failed to fetch organizations');
      const data = await res.json();
      setOrganizations(data.organizations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/developer/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setOrganizations(prev => [...prev, data.organization]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingOrg) return;

    setIsSaving(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/developer/organizations/${editingOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update organization');
      }

      setOrganizations(prev =>
        prev.map(org => org.id === editingOrg.id ? data.organization : org)
      );
      setEditingOrg(null);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    try {
      const res = await fetch(`/api/developer/organizations/${org.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !org.isActive }),
      });

      if (!res.ok) throw new Error('Failed to update organization');

      const data = await res.json();
      setOrganizations(prev =>
        prev.map(o => o.id === org.id ? data.organization : o)
      );
    } catch (err) {
      console.error('Error toggling organization:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      email: '',
      phone: '',
      website: '',
    });
    setFormError(null);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      email: org.email || '',
      phone: org.phone || '',
      website: org.website || '',
    });
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600 mt-1">Manage all organizations across the platform</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          + New Organization
        </button>
      </div>

      {/* Organization Cards */}
      <div className="grid gap-4">
        {organizations.map(org => (
          <div
            key={org.id}
            className={`bg-white rounded-xl border ${
              org.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
            } p-6`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    org.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {org.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {org.slug}.ripple-vms.com
                  </span>
                  {org.email && <span>{org.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(org)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(org)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    org.isActive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {org.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 flex gap-6">
              <div>
                <div className="text-2xl font-bold text-gray-900">{org.stats.users}</div>
                <div className="text-sm text-gray-500">Users</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{org.stats.zones}</div>
                <div className="text-sm text-gray-500">Zones</div>
              </div>
              {org.stats.shifts !== undefined && (
                <div>
                  <div className="text-2xl font-bold text-gray-900">{org.stats.shifts}</div>
                  <div className="text-sm text-gray-500">Shifts</div>
                </div>
              )}
              {org.stats.trainingSessions !== undefined && (
                <div>
                  <div className="text-2xl font-bold text-gray-900">{org.stats.trainingSessions}</div>
                  <div className="text-sm text-gray-500">Training Sessions</div>
                </div>
              )}
            </div>

            {/* Contact Info */}
            {(org.phone || org.website) && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 text-sm text-gray-500">
                {org.phone && <span>Phone: {org.phone}</span>}
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:underline"
                  >
                    {org.website}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-4">🏢</div>
          <h3 className="text-lg font-medium text-gray-900">No organizations yet</h3>
          <p className="text-gray-500 mt-1">Create your first organization to get started</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingOrg) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowCreateModal(false);
              setEditingOrg(null);
              resetForm();
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingOrg ? 'Edit Organization' : 'Create Organization'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    setFormData(prev => ({
                      ...prev,
                      name: e.target.value,
                      // Auto-generate slug only for new orgs
                      ...(!editingOrg && { slug: generateSlug(e.target.value) }),
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Siembra NC Triangle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subdomain Slug *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="nc"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-500 text-sm">
                    .ripple-vms.com
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="contact@example.org"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="(919) 555-0123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="https://example.org"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingOrg(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingOrg ? handleUpdate : handleCreate}
                disabled={isSaving || !formData.name || !formData.slug}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

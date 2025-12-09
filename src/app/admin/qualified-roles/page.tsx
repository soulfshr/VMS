'use client';

import { useEffect, useState } from 'react';

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isDefaultForNewUsers: boolean;
  countsTowardMinimum: boolean;
  _count: {
    userQualifications: number;
    shiftTypeRequirements: number;
    trainingTypeGrants: number;
    shiftVolunteers: number;
  };
}

export default function QualifiedRolesPage() {
  const [qualifiedRoles, setQualifiedRoles] = useState<QualifiedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#6366f1',
    isDefaultForNewUsers: false,
    countsTowardMinimum: true,
  });

  useEffect(() => {
    loadQualifiedRoles();
  }, []);

  const loadQualifiedRoles = async () => {
    try {
      const res = await fetch('/api/admin/qualified-roles');
      const data = await res.json();
      if (Array.isArray(data)) {
        setQualifiedRoles(data);
      }
    } catch (err) {
      console.error('Error loading qualified roles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '#6366f1',
      isDefaultForNewUsers: false,
      countsTowardMinimum: true,
    });
  };

  const startEdit = (qr: QualifiedRole) => {
    setEditingId(qr.id);
    setIsCreating(false);
    setFormData({
      name: qr.name,
      slug: qr.slug,
      description: qr.description || '',
      color: qr.color,
      isDefaultForNewUsers: qr.isDefaultForNewUsers,
      countsTowardMinimum: qr.countsTowardMinimum,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    resetForm();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    resetForm();
  };

  const handleSave = async () => {
    setMessage(null);

    try {
      const url = isCreating
        ? '/api/admin/qualified-roles'
        : `/api/admin/qualified-roles/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: isCreating ? 'Qualified role created' : 'Qualified role updated' });
      cancelEdit();
      loadQualifiedRoles();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this qualified role?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/qualified-roles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadQualifiedRoles();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (qr: QualifiedRole) => {
    try {
      const res = await fetch(`/api/admin/qualified-roles/${qr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !qr.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadQualifiedRoles();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Qualified Roles</h1>
          <p className="text-gray-600 mt-1">
            Manage roles that volunteers can earn through training to fill shift positions
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Qualified Role
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isCreating ? 'Create New Qualified Role' : 'Edit Qualified Role'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Verifier"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="e.g., VERIFIER"
              />
              {editingId && <p className="text-xs text-gray-500 mt-1">Slug is a database label and not visible in the main app. It cannot be changed after creation.</p>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={2}
              placeholder="Brief description of this qualified role..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.color}
                onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefaultForNewUsers}
                onChange={e => setFormData(prev => ({ ...prev, isDefaultForNewUsers: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700">Default for new users</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              When checked, this qualified role will be automatically assigned to all new volunteers
            </p>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.countsTowardMinimum}
                onChange={e => setFormData(prev => ({ ...prev, countsTowardMinimum: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700">Counts toward shift minimum</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              When unchecked, volunteers with this role won&apos;t count toward the minimum required volunteers for shifts (e.g., Shadowers)
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Qualified Role' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Qualified Roles List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qualified Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {qualifiedRoles.map(qr => (
              <tr key={qr.id} className={!qr.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: qr.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{qr.name}</span>
                        {qr.isDefaultForNewUsers && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            Default
                          </span>
                        )}
                        {!qr.countsTowardMinimum && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            Shadow
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                  {qr.description || <span className="text-gray-500">No description</span>}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {qr._count.userQualifications} users
                  </span>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(qr)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      qr.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {qr.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(qr)}
                      className="text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(qr.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {qualifiedRoles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No qualified roles found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About Qualified Roles</h3>
        <p className="text-sm text-blue-700">
          Qualified roles represent positions that volunteers can fill during shifts (e.g., Verifier, Zone Lead, Dispatcher).
          Volunteers earn qualified roles by completing training sessions configured to grant specific roles.
          Administrators can also manually assign qualified roles to volunteers.
        </p>
      </div>
    </div>
  );
}

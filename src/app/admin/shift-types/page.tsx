'use client';

import { useEffect, useState } from 'react';

interface QualificationRequirement {
  id: string;
  qualification: string;
  qualifiedRoleId?: string;
  qualifiedRole?: {
    id: string;
    name: string;
    slug: string;
    color: string;
  };
  minRequired: number;
  maxAllowed: number | null;
}

interface ShiftType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  defaultMinVolunteers: number;
  defaultIdealVolunteers: number;
  defaultMaxVolunteers: number;
  sortOrder: number;
  isActive: boolean;
  qualificationRequirements: QualificationRequirement[];
  qualifiedRoleRequirements: QualificationRequirement[];
  _count: {
    shifts: number;
  };
}

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
  isActive: boolean;
}

export default function ShiftTypesPage() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [qualifiedRoles, setQualifiedRoles] = useState<QualifiedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state - using qualifiedRoleId instead of qualification enum
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    color: '#3b82f6',
    defaultMinVolunteers: 2,
    defaultIdealVolunteers: 4,
    defaultMaxVolunteers: 6,
    qualifiedRoleRequirements: [] as { qualifiedRoleId: string; minRequired: number; maxAllowed: number | null }[],
  });

  useEffect(() => {
    Promise.all([loadShiftTypes(), loadQualifiedRoles()]);
  }, []);

  const loadQualifiedRoles = async () => {
    try {
      const res = await fetch('/api/admin/qualified-roles');
      const data = await res.json();
      if (Array.isArray(data)) {
        setQualifiedRoles(data.filter((qr: QualifiedRole) => qr.isActive));
      }
    } catch (err) {
      console.error('Error loading qualified roles:', err);
    }
  };

  // Helper to get qualified role name by ID
  const getQualifiedRoleName = (id: string) => {
    const role = qualifiedRoles.find(qr => qr.id === id);
    return role?.name || id;
  };

  const loadShiftTypes = async () => {
    try {
      const res = await fetch('/api/admin/shift-types');
      const data = await res.json();
      if (Array.isArray(data)) {
        setShiftTypes(data);
      }
    } catch (err) {
      console.error('Error loading shift types:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '#3b82f6',
      defaultMinVolunteers: 2,
      defaultIdealVolunteers: 4,
      defaultMaxVolunteers: 6,
      qualifiedRoleRequirements: [],
    });
  };

  const startEdit = (st: ShiftType) => {
    setEditingId(st.id);
    setIsCreating(false);
    // Use new qualifiedRoleRequirements if available, fall back to old format
    const requirements = st.qualifiedRoleRequirements?.length > 0
      ? st.qualifiedRoleRequirements.map(qr => ({
          qualifiedRoleId: qr.qualifiedRoleId || qr.qualifiedRole?.id || '',
          minRequired: qr.minRequired,
          maxAllowed: qr.maxAllowed,
        }))
      : st.qualificationRequirements?.map(qr => {
          // Map old enum to new ID
          const matchingRole = qualifiedRoles.find(r => r.slug === qr.qualification);
          return {
            qualifiedRoleId: matchingRole?.id || '',
            minRequired: qr.minRequired,
            maxAllowed: qr.maxAllowed,
          };
        }) || [];

    setFormData({
      name: st.name,
      slug: st.slug,
      description: st.description || '',
      color: st.color,
      defaultMinVolunteers: st.defaultMinVolunteers,
      defaultIdealVolunteers: st.defaultIdealVolunteers,
      defaultMaxVolunteers: st.defaultMaxVolunteers,
      qualifiedRoleRequirements: requirements,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    resetForm();
    // Add default verifier qualified role requirement if available
    const verifierRole = qualifiedRoles.find(qr => qr.slug === 'VERIFIER');
    if (verifierRole) {
      setFormData(prev => ({
        ...prev,
        qualifiedRoleRequirements: [{ qualifiedRoleId: verifierRole.id, minRequired: 2, maxAllowed: null }],
      }));
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    resetForm();
  };

  const addQualifiedRoleRequirement = () => {
    const usedRoleIds = formData.qualifiedRoleRequirements.map(qr => qr.qualifiedRoleId);
    const availableRoles = qualifiedRoles.filter(qr => !usedRoleIds.includes(qr.id));
    if (availableRoles.length === 0) return;

    setFormData(prev => ({
      ...prev,
      qualifiedRoleRequirements: [
        ...prev.qualifiedRoleRequirements,
        { qualifiedRoleId: availableRoles[0].id, minRequired: 0, maxAllowed: null },
      ],
    }));
  };

  const removeQualifiedRoleRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      qualifiedRoleRequirements: prev.qualifiedRoleRequirements.filter((_, i) => i !== index),
    }));
  };

  const updateQualifiedRoleRequirement = (index: number, field: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      qualifiedRoleRequirements: prev.qualifiedRoleRequirements.map((qr, i) =>
        i === index ? { ...qr, [field]: value } : qr
      ),
    }));
  };

  const handleSave = async () => {
    setMessage(null);

    try {
      const url = isCreating
        ? '/api/admin/shift-types'
        : `/api/admin/shift-types/${editingId}`;
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

      setMessage({ type: 'success', text: isCreating ? 'Shift type created' : 'Shift type updated' });
      cancelEdit();
      loadShiftTypes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this shift type?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/shift-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadShiftTypes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (st: ShiftType) => {
    try {
      const res = await fetch(`/api/admin/shift-types/${st.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !st.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadShiftTypes();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Types</h1>
          <p className="text-gray-600 mt-1">Manage shift types and their qualification requirements</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            + Add Shift Type
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
            {isCreating ? 'Create New Shift Type' : 'Edit Shift Type'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Patrol"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toUpperCase() }))}
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="e.g., PATROL"
              />
              {editingId && <p className="text-xs text-gray-500 mt-1">Slug is a database label and not visible in the main app. It cannot be changed after creation.</p>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="Brief description of this shift type..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Volunteers</label>
              <input
                type="number"
                min="1"
                value={formData.defaultMinVolunteers}
                onChange={e => setFormData(prev => ({ ...prev, defaultMinVolunteers: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ideal Volunteers</label>
              <input
                type="number"
                min="1"
                value={formData.defaultIdealVolunteers}
                onChange={e => setFormData(prev => ({ ...prev, defaultIdealVolunteers: parseInt(e.target.value) || 2 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Volunteers</label>
              <input
                type="number"
                min="1"
                value={formData.defaultMaxVolunteers}
                onChange={e => setFormData(prev => ({ ...prev, defaultMaxVolunteers: parseInt(e.target.value) || 4 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Qualified Role Requirements */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Qualified Role Requirements</label>
              <button
                type="button"
                onClick={addQualifiedRoleRequirement}
                disabled={qualifiedRoles.length === 0}
                className="text-sm text-teal-600 hover:text-teal-700 disabled:text-gray-400"
              >
                + Add Qualified Role
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Define how many of each qualified role are needed for this shift type (e.g., 1 Zone Lead + 3 Verifiers)
            </p>

            {formData.qualifiedRoleRequirements.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No qualified role requirements defined</p>
            ) : (
              <div className="space-y-2">
                {formData.qualifiedRoleRequirements.map((qr, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <select
                      value={qr.qualifiedRoleId}
                      onChange={e => updateQualifiedRoleRequirement(index, 'qualifiedRoleId', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {qualifiedRoles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Min:</span>
                      <input
                        type="number"
                        min="0"
                        value={qr.minRequired}
                        onChange={e => updateQualifiedRoleRequirement(index, 'minRequired', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Max:</span>
                      <input
                        type="number"
                        min="0"
                        value={qr.maxAllowed ?? ''}
                        onChange={e => updateQualifiedRoleRequirement(index, 'maxAllowed', e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞"
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQualifiedRoleRequirement(index)}
                      className="text-red-500 hover:text-red-700 ml-auto"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Shift Type' : 'Save Changes'}
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

      {/* Shift Types List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shift Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qualified Role Requirements
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volunteers
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Shifts
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
            {shiftTypes.map(st => (
              <tr key={st.id} className={!st.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: st.color }}
                    />
                    <div className="font-medium text-gray-900">{st.name}</div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {(st.qualifiedRoleRequirements?.length > 0 || st.qualificationRequirements?.length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {/* Show new qualified role requirements if available */}
                      {st.qualifiedRoleRequirements?.map(qr => (
                        <span
                          key={qr.id}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {qr.minRequired}{qr.maxAllowed ? `-${qr.maxAllowed}` : '+'} {qr.qualifiedRole?.name || getQualifiedRoleName(qr.qualifiedRoleId || '')}
                        </span>
                      ))}
                      {/* Fall back to old format if no new requirements */}
                      {!st.qualifiedRoleRequirements?.length && st.qualificationRequirements?.map(qr => {
                        const role = qualifiedRoles.find(r => r.slug === qr.qualification);
                        return (
                          <span
                            key={qr.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {qr.minRequired}{qr.maxAllowed ? `-${qr.maxAllowed}` : '+'} {role?.name || qr.qualification}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {st.defaultMinVolunteers}-{st.defaultMaxVolunteers}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {st._count.shifts}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(st)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      st.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {st.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(st)}
                      className="text-sm text-teal-600 hover:text-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(st.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

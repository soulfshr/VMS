'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeatures } from '@/hooks/useFeatures';

interface QualifiedRole {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TrainingType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  defaultDuration: number;
  defaultCapacity: number;
  expiresAfterDays: number | null;
  grantsQualifiedRoleId: string | null;
  grantsQualifiedRole: QualifiedRole | null;
  sortOrder: number;
  isActive: boolean;
  _count: {
    sessions: number;
  };
}

export default function TrainingTypesPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/admin');
    }
  }, [router, features.isLoading, features.trainings]);

  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
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
    color: '#8b5cf6',
    defaultDuration: 120,
    defaultCapacity: 20,
    expiresAfterDays: null as number | null,
    grantsQualifiedRoleId: '',
  });

  useEffect(() => {
    Promise.all([loadTrainingTypes(), loadQualifiedRoles()]);
  }, []);

  const loadQualifiedRoles = async () => {
    try {
      const res = await fetch('/api/admin/qualified-roles');
      const data = await res.json();
      if (Array.isArray(data)) {
        setQualifiedRoles(data.filter((qr: QualifiedRole & { isActive?: boolean }) => qr.isActive !== false));
      }
    } catch (err) {
      console.error('Error loading qualified roles:', err);
    }
  };

  const loadTrainingTypes = async () => {
    try {
      const res = await fetch('/api/admin/training-types');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrainingTypes(data);
      }
    } catch (err) {
      console.error('Error loading training types:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      color: '#8b5cf6',
      defaultDuration: 120,
      defaultCapacity: 20,
      expiresAfterDays: null,
      grantsQualifiedRoleId: '',
    });
  };

  const startEdit = (tt: TrainingType) => {
    setEditingId(tt.id);
    setIsCreating(false);
    setFormData({
      name: tt.name,
      slug: tt.slug,
      description: tt.description || '',
      color: tt.color,
      defaultDuration: tt.defaultDuration,
      defaultCapacity: tt.defaultCapacity,
      expiresAfterDays: tt.expiresAfterDays,
      grantsQualifiedRoleId: tt.grantsQualifiedRoleId || '',
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
        ? '/api/admin/training-types'
        : `/api/admin/training-types/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          grantsQualifiedRoleId: formData.grantsQualifiedRoleId || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: isCreating ? 'Training type created' : 'Training type updated' });
      cancelEdit();
      loadTrainingTypes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this training type?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/training-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadTrainingTypes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (tt: TrainingType) => {
    try {
      const res = await fetch(`/api/admin/training-types/${tt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tt.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadTrainingTypes();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
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
          <h1 className="text-2xl font-bold text-gray-900">Training Types</h1>
          <p className="text-gray-600 mt-1">Manage training types for schedulable training sessions</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Training Type
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
            {isCreating ? 'Create New Training Type' : 'Edit Training Type'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Dispatcher"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toUpperCase() }))}
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="e.g., DISPATCHER"
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
              placeholder="Brief description of this training type..."
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input
                type="number"
                min="15"
                step="15"
                value={formData.defaultDuration}
                onChange={e => setFormData(prev => ({ ...prev, defaultDuration: parseInt(e.target.value) || 60 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Capacity</label>
              <input
                type="number"
                min="1"
                value={formData.defaultCapacity}
                onChange={e => setFormData(prev => ({ ...prev, defaultCapacity: parseInt(e.target.value) || 10 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires After (days)</label>
              <input
                type="number"
                min="0"
                value={formData.expiresAfterDays ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, expiresAfterDays: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="Never"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Grants Qualified Role</label>
            <select
              value={formData.grantsQualifiedRoleId}
              onChange={e => setFormData(prev => ({ ...prev, grantsQualifiedRoleId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">None (no qualified role granted)</option>
              {qualifiedRoles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              If set, completing this training will grant this qualified role to the volunteer
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Training Type' : 'Save Changes'}
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

      {/* Training Types List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Training Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Capacity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grants Qualified Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sessions
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
            {trainingTypes.map(tt => (
              <tr key={tt.id} className={!tt.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: tt.color }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{tt.name}</div>
                      <div className="text-xs text-gray-500">{tt.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {formatDuration(tt.defaultDuration)}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {tt.defaultCapacity}
                </td>
                <td className="px-4 py-4">
                  {tt.grantsQualifiedRole ? (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${tt.grantsQualifiedRole.color}20`,
                        color: tt.grantsQualifiedRole.color,
                      }}
                    >
                      {tt.grantsQualifiedRole.name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">None</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {tt._count.sessions}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(tt)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tt.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tt.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(tt)}
                      className="text-sm text-cyan-600 hover:text-cyan-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tt.id)}
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

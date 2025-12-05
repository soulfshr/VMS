'use client';

import { useEffect, useState } from 'react';

interface POICategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: {
    pois: number;
  };
}

const ICON_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'shield', label: 'Shield (Enforcement)' },
  { value: 'school', label: 'School' },
  { value: 'heart', label: 'Heart (Safe Space)' },
  { value: 'building', label: 'Building' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'church', label: 'Church' },
  { value: 'library', label: 'Library' },
  { value: 'marker', label: 'Marker' },
];

export default function POICategoriesPage() {
  const [categories, setCategories] = useState<POICategory[]>([]);
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
    icon: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/poi-categories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Error loading POI categories:', err);
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
      icon: '',
    });
  };

  const startEdit = (cat: POICategory) => {
    setEditingId(cat.id);
    setIsCreating(false);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      color: cat.color,
      icon: cat.icon || '',
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
        ? '/api/admin/poi-categories'
        : `/api/admin/poi-categories/${editingId}`;
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

      setMessage({ type: 'success', text: isCreating ? 'POI category created' : 'POI category updated' });
      cancelEdit();
      loadCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this POI category?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/poi-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (cat: POICategory) => {
    try {
      const res = await fetch(`/api/admin/poi-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadCategories();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const getIconDisplay = (icon: string | null) => {
    if (!icon) return null;
    const option = ICON_OPTIONS.find(o => o.value === icon);
    return option?.label || icon;
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
          <h1 className="text-2xl font-bold text-gray-900">POI Categories</h1>
          <p className="text-gray-600 mt-1">
            Manage categories for Points of Interest displayed on the map
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            + Add Category
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
            {isCreating ? 'Create New POI Category' : 'Edit POI Category'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., ICE/Enforcement"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                disabled={!!editingId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="e.g., ICE_ENFORCEMENT"
              />
              {editingId && <p className="text-xs text-gray-500 mt-1">Slug cannot be changed after creation.</p>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="Brief description of this category..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <select
                value={formData.icon}
                onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {ICON_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Category' : 'Save Changes'}
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

      {/* Categories List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                POIs
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
            {categories.map(cat => (
              <tr key={cat.id} className={!cat.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-500">
                        {cat.slug}
                        {cat.icon && <span className="ml-2">({getIconDisplay(cat.icon)})</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                  {cat.description || <span className="text-gray-400">No description</span>}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {cat._count.pois} POIs
                  </span>
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(cat)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      cat.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cat.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-sm text-teal-600 hover:text-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No POI categories found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About POI Categories</h3>
        <p className="text-sm text-blue-700">
          POI categories help organize Points of Interest on the map. Each category has a color for map markers
          and can be toggled on/off by volunteers when viewing the map. Common categories include enforcement
          locations, schools, and safe spaces.
        </p>
      </div>
    </div>
  );
}

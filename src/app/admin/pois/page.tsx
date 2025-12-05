'use client';

import { useEffect, useState } from 'react';
import LocationPicker from '@/components/maps/LocationPicker';

interface POICategory {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
}

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface POI {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  category: POICategory;
  zone: Zone | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  createdAt: string;
}

interface FormData {
  name: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  website: string;
  notes: string;
  categoryId: string;
  zoneId: string;
}

export default function POIsPage() {
  const [pois, setPois] = useState<POI[]>([]);
  const [categories, setCategories] = useState<POICategory[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    address: '',
    latitude: null,
    longitude: null,
    phone: '',
    website: '',
    notes: '',
    categoryId: '',
    zoneId: '',
  });

  useEffect(() => {
    loadPOIs();
  }, [filterCategory, filterZone, filterStatus, searchQuery]);

  const loadPOIs = async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterZone !== 'all') params.set('zone', filterZone);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/pois?${params.toString()}`);
      const data = await res.json();
      setPois(data.pois || []);
      setCategories(data.categories || []);
      setZones(data.zones || []);
    } catch (err) {
      console.error('Error loading POIs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      address: '',
      latitude: null,
      longitude: null,
      phone: '',
      website: '',
      notes: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      zoneId: '',
    });
  };

  const startEdit = (poi: POI) => {
    setEditingId(poi.id);
    setIsCreating(false);
    setFormData({
      name: poi.name,
      description: poi.description || '',
      address: poi.address || '',
      latitude: poi.latitude,
      longitude: poi.longitude,
      phone: poi.phone || '',
      website: poi.website || '',
      notes: poi.notes || '',
      categoryId: poi.category.id,
      zoneId: poi.zone?.id || '',
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

    // Validate required fields
    if (!formData.name) {
      setMessage({ type: 'error', text: 'Name is required' });
      return;
    }
    if (!formData.categoryId) {
      setMessage({ type: 'error', text: 'Category is required' });
      return;
    }
    if (formData.latitude === null || formData.longitude === null) {
      setMessage({ type: 'error', text: 'Location is required. Please search for an address or click on the map.' });
      return;
    }

    try {
      const url = isCreating
        ? '/api/admin/pois'
        : `/api/admin/pois/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const payload = {
        ...formData,
        zoneId: formData.zoneId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      setMessage({ type: 'success', text: isCreating ? 'POI created' : 'POI updated' });
      cancelEdit();
      loadPOIs();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this POI?')) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/pois/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadPOIs();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (poi: POI) => {
    try {
      const res = await fetch(`/api/admin/pois/${poi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !poi.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadPOIs();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleLocationChange = (location: { address: string; latitude: number | null; longitude: number | null }) => {
    setFormData(prev => ({
      ...prev,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
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
          <h1 className="text-2xl font-bold text-gray-900">Points of Interest</h1>
          <p className="text-gray-600 mt-1">
            Manage locations displayed on the map for volunteers
          </p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            + Add POI
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
            {isCreating ? 'Create New POI' : 'Edit POI'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Stewart Detention Center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                value={formData.categoryId}
                onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="Brief description of this location..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <LocationPicker
              value={{
                address: formData.address,
                latitude: formData.latitude,
                longitude: formData.longitude,
              }}
              onChange={handleLocationChange}
              placeholder="Search for an address..."
            />
            {formData.latitude && formData.longitude && (
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone (optional)</label>
              <select
                value={formData.zoneId}
                onChange={e => setFormData(prev => ({ ...prev, zoneId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">No zone assigned</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} {zone.county && `(${zone.county})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., (555) 123-4567"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., https://example.com"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={2}
              placeholder="Notes for coordinators (not shown to volunteers)..."
            />
            <p className="text-xs text-gray-500 mt-1">These notes are only visible to admins.</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              {isCreating ? 'Create POI' : 'Save Changes'}
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

      {/* Filters */}
      {!isCreating && !editingId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Search POIs..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select
                value={filterZone}
                onChange={e => setFilterZone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Zones</option>
                <option value="none">No Zone</option>
                {zones.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* POIs List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                POI
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zone
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
            {pois.map(poi => (
              <tr key={poi.id} className={!poi.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{poi.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">
                      {poi.address || `${poi.latitude.toFixed(4)}, ${poi.longitude.toFixed(4)}`}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: poi.category.color }}
                    />
                    <span className="text-sm text-gray-700">{poi.category.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">
                  {poi.zone?.name || <span className="text-gray-400">None</span>}
                </td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggleActive(poi)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      poi.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {poi.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(poi)}
                      className="text-sm text-teal-600 hover:text-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(poi.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pois.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No POIs found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About Points of Interest</h3>
        <p className="text-sm text-blue-700">
          Points of Interest (POIs) are locations displayed on the map for logged-in volunteers.
          They help volunteers quickly identify important locations such as ICE offices, schools,
          and safe spaces. POIs are only visible to authenticated users for privacy.
        </p>
      </div>
    </div>
  );
}

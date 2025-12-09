'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LocationPicker from '@/components/maps/LocationPicker';

// ============ Types ============
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

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface ZoneWithCounts {
  id: string;
  name: string;
  county: string | null;
  description: string | null;
  signalGroup: string | null;
  isActive: boolean;
  color: string;
  fillOpacity: number;
  strokeWeight: number;
  boundaries: { lat: number; lng: number }[] | null;
  _count: {
    users: number;
    shifts: number;
  };
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

// ============ Constants ============
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

const COUNTIES = ['Durham', 'Orange', 'Wake'];

const DEFAULT_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

// ============ Categories Tab ============
function CategoriesTab() {
  const [categories, setCategories] = useState<POICategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    setFormData({ name: '', slug: '', description: '', color: '#6366f1', icon: '' });
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
      const url = isCreating ? '/api/admin/poi-categories' : `/api/admin/poi-categories/${editingId}`;
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

      setMessage({ type: 'success', text: isCreating ? 'Category created' : 'Category updated' });
      cancelEdit();
      loadCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this category?')) return;
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
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <p className="text-gray-600">Manage categories for Points of Interest displayed on the map</p>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Category
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isCreating ? 'Create New Category' : 'Edit Category'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="e.g., ICE_ENFORCEMENT"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
                <input type="text" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-32 px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <select value={formData.icon} onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                {ICON_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium">
              {isCreating ? 'Create Category' : 'Save Changes'}
            </button>
            <button onClick={cancelEdit} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">POIs</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map(cat => (
              <tr key={cat.id} className={!cat.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                    <div>
                      <div className="font-medium text-gray-900">{cat.name}</div>
                      <div className="text-xs text-gray-500">{cat.slug}{cat.icon && <span className="ml-2">({getIconDisplay(cat.icon)})</span>}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{cat.description || <span className="text-gray-500">No description</span>}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{cat._count.pois} POIs</span></td>
                <td className="px-4 py-4">
                  <button onClick={() => handleToggleActive(cat)} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {cat.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(cat)} className="text-sm text-cyan-600 hover:text-cyan-700">Edit</button>
                    <button onClick={() => handleDelete(cat.id)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No categories found. Create one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ POIs Tab ============
function POIsTab() {
  const [pois, setPois] = useState<POI[]>([]);
  const [categories, setCategories] = useState<POICategory[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterZone, setFilterZone] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
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
      name: '', description: '', address: '', latitude: null, longitude: null,
      phone: '', website: '', notes: '', categoryId: categories.length > 0 ? categories[0].id : '', zoneId: '',
    });
  };

  const startEdit = (poi: POI) => {
    setEditingId(poi.id);
    setIsCreating(false);
    setFormData({
      name: poi.name, description: poi.description || '', address: poi.address || '',
      latitude: poi.latitude, longitude: poi.longitude, phone: poi.phone || '',
      website: poi.website || '', notes: poi.notes || '', categoryId: poi.category.id, zoneId: poi.zone?.id || '',
    });
  };

  const startCreate = () => { setEditingId(null); setIsCreating(true); resetForm(); };
  const cancelEdit = () => { setEditingId(null); setIsCreating(false); resetForm(); };

  const handleSave = async () => {
    setMessage(null);
    if (!formData.name) { setMessage({ type: 'error', text: 'Name is required' }); return; }
    if (!formData.categoryId) { setMessage({ type: 'error', text: 'Category is required' }); return; }
    if (formData.latitude === null || formData.longitude === null) {
      setMessage({ type: 'error', text: 'Location is required. Please search for an address or click on the map.' }); return;
    }

    try {
      const url = isCreating ? '/api/admin/pois' : `/api/admin/pois/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';
      const payload = { ...formData, zoneId: formData.zoneId || null };

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to save'); }

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
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !poi.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadPOIs();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleLocationChange = (location: { address: string; latitude: number | null; longitude: number | null }) => {
    setFormData(prev => ({ ...prev, address: location.address, latitude: location.latitude, longitude: location.longitude }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <p className="text-gray-600">Manage locations displayed on the map for volunteers</p>
        {!isCreating && !editingId && (
          <button onClick={startCreate} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium">+ Add POI</button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{isCreating ? 'Create New POI' : 'Edit POI'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="e.g., Stewart Detention Center" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={formData.categoryId} onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select a category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <LocationPicker value={{ address: formData.address, latitude: formData.latitude, longitude: formData.longitude }} onChange={handleLocationChange} placeholder="Search for an address..." />
            {formData.latitude && formData.longitude && <p className="text-xs text-gray-500 mt-1">Coordinates: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone (optional)</label>
              <select value={formData.zoneId} onChange={e => setFormData(prev => ({ ...prev, zoneId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">No zone assigned</option>
                {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name} {zone.county && `(${zone.county})`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="(555) 123-4567" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input type="url" value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://example.com" />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Notes for coordinators..." />
            <p className="text-xs text-gray-500 mt-1">These notes are only visible to admins.</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium">{isCreating ? 'Create POI' : 'Save Changes'}</button>
            <button onClick={cancelEdit} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
          </div>
        </div>
      )}

      {!isCreating && !editingId && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Search POIs..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select value={filterZone} onChange={e => setFilterZone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="all">All Zones</option>
                <option value="none">No Zone</option>
                {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">POI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pois.map(poi => (
              <tr key={poi.id} className={!poi.isActive ? 'bg-gray-50' : ''}>
                <td className="px-4 py-4">
                  <div className="font-medium text-gray-900">{poi.name}</div>
                  <div className="text-xs text-gray-500 truncate max-w-xs">{poi.address || `${poi.latitude.toFixed(4)}, ${poi.longitude.toFixed(4)}`}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: poi.category.color }} />
                    <span className="text-sm text-gray-700">{poi.category.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-600">{poi.zone?.name || <span className="text-gray-500">None</span>}</td>
                <td className="px-4 py-4">
                  <button onClick={() => handleToggleActive(poi)} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${poi.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {poi.isActive ? 'Active' : 'Archived'}
                  </button>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(poi)} className="text-sm text-cyan-600 hover:text-cyan-700">Edit</button>
                    <button onClick={() => handleDelete(poi.id)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {pois.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No POIs found. Create one to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Zones Tab ============
function ZonesTab() {
  const [zones, setZones] = useState<ZoneWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    county: '',
    description: '',
    signalGroup: '',
    color: '#3b82f6',
  });

  useEffect(() => { loadZones(); }, []);

  const loadZones = async () => {
    try {
      const res = await fetch('/api/admin/zones');
      const data = await res.json();
      if (Array.isArray(data)) setZones(data);
    } catch (err) {
      console.error('Error loading zones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', county: '', description: '', signalGroup: '', color: '#3b82f6' });
  };

  const startEdit = (zone: ZoneWithCounts) => {
    setEditingId(zone.id);
    setIsCreating(false);
    setFormData({
      name: zone.name,
      county: zone.county || '',
      description: zone.description || '',
      signalGroup: zone.signalGroup || '',
      color: zone.color || '#3b82f6',
    });
  };

  const startCreate = () => { setEditingId(null); setIsCreating(true); resetForm(); };
  const cancelEdit = () => { setEditingId(null); setIsCreating(false); resetForm(); };

  const handleSave = async () => {
    setMessage(null);
    if (!formData.name.trim()) { setMessage({ type: 'error', text: 'Name is required' }); return; }

    try {
      const url = isCreating ? '/api/admin/zones' : `/api/admin/zones/${editingId}`;
      const method = isCreating ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          county: formData.county || null,
          description: formData.description || null,
          signalGroup: formData.signalGroup || null,
          color: formData.color,
        }),
      });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to save'); }

      setMessage({ type: 'success', text: isCreating ? 'Zone created' : 'Zone updated' });
      cancelEdit();
      loadZones();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete/archive this zone?')) return;
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/zones/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      const result = await res.json();
      setMessage({ type: 'success', text: result.message });
      loadZones();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleToggleActive = async (zone: ZoneWithCounts) => {
    try {
      const res = await fetch(`/api/admin/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !zone.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadZones();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const zonesByCounty = zones.reduce((acc, zone) => {
    const county = zone.county || 'Unassigned';
    if (!acc[county]) acc[county] = [];
    acc[county].push(zone);
    return acc;
  }, {} as Record<string, ZoneWithCounts[]>);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <p className="text-gray-600">Manage operational zones displayed on the coverage map</p>
        {!isCreating && !editingId && (
          <button onClick={startCreate} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium">+ Add Zone</button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{isCreating ? 'Create New Zone' : 'Edit Zone'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="e.g., Durham 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <select value={formData.county} onChange={e => setFormData(prev => ({ ...prev, county: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select county...</option>
                {COUNTIES.map(county => <option key={county} value={county}>{county}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Area coverage description..." />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Signal Group Link</label>
            <input type="text" value={formData.signalGroup} onChange={e => setFormData(prev => ({ ...prev, signalGroup: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://signal.group/..." />
            <p className="text-xs text-gray-500 mt-1">Optional link to the zone&apos;s Signal group</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Map Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map(color => (
                <button key={color} type="button" onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-gray-800 ring-2 ring-gray-400 ring-offset-1' : 'border-gray-200 hover:border-gray-400'}`}
                  style={{ backgroundColor: color }} />
              ))}
              <div className="relative">
                <input type="color" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded-full cursor-pointer opacity-0 absolute inset-0" />
                <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400" title="Custom color">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button onClick={handleSave} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium">{isCreating ? 'Create Zone' : 'Save Changes'}</button>
            <button onClick={cancelEdit} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
          </div>
        </div>
      )}

      {Object.entries(zonesByCounty).map(([county, countyZones]) => (
        <div key={county} className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{county} County</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Map</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {countyZones.map(zone => (
                  <tr key={zone.id} className={!zone.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: zone.color }} />
                        <div>
                          <div className="font-medium text-gray-900">{zone.name}</div>
                          {zone.signalGroup && <a href={zone.signalGroup} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:text-cyan-700">Signal Group →</a>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{zone.description || <span className="text-gray-500">No description</span>}</td>
                    <td className="px-4 py-4">
                      {zone.boundaries && Array.isArray(zone.boundaries) && zone.boundaries.length > 2 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Drawn
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{zone._count.users}</td>
                    <td className="px-4 py-4">
                      <button onClick={() => handleToggleActive(zone)} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${zone.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {zone.isActive ? 'Active' : 'Archived'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/zones/${zone.id}/boundaries`} className="text-sm text-blue-600 hover:text-blue-700">Draw Map</Link>
                        <button onClick={() => startEdit(zone)} className="text-sm text-cyan-600 hover:text-cyan-700">Edit</button>
                        <button onClick={() => handleDelete(zone.id)} className="text-sm text-red-600 hover:text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Main Page ============
export default function MappingPage() {
  const [activeTab, setActiveTab] = useState<'zones' | 'pois' | 'categories'>('zones');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mapping</h1>
        <p className="text-gray-600 mt-1">Manage zones, points of interest, and map categories</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('zones')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'zones'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Zones
          </button>
          <button
            onClick={() => setActiveTab('pois')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pois'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Points of Interest
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'categories'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            POI Categories
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'zones' && <ZonesTab />}
      {activeTab === 'pois' && <POIsTab />}
      {activeTab === 'categories' && <CategoriesTab />}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">About Mapping</h3>
        <p className="text-sm text-blue-700">
          <strong>Zones</strong> define operational areas for volunteer coverage and shift assignments.
          <strong> Points of Interest</strong> mark important locations on the map such as ICE offices, schools, and safe spaces.
          <strong> POI Categories</strong> organize and color-code POIs for easy identification.
        </p>
      </div>
    </div>
  );
}

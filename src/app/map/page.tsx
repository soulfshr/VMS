'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CoverageMap from '@/components/maps/CoverageMap';
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

type UserRole = 'VOLUNTEER' | 'COORDINATOR' | 'DISPATCHER' | 'ADMINISTRATOR' | 'DEVELOPER';

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

const CAN_MANAGE_ROLES: UserRole[] = ['COORDINATOR', 'DISPATCHER', 'ADMINISTRATOR', 'DEVELOPER'];
const CAN_MANAGE_CATEGORIES_ROLES: UserRole[] = ['ADMINISTRATOR', 'DEVELOPER'];

// ============ Zones Tab ============
function ZonesTab({ onRefreshMap }: { onRefreshMap: () => void }) {
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
      onRefreshMap();
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
      onRefreshMap();
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
      onRefreshMap();
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">Manage operational zones</p>
        {!isCreating && !editingId && (
          <button onClick={startCreate} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium">+ Add Zone</button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">{isCreating ? 'Create Zone' : 'Edit Zone'}</h3>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Durham 1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">County</label>
                <select value={formData.county} onChange={e => setFormData(prev => ({ ...prev, county: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Select...</option>
                  {COUNTIES.map(county => <option key={county} value={county}>{county}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Signal Group Link</label>
              <input type="text" value={formData.signalGroup} onChange={e => setFormData(prev => ({ ...prev, signalGroup: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="https://signal.group/..." />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Map Color</label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={`w-6 h-6 rounded-full border-2 ${formData.color === color ? 'border-gray-800 ring-1 ring-gray-400' : 'border-gray-200'}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700">{isCreating ? 'Create' : 'Save'}</button>
              <button onClick={cancelEdit} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
        {Object.entries(zonesByCounty).map(([county, countyZones]) => (
          <div key={county}>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{county} County</h4>
            <div className="space-y-2">
              {countyZones.map(zone => (
                <div key={zone.id} className={`p-3 bg-white rounded-lg border ${!zone.isActive ? 'border-gray-200 bg-gray-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{zone.name}</div>
                        <div className="text-xs text-gray-500">
                          {zone._count.users} users
                          {zone.boundaries && zone.boundaries.length > 2 && <span className="ml-2 text-green-600">Map drawn</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleActive(zone)} className={`px-2 py-0.5 rounded text-xs ${zone.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {zone.isActive ? 'Active' : 'Archived'}
                      </button>
                      <Link href={`/admin/zones/${zone.id}/boundaries`} className="text-xs text-blue-600 hover:text-blue-700">Draw</Link>
                      <button onClick={() => startEdit(zone)} className="text-xs text-cyan-600 hover:text-cyan-700">Edit</button>
                      <button onClick={() => handleDelete(zone.id)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ POIs Tab ============
function POIsTab({ onRefreshMap }: { onRefreshMap: () => void }) {
  const [pois, setPois] = useState<POI[]>([]);
  const [categories, setCategories] = useState<POICategory[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [filterCategory, setFilterCategory] = useState('all');
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
  }, [filterCategory, searchQuery]);

  const loadPOIs = async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('status', 'active');

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
      setMessage({ type: 'error', text: 'Location is required' }); return;
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
      onRefreshMap();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this POI?')) return;
    try {
      const res = await fetch(`/api/admin/pois/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      loadPOIs();
      onRefreshMap();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete' });
    }
  };

  const handleLocationChange = (location: { address: string; latitude: number | null; longitude: number | null }) => {
    setFormData(prev => ({ ...prev, address: location.address, latitude: location.latitude, longitude: location.longitude }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">Manage map locations</p>
        {!isCreating && !editingId && (
          <button onClick={startCreate} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium">+ Add POI</button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">{isCreating ? 'Create POI' : 'Edit POI'}</h3>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                <select value={formData.categoryId} onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Select...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location *</label>
              <LocationPicker value={{ address: formData.address, latitude: formData.latitude, longitude: formData.longitude }} onChange={handleLocationChange} placeholder="Search address..." />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Zone</label>
                <select value={formData.zoneId} onChange={e => setFormData(prev => ({ ...prev, zoneId: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">None</option>
                  {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
              <input type="url" value={formData.website} onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700">{isCreating ? 'Create' : 'Save'}</button>
              <button onClick={cancelEdit} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!isCreating && !editingId && (
        <div className="flex gap-2">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Search..." />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm">
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto">
        {pois.map(poi => (
          <div key={poi.id} className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: poi.category.color }} />
                <div>
                  <div className="font-medium text-gray-900 text-sm">{poi.name}</div>
                  <div className="text-xs text-gray-500">{poi.category.name}</div>
                  {poi.address && <div className="text-xs text-gray-400 truncate max-w-[200px]">{poi.address}</div>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(poi)} className="text-xs text-cyan-600 hover:text-cyan-700">Edit</button>
                <button onClick={() => handleDelete(poi.id)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {pois.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No POIs found</p>}
      </div>
    </div>
  );
}

// ============ Categories Tab (Admin Only) ============
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

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/poi-categories');
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
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

  const startCreate = () => { setEditingId(null); setIsCreating(true); resetForm(); };
  const cancelEdit = () => { setEditingId(null); setIsCreating(false); resetForm(); };

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
    if (!confirm('Delete this category?')) return;
    try {
      const res = await fetch(`/api/admin/poi-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">Manage POI categories</p>
        {!isCreating && !editingId && (
          <button onClick={startCreate} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium">+ Add Category</button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {(isCreating || editingId) && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">{isCreating ? 'Create Category' : 'Edit Category'}</h3>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Slug *</label>
                <input type="text" value={formData.slug} onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} disabled={!!editingId} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded border cursor-pointer" />
                  <input type="text" value={formData.color} onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Icon</label>
                <select value={formData.icon} onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {ICON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700">{isCreating ? 'Create' : 'Save'}</button>
              <button onClick={cancelEdit} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
        {categories.map(cat => (
          <div key={cat.id} className={`p-3 bg-white rounded-lg border ${!cat.isActive ? 'border-gray-200 bg-gray-50' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <div>
                  <div className="font-medium text-gray-900 text-sm">{cat.name}</div>
                  <div className="text-xs text-gray-500">{cat._count.pois} POIs</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggleActive(cat)} className={`px-2 py-0.5 rounded text-xs ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {cat.isActive ? 'Active' : 'Archived'}
                </button>
                <button onClick={() => startEdit(cat)} className="text-xs text-cyan-600 hover:text-cyan-700">Edit</button>
                <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
              </div>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No categories found</p>}
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function MapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isManageMode, setIsManageMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'zones' | 'pois' | 'categories'>('zones');
  const [mapKey, setMapKey] = useState(0);

  const userRole = (session?.user as { role?: UserRole })?.role;
  const canManage = userRole && CAN_MANAGE_ROLES.includes(userRole);
  const canManageCategories = userRole && CAN_MANAGE_CATEGORIES_ROLES.includes(userRole);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const refreshMap = () => {
    setMapKey(prev => prev + 1);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coverage Map</h1>
          <p className="text-gray-600 mt-1">
            {isManageMode ? 'Manage zones and points of interest' : 'View zone boundaries and points of interest'}
          </p>
        </div>

        {/* Manage toggle - desktop only */}
        {canManage && (
          <button
            onClick={() => setIsManageMode(!isManageMode)}
            className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isManageMode
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isManageMode ? 'Exit Manage Mode' : 'Manage Map'}
          </button>
        )}
      </div>

      {/* Main content */}
      <div className={`flex gap-6 ${isManageMode ? 'lg:flex-row' : ''}`}>
        {/* Management Panel - desktop only, when in manage mode */}
        {isManageMode && (
          <div className="hidden lg:block w-[400px] flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('zones')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'zones'
                        ? 'border-cyan-500 text-cyan-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Zones
                  </button>
                  <button
                    onClick={() => setActiveTab('pois')}
                    className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'pois'
                        ? 'border-cyan-500 text-cyan-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    POIs
                  </button>
                  {canManageCategories && (
                    <button
                      onClick={() => setActiveTab('categories')}
                      className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'categories'
                          ? 'border-cyan-500 text-cyan-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Categories
                    </button>
                  )}
                </nav>
              </div>

              {/* Tab content */}
              <div className="p-4">
                {activeTab === 'zones' && <ZonesTab onRefreshMap={refreshMap} />}
                {activeTab === 'pois' && <POIsTab onRefreshMap={refreshMap} />}
                {activeTab === 'categories' && canManageCategories && <CategoriesTab />}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <CoverageMap key={mapKey} height={isManageMode ? 'calc(100vh - 200px)' : 'calc(100vh - 280px)'} isAuthenticated={true} />
          </div>

          {!isManageMode && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Map Legend</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Zone Boundaries:</strong> Colored polygons show coverage areas for each zone</p>
                <p><strong>Points of Interest:</strong> Markers show important locations (toggle categories in the map legend)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile notice for coordinators */}
      {canManage && (
        <div className="lg:hidden mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Map management is only available on desktop. Use a larger screen to add or edit zones and POIs.
          </p>
        </div>
      )}
    </div>
  );
}

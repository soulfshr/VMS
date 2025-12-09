'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Zone {
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

const COUNTIES = ['Durham', 'Orange', 'Wake'];

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
];

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    county: '',
    description: '',
    signalGroup: '',
    color: '#3b82f6',
  });

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const res = await fetch('/api/admin/zones');
      const data = await res.json();
      if (Array.isArray(data)) {
        setZones(data);
      }
    } catch (err) {
      console.error('Error loading zones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      county: '',
      description: '',
      signalGroup: '',
      color: '#3b82f6',
    });
  };

  const startEdit = (zone: Zone) => {
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

    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    try {
      const url = isCreating
        ? '/api/admin/zones'
        : `/api/admin/zones/${editingId}`;
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

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

  const handleToggleActive = async (zone: Zone) => {
    try {
      const res = await fetch(`/api/admin/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !zone.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      loadZones();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  // Group zones by county
  const zonesByCounty = zones.reduce((acc, zone) => {
    const county = zone.county || 'Unassigned';
    if (!acc[county]) acc[county] = [];
    acc[county].push(zone);
    return acc;
  }, {} as Record<string, Zone[]>);

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
          <h1 className="text-2xl font-bold text-gray-900">Zones</h1>
          <p className="text-gray-600 mt-1">Manage operational zones</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            + Add Zone
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
            {isCreating ? 'Create New Zone' : 'Edit Zone'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="e.g., Durham 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <select
                value={formData.county}
                onChange={e => setFormData(prev => ({ ...prev, county: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Select county...</option>
                {COUNTIES.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              rows={2}
              placeholder="Area coverage description..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Signal Group Link</label>
            <input
              type="text"
              value={formData.signalGroup}
              onChange={e => setFormData(prev => ({ ...prev, signalGroup: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="https://signal.group/..."
            />
            <p className="text-xs text-gray-500 mt-1">Optional link to the zone&apos;s Signal group for real-time coordination</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Map Color</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    formData.color === color
                      ? 'border-gray-800 ring-2 ring-gray-400 ring-offset-1'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <div className="relative">
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer opacity-0 absolute inset-0"
                />
                <div
                  className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400"
                  title="Custom color"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Color used to display zone on coverage map</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              {isCreating ? 'Create Zone' : 'Save Changes'}
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

      {/* Zones List by County */}
      {Object.entries(zonesByCounty).map(([county, countyZones]) => (
        <div key={county} className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{county} County</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Map
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
                {countyZones.map(zone => (
                  <tr key={zone.id} className={!zone.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200"
                          style={{ backgroundColor: zone.color }}
                          title={`Map color: ${zone.color}`}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{zone.name}</div>
                          {zone.signalGroup && (
                            <a
                              href={zone.signalGroup}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-600 hover:text-cyan-700"
                            >
                              Signal Group →
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {zone.description || <span className="text-gray-500">No description</span>}
                    </td>
                    <td className="px-4 py-4">
                      {zone.boundaries && Array.isArray(zone.boundaries) && zone.boundaries.length > 2 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Drawn
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          Not set
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {zone._count.users}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleToggleActive(zone)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          zone.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {zone.isActive ? 'Active' : 'Archived'}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/zones/${zone.id}/boundaries`}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Draw Map
                        </Link>
                        <button
                          onClick={() => startEdit(zone)}
                          className="text-sm text-cyan-600 hover:text-cyan-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(zone.id)}
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
      ))}
    </div>
  );
}

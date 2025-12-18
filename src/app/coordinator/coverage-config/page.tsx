'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SlotConfig {
  start: number;
  end: number;
  minVols: number;
  needsLead: boolean;
  needsDispatcher: boolean;
}

interface CoverageConfigData {
  id: string;
  zoneId: string;
  zoneName: string;
  county: string | null;
  dayOfWeek: number;
  dayName: string;
  slots: SlotConfig[];
  isActive: boolean;
}

interface ZoneGroup {
  zoneId: string;
  zoneName: string;
  county: string | null;
  configs: CoverageConfigData[];
}

interface OverrideData {
  id: string;
  date: string;
  zoneId: string | null;
  zoneName: string | null;
  overrideType: 'CLOSURE' | 'ADJUST_REQUIREMENTS' | 'SPECIAL_EVENT';
  reason: string | null;
  createdAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export default function CoverageConfigPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoneGroups, setZoneGroups] = useState<ZoneGroup[]>([]);
  const [editingZone, setEditingZone] = useState<ZoneGroup | null>(null);
  const [upcomingOverrides, setUpcomingOverrides] = useState<OverrideData[]>([]);
  const [saving, setSaving] = useState(false);

  // State for the edit modal
  const [editConfigs, setEditConfigs] = useState<Record<number, {
    isActive: boolean;
    startHour: number;
    endHour: number;
    minVols: number;
    needsLead: boolean;
    needsDispatcher: boolean;
  }>>({});

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await fetch('/api/coverage/config');
      if (!response.ok) {
        throw new Error('Failed to fetch configs');
      }
      const data = await response.json();

      // Group configs by zone
      const groupedByZone = new Map<string, ZoneGroup>();
      for (const config of data.configs as CoverageConfigData[]) {
        if (!groupedByZone.has(config.zoneId)) {
          groupedByZone.set(config.zoneId, {
            zoneId: config.zoneId,
            zoneName: config.zoneName,
            county: config.county,
            configs: [],
          });
        }
        groupedByZone.get(config.zoneId)!.configs.push(config);
      }

      // Sort by county then zone name
      const sorted = Array.from(groupedByZone.values()).sort((a, b) => {
        const countyCompare = (a.county || 'ZZZ').localeCompare(b.county || 'ZZZ');
        if (countyCompare !== 0) return countyCompare;
        return a.zoneName.localeCompare(b.zoneName);
      });

      setZoneGroups(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs');
    }
  }, []);

  const fetchOverrides = useCallback(async () => {
    try {
      // Get overrides for the next 30 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const response = await fetch(
        `/api/coverage/overrides?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch overrides');
      }
      const data = await response.json();
      setUpcomingOverrides(data.overrides || []);
    } catch (err) {
      console.error('Failed to fetch overrides:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfigs(), fetchOverrides()]).finally(() => setLoading(false));
  }, [fetchConfigs, fetchOverrides]);

  const openEditModal = (zone: ZoneGroup) => {
    // Build initial edit state from existing configs
    const configState: Record<number, {
      isActive: boolean;
      startHour: number;
      endHour: number;
      minVols: number;
      needsLead: boolean;
      needsDispatcher: boolean;
    }> = {};

    for (let day = 0; day < 7; day++) {
      const config = zone.configs.find(c => c.dayOfWeek === day);
      if (config && config.slots.length > 0) {
        // Get time range from slots
        const startHour = Math.min(...config.slots.map(s => s.start));
        const endHour = Math.max(...config.slots.map(s => s.end));
        const firstSlot = config.slots[0];

        configState[day] = {
          isActive: config.isActive,
          startHour,
          endHour,
          minVols: firstSlot.minVols,
          needsLead: firstSlot.needsLead,
          needsDispatcher: firstSlot.needsDispatcher,
        };
      } else {
        // Default disabled config
        configState[day] = {
          isActive: false,
          startHour: 6,
          endHour: 14,
          minVols: 2,
          needsLead: true,
          needsDispatcher: false,
        };
      }
    }

    setEditConfigs(configState);
    setEditingZone(zone);
  };

  const handleSave = async () => {
    if (!editingZone) return;

    setSaving(true);
    try {
      for (let day = 0; day < 7; day++) {
        const config = editConfigs[day];
        const existingConfig = editingZone.configs.find(c => c.dayOfWeek === day);

        // Generate 2-hour slots from the start/end range
        const slots: SlotConfig[] = [];
        if (config.isActive) {
          for (let hour = config.startHour; hour < config.endHour; hour += 2) {
            slots.push({
              start: hour,
              end: Math.min(hour + 2, config.endHour),
              minVols: config.minVols,
              needsLead: config.needsLead,
              needsDispatcher: config.needsDispatcher,
            });
          }
        }

        if (existingConfig) {
          // Update existing config
          const response = await fetch('/api/coverage/config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: existingConfig.id,
              slots,
              isActive: config.isActive,
            }),
          });
          if (!response.ok) {
            throw new Error(`Failed to update ${DAY_NAMES[day]} config`);
          }
        } else if (config.isActive && slots.length > 0) {
          // Create new config
          const response = await fetch('/api/coverage/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              zoneId: editingZone.zoneId,
              dayOfWeek: day,
              slots,
              isActive: true,
            }),
          });
          if (!response.ok) {
            throw new Error(`Failed to create ${DAY_NAMES[day]} config`);
          }
        }
      }

      // Refresh data
      await fetchConfigs();
      setEditingZone(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configs');
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async (id: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return;

    try {
      const response = await fetch(`/api/coverage/overrides/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete override');
      }
      await fetchOverrides();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete override');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading coverage configurations...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/coordinator" className="text-gray-500 hover:text-gray-700">
              Coordinator Console
            </Link>
            <span className="text-gray-400">/</span>
            <h1 className="text-2xl font-bold text-gray-900">Coverage Configuration</h1>
          </div>
          <p className="text-gray-600 mt-1">
            Configure coverage requirements for each zone by day of week
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-500">
            &times;
          </button>
        </div>
      )}

      {/* Zone Configs Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Zone Configurations</h2>
          <p className="text-sm text-gray-500 mt-1">
            Click a zone to edit its coverage schedule
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Zone</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">County</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Active Days</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Time Range</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Min Vols</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {zoneGroups.map(zone => {
                const activeConfigs = zone.configs.filter(c => c.isActive);
                const activeDays = activeConfigs.map(c => c.dayName.substring(0, 3)).join(', ');

                // Get time range from active configs
                let timeRange = '-';
                let minVols = '-';
                if (activeConfigs.length > 0) {
                  const allSlots = activeConfigs.flatMap(c => c.slots);
                  if (allSlots.length > 0) {
                    const minStart = Math.min(...allSlots.map(s => s.start));
                    const maxEnd = Math.max(...allSlots.map(s => s.end));
                    timeRange = `${formatHour(minStart)} - ${formatHour(maxEnd)}`;
                    minVols = allSlots[0].minVols.toString();
                  }
                }

                return (
                  <tr key={zone.zoneId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{zone.zoneName}</td>
                    <td className="px-4 py-4 text-gray-600">{zone.county || '-'}</td>
                    <td className="px-4 py-4 text-gray-600">{activeDays || 'None'}</td>
                    <td className="px-4 py-4 text-gray-600">{timeRange}</td>
                    <td className="px-4 py-4 text-gray-600">{minVols}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(zone)}
                        className="text-cyan-600 hover:text-cyan-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Overrides Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Upcoming Date Overrides</h2>
          <p className="text-sm text-gray-500 mt-1">
            Date-specific exceptions (next 30 days). Use the coverage grid to add new overrides.
          </p>
        </div>

        {upcomingOverrides.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No upcoming overrides scheduled
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Zone</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Reason</th>
                  <th className="text-right px-6 py-3 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {upcomingOverrides.map(override => (
                  <tr key={override.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {new Date(override.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {override.zoneName || 'All Zones'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        override.overrideType === 'CLOSURE'
                          ? 'bg-red-100 text-red-700'
                          : override.overrideType === 'ADJUST_REQUIREMENTS'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {override.overrideType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{override.reason || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteOverride(override.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Configure: {editingZone.zoneName}
              </h2>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-700">Day</th>
                      <th className="text-center py-2 font-medium text-gray-700">Active</th>
                      <th className="text-center py-2 font-medium text-gray-700">Start</th>
                      <th className="text-center py-2 font-medium text-gray-700">End</th>
                      <th className="text-center py-2 font-medium text-gray-700">Min Vols</th>
                      <th className="text-center py-2 font-medium text-gray-700">Lead</th>
                      <th className="text-center py-2 font-medium text-gray-700">Disp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[1, 2, 3, 4, 5, 6, 0].map(day => (
                      <tr key={day} className={editConfigs[day]?.isActive ? '' : 'bg-gray-50'}>
                        <td className="py-3 font-medium text-gray-900">{DAY_NAMES[day]}</td>
                        <td className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={editConfigs[day]?.isActive || false}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], isActive: e.target.checked }
                            }))}
                            className="h-4 w-4 text-cyan-600 border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-3 text-center">
                          <select
                            value={editConfigs[day]?.startHour || 6}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], startHour: parseInt(e.target.value) }
                            }))}
                            disabled={!editConfigs[day]?.isActive}
                            className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                          >
                            {Array.from({ length: 18 }, (_, i) => i + 5).map(h => (
                              <option key={h} value={h}>{formatHour(h)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-center">
                          <select
                            value={editConfigs[day]?.endHour || 14}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], endHour: parseInt(e.target.value) }
                            }))}
                            disabled={!editConfigs[day]?.isActive}
                            className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                          >
                            {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
                              <option key={h} value={h}>{formatHour(h)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={editConfigs[day]?.minVols || 2}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], minVols: parseInt(e.target.value) || 0 }
                            }))}
                            disabled={!editConfigs[day]?.isActive}
                            className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center disabled:bg-gray-100"
                          />
                        </td>
                        <td className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={editConfigs[day]?.needsLead || false}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], needsLead: e.target.checked }
                            }))}
                            disabled={!editConfigs[day]?.isActive}
                            className="h-4 w-4 text-cyan-600 border-gray-300 rounded"
                          />
                        </td>
                        <td className="py-3 text-center">
                          <input
                            type="checkbox"
                            checked={editConfigs[day]?.needsDispatcher || false}
                            onChange={(e) => setEditConfigs(prev => ({
                              ...prev,
                              [day]: { ...prev[day], needsDispatcher: e.target.checked }
                            }))}
                            disabled={!editConfigs[day]?.isActive}
                            className="h-4 w-4 text-cyan-600 border-gray-300 rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                Time slots are 2-hour blocks within the configured range.
                Lead = Zone Lead required. Disp = Dispatcher required per slot.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingZone(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ZoneBoundaryEditor = dynamic(
  () => import('@/components/maps/ZoneBoundaryEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    ),
  }
);

interface Zone {
  id: string;
  name: string;
  county: string | null;
  color: string;
  boundaries: { lat: number; lng: number }[] | null;
}

export default function ZoneBoundariesPage() {
  const params = useParams();
  const router = useRouter();
  const [zone, setZone] = useState<Zone | null>(null);
  const [otherZones, setOtherZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [boundaries, setBoundaries] = useState<{ lat: number; lng: number }[] | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch current zone and all zones in parallel
        const [zoneRes, allZonesRes] = await Promise.all([
          fetch(`/api/admin/zones/${params.id}`),
          fetch('/api/admin/zones'),
        ]);

        if (!zoneRes.ok) throw new Error('Zone not found');

        const zoneData = await zoneRes.json();
        setZone(zoneData);
        setBoundaries(zoneData.boundaries);

        // Get other zones (excluding current zone) that have boundaries
        if (allZonesRes.ok) {
          const allZonesData = await allZonesRes.json();
          const others = allZonesData
            .filter((z: Zone) => z.id !== params.id && z.boundaries && z.boundaries.length > 0);
          setOtherZones(others);
        }
      } catch (error) {
        console.error('Error loading zone:', error);
        setMessage({ type: 'error', text: 'Failed to load zone' });
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      loadData();
    }
  }, [params.id]);

  const handleBoundariesChange = useCallback((newBoundaries: { lat: number; lng: number }[] | null) => {
    setBoundaries(newBoundaries);
  }, []);

  const handleSave = async () => {
    if (!zone) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/zones/${zone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boundaries }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setMessage({ type: 'success', text: 'Boundaries saved successfully' });

      // Update zone state with new boundaries
      setZone(prev => prev ? { ...prev, boundaries } : null);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save boundaries' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the boundaries?')) {
      setBoundaries(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Zone Not Found</h1>
        <Link href="/admin/zones" className="text-teal-600 hover:underline">
          ← Back to Zones
        </Link>
      </div>
    );
  }

  const hasChanges = JSON.stringify(boundaries) !== JSON.stringify(zone.boundaries);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/zones"
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Draw Boundaries: {zone.name}
          </h1>
          <p className="text-gray-600">
            Click on the map to draw the zone boundaries
          </p>
        </div>
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

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-medium text-blue-800 mb-2">How to draw boundaries:</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Click the polygon tool in the map controls (top-right)</li>
          <li>Click points on the map to define your zone boundary</li>
          <li>Double-click or click the first point to complete the polygon</li>
          <li>Drag points to adjust the shape</li>
          <li>Click &quot;Save Boundaries&quot; when done</li>
        </ol>
      </div>

      {/* Legend for other zones */}
      {otherZones.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Other zone boundaries shown for reference:</h3>
          <div className="flex flex-wrap gap-3">
            {otherZones.map((z) => (
              <div key={z.id} className="flex items-center gap-2 text-sm text-gray-600">
                <span
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: z.color, opacity: 0.4 }}
                />
                <span>{z.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <ZoneBoundaryEditor
          boundaries={boundaries}
          color={zone.color}
          onBoundariesChange={handleBoundariesChange}
          otherZones={otherZones}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-teal-600 text-white hover:bg-teal-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Boundaries'}
          </button>

          {boundaries && boundaries.length > 0 && (
            <button
              onClick={handleClear}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-sm text-gray-500">
          {boundaries && boundaries.length > 0 ? (
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded"
                style={{ backgroundColor: zone.color, opacity: 0.5 }}
              />
              {boundaries.length} points defined
              {hasChanges && <span className="text-amber-600">(unsaved changes)</span>}
            </span>
          ) : (
            <span>No boundaries defined</span>
          )}
        </div>
      </div>
    </div>
  );
}

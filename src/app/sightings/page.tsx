'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SightingsListMap from '@/components/maps/SightingsListMap';
import { useFeatures } from '@/hooks/useFeatures';

interface SightingMedia {
  id: string;
  url: string;
  type: 'IMAGE' | 'VIDEO';
  filename: string;
}

interface Sighting {
  id: string;
  size: string;
  activity: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  uniform: string;
  observedAt: string;
  equipment: string;
  reporterName: string | null;
  reporterPhone: string | null;
  reporterEmail: string | null;
  status: 'NEW' | 'REVIEWING' | 'VERIFIED' | 'RESPONDED' | 'CLOSED';
  notes: string | null;
  media: SightingMedia[];
  createdAt: string;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  REVIEWING: 'bg-yellow-100 text-yellow-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  RESPONDED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  VERIFIED: 'Verified',
  RESPONDED: 'Responded',
  CLOSED: 'Closed',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SightingsPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.sightings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.sightings]);

  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    fetchSightings();
  }, [statusFilter]);

  const fetchSightings = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/sightings?${params}`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.status === 403) {
        setError('You do not have permission to view sightings');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch sightings');
      }

      const data = await response.json();
      setSightings(data.sightings);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sightings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <Link href="/dashboard" className="text-cyan-600 hover:underline mt-4 inline-block">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/dashboard" className="hover:text-cyan-600">Dashboard</Link>
            <span>/</span>
            <span>ICE Sightings</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ICE Sighting Reports</h1>
          <p className="text-gray-600 mt-1">Review and manage community-submitted sighting reports</p>
        </div>

        {/* Status counts */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {['NEW', 'REVIEWING', 'VERIFIED', 'RESPONDED', 'CLOSED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-4 rounded-xl border transition-all ${
                statusFilter === status
                  ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[status]}`}>
                {statusLabels[status]}
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {counts[status] || 0}
              </div>
            </button>
          ))}
        </div>

        {/* View toggle and filter */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {statusFilter !== 'all' && (
              <>
                <span className="text-sm text-gray-600">Filtering by:</span>
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[statusFilter]}`}>
                  {statusLabels[statusFilter]}
                </span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-sm text-cyan-600 hover:underline"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'map'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </button>
          </div>
        </div>

        {/* Sightings content */}
        {sightings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-lg">No sighting reports found</p>
            <p className="text-gray-500 text-sm mt-1">
              {statusFilter !== 'all' ? 'Try clearing the filter' : 'Reports will appear here when submitted'}
            </p>
          </div>
        ) : viewMode === 'map' ? (
          <SightingsListMap sightings={sightings} />
        ) : (
          <div className="space-y-4">
            {sightings.map((sighting) => (
              <Link
                key={sighting.id}
                href={`/sightings/${sighting.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${statusColors[sighting.status]}`}>
                        {statusLabels[sighting.status]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(sighting.observedAt)}
                      </span>
                      {sighting.media.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-sm text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {sighting.media.length}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1 truncate">
                      {sighting.location}
                    </h3>

                    <p className="text-sm text-gray-600 line-clamp-2">
                      <span className="font-medium">Activity:</span> {sighting.activity}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span><span className="font-medium">Size:</span> {sighting.size}</span>
                      <span><span className="font-medium">Uniform:</span> {sighting.uniform}</span>
                    </div>
                  </div>

                  {/* Thumbnail */}
                  {sighting.media.length > 0 && sighting.media[0].type === 'IMAGE' && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sighting.media[0].url}
                        alt="Sighting"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SightingMedia {
  id: string;
  url: string;
  type: 'IMAGE' | 'VIDEO';
  filename: string;
  size: number;
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
  assignedToId: string | null;
  media: SightingMedia[];
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800 border-red-200',
  REVIEWING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  VERIFIED: 'bg-blue-100 text-blue-800 border-blue-200',
  RESPONDED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels: Record<string, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  VERIFIED: 'Verified',
  RESPONDED: 'Responded',
  CLOSED: 'Closed',
};

const allStatuses = ['NEW', 'REVIEWING', 'VERIFIED', 'RESPONDED', 'CLOSED'];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SightingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchSighting();
  }, [id]);

  const fetchSighting = async () => {
    try {
      const response = await fetch(`/api/sightings/${id}`);
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.status === 403) {
        setError('You do not have permission to view this sighting');
        setLoading(false);
        return;
      }
      if (response.status === 404) {
        setError('Sighting not found');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch sighting');
      }

      const data = await response.json();
      setSighting(data);
      setNotes(data.notes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sighting');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!sighting) return;
    setUpdating(true);

    try {
      const response = await fetch(`/api/sightings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      const updated = await response.json();
      setSighting(updated);
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    if (!sighting) return;
    setUpdating(true);

    try {
      const response = await fetch(`/api/sightings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error('Failed to save notes');

      const updated = await response.json();
      setSighting(updated);
      alert('Notes saved');
    } catch (err) {
      alert('Failed to save notes');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sighting) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error || 'Sighting not found'}</p>
            <Link href="/sightings" className="text-teal-600 hover:underline mt-4 inline-block">
              Back to Sightings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="Sighting media"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-teal-600">Dashboard</Link>
          <span>/</span>
          <Link href="/sightings" className="hover:text-teal-600">Sightings</Link>
          <span>/</span>
          <span className="text-gray-700">Report Details</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium border ${statusColors[sighting.status]}`}>
                {statusLabels[sighting.status]}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Submitted {formatDate(sighting.createdAt)}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {sighting.location}
          </h1>
          <p className="text-gray-600">
            Observed: {formatDate(sighting.observedAt)}
          </p>

          {/* Status workflow */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  disabled={updating || sighting.status === status}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sighting.status === status
                      ? `${statusColors[status]} border cursor-default`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  } disabled:opacity-50`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SALUTE Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">S.A.L.U.T.E. Report</h2>

          <div className="space-y-4">
            {/* Size */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                S
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Size / Strength</div>
                <div className="text-gray-900">{sighting.size}</div>
              </div>
            </div>

            {/* Activity */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                A
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Actions / Activity</div>
                <div className="text-gray-900">{sighting.activity}</div>
              </div>
            </div>

            {/* Location */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                L
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-500">Location / Direction</div>
                <div className="text-gray-900">{sighting.location}</div>
                {sighting.latitude && sighting.longitude && (
                  <div className="mt-2">
                    <a
                      href={`https://www.google.com/maps?q=${sighting.latitude},${sighting.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-teal-600 hover:underline"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      View on Google Maps
                    </a>
                    <span className="text-xs text-gray-400 ml-2">
                      ({sighting.latitude.toFixed(6)}, {sighting.longitude.toFixed(6)})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Uniform */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                U
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Uniform / Clothes</div>
                <div className="text-gray-900">{sighting.uniform}</div>
              </div>
            </div>

            {/* Time */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                T
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Time & Date</div>
                <div className="text-gray-900">{formatDate(sighting.observedAt)}</div>
              </div>
            </div>

            {/* Equipment */}
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                E
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Equipment / Weapons</div>
                <div className="text-gray-900">{sighting.equipment}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Media */}
        {sighting.media.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Attached Media ({sighting.media.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {sighting.media.map((media) => (
                <div key={media.id} className="relative group">
                  {media.type === 'IMAGE' ? (
                    <button
                      onClick={() => setSelectedImage(media.url)}
                      className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-teal-500 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={media.url}
                        alt={media.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full aspect-square rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                    >
                      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </a>
                  )}
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    {media.filename} ({formatFileSize(media.size)})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reporter Info */}
        {(sighting.reporterName || sighting.reporterPhone || sighting.reporterEmail) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reporter Contact</h2>
            <div className="space-y-2 text-sm">
              {sighting.reporterName && (
                <div><span className="font-medium text-gray-500">Name:</span> {sighting.reporterName}</div>
              )}
              {sighting.reporterPhone && (
                <div>
                  <span className="font-medium text-gray-500">Phone:</span>{' '}
                  <a href={`tel:${sighting.reporterPhone}`} className="text-teal-600 hover:underline">
                    {sighting.reporterPhone}
                  </a>
                </div>
              )}
              {sighting.reporterEmail && (
                <div>
                  <span className="font-medium text-gray-500">Email:</span>{' '}
                  <a href={`mailto:${sighting.reporterEmail}`} className="text-teal-600 hover:underline">
                    {sighting.reporterEmail}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dispatcher Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispatcher Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this sighting..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={saveNotes}
              disabled={updating || notes === (sighting.notes || '')}
              className="px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

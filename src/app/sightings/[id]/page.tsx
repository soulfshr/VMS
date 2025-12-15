'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SightingMap from '@/components/maps/SightingMap';
import { useFeatures } from '@/hooks/useFeatures';

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
  status: 'NEW' | 'REVIEWING' | 'DISPATCHED' | 'CLOSED';
  disposition: 'CONFIRMED' | 'UNVERIFIED' | 'FALSE_ALARM' | null;
  notes: string | null;
  assignedToId: string | null;
  media: SightingMedia[];
  createdAt: string;
  updatedAt: string;
}

// Status colors and labels (workflow stages)
const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800 border-red-200',
  REVIEWING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  DISPATCHED: 'bg-blue-100 text-blue-800 border-blue-200',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusLabels: Record<string, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  DISPATCHED: 'Dispatched',
  CLOSED: 'Closed',
};

// Disposition colors and labels (outcomes)
const dispositionColors: Record<string, string> = {
  CONFIRMED: 'bg-red-100 text-red-800 border-red-200',
  UNVERIFIED: 'bg-gray-100 text-gray-600 border-gray-200',
  FALSE_ALARM: 'bg-green-100 text-green-800 border-green-200',
};

const dispositionLabels: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  UNVERIFIED: 'Unverified',
  FALSE_ALARM: 'False Alarm',
};

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
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.sightings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.sightings]);

  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // SALUTE edit mode
  const [isEditingSalute, setIsEditingSalute] = useState(false);
  const [editSize, setEditSize] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editUniform, setEditUniform] = useState('');
  const [editEquipment, setEditEquipment] = useState('');
  const [editObservedAt, setEditObservedAt] = useState('');

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

  const updateDisposition = async (disposition: string) => {
    if (!sighting) return;
    setUpdating(true);

    try {
      const response = await fetch(`/api/sightings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition }),
      });

      if (!response.ok) throw new Error('Failed to update disposition');

      const updated = await response.json();
      setSighting(updated);
    } catch (err) {
      alert('Failed to update disposition');
    } finally {
      setUpdating(false);
    }
  };

  // Signal message template helpers
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const generateDispatchMessage = () => {
    if (!sighting) return '';
    const time = formatTime(sighting.observedAt);
    const parts = [
      `ICE SIGHTING REPORT - ${time}`,
      '',
      `Location: ${sighting.location}`,
    ];
    if (sighting.size) parts.push(`Size: ${sighting.size}`);
    if (sighting.uniform) parts.push(`Uniform: ${sighting.uniform}`);
    if (sighting.equipment) parts.push(`Equipment: ${sighting.equipment}`);
    if (sighting.activity) parts.push(`Activity: ${sighting.activity}`);
    parts.push('', 'Verifiers needed! React with thumbs up if heading there. Reply with ETA.');
    return parts.join('\n');
  };

  const generateConfirmedMessage = () => {
    if (!sighting) return '';
    const time = formatTime(sighting.observedAt);
    const parts = [
      `CONFIRMED - ${time}`,
      `Location: ${sighting.location}`,
    ];
    if (sighting.size) parts.push(sighting.size);
    if (sighting.activity) parts.push(sighting.activity);
    return parts.join('\n');
  };

  const generateUnverifiedMessage = () => {
    if (!sighting) return '';
    const time = formatTime(sighting.observedAt);
    return [
      `UNVERIFIED - ${time}`,
      `Location: ${sighting.location}`,
      'Unable to confirm - no activity observed on arrival',
    ].join('\n');
  };

  const generateFalseAlarmMessage = () => {
    if (!sighting) return '';
    const time = formatTime(sighting.observedAt);
    return [
      `FALSE ALARM - ${time}`,
      `Location: ${sighting.location}`,
      'Not ICE - regular delivery/service vehicle',
    ].join('\n');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(label);
      setTimeout(() => setCopiedMessage(null), 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  };

  // SALUTE editing functions
  const startEditingSalute = () => {
    if (!sighting) return;
    setEditSize(sighting.size || '');
    setEditActivity(sighting.activity || '');
    setEditLocation(sighting.location || '');
    setEditUniform(sighting.uniform || '');
    setEditEquipment(sighting.equipment || '');
    // Format date for datetime-local input
    const date = new Date(sighting.observedAt);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    setEditObservedAt(localDate.toISOString().slice(0, 16));
    setIsEditingSalute(true);
  };

  const cancelEditingSalute = () => {
    setIsEditingSalute(false);
  };

  const saveSalute = async () => {
    if (!sighting) return;
    setUpdating(true);

    try {
      const response = await fetch(`/api/sightings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: editSize,
          activity: editActivity,
          location: editLocation,
          uniform: editUniform,
          equipment: editEquipment,
          observedAt: editObservedAt ? new Date(editObservedAt).toISOString() : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update SALUTE report');

      const updated = await response.json();
      setSighting(updated);
      setIsEditingSalute(false);
    } catch (err) {
      alert('Failed to update SALUTE report');
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
            <Link href="/sightings" className="text-cyan-600 hover:underline mt-4 inline-block">
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
          <Link href="/dashboard" className="hover:text-cyan-600">Dashboard</Link>
          <span>/</span>
          <Link href="/sightings" className="hover:text-cyan-600">Dispatch</Link>
          <span>/</span>
          <span className="text-gray-700">Report Details</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium border ${statusColors[sighting.status]}`}>
                {statusLabels[sighting.status]}
              </span>
              {sighting.status === 'CLOSED' && sighting.disposition && (
                <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium border ${dispositionColors[sighting.disposition]}`}>
                  {dispositionLabels[sighting.disposition]}
                </span>
              )}
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

          {/* Workflow Actions - only show if not closed */}
          {sighting.status !== 'CLOSED' && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="space-y-4">
                {/* Status Actions */}
                {sighting.status === 'NEW' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Review</label>
                    <button
                      onClick={() => updateStatus('REVIEWING')}
                      disabled={updating}
                      className="px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-colors disabled:opacity-50"
                    >
                      Start Reviewing
                    </button>
                  </div>
                )}

                {(sighting.status === 'REVIEWING' || sighting.status === 'DISPATCHED') && (
                  <>
                    {sighting.status === 'REVIEWING' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Field Team</label>
                        <button
                          onClick={() => updateStatus('DISPATCHED')}
                          disabled={updating}
                          className="px-4 py-2 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          Mark as Dispatched
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Set Disposition (closes sighting)</label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => updateDisposition('CONFIRMED')}
                          disabled={updating}
                          className="px-4 py-2 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          Confirmed
                        </button>
                        <button
                          onClick={() => updateDisposition('UNVERIFIED')}
                          disabled={updating}
                          className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          Unverified
                        </button>
                        <button
                          onClick={() => updateDisposition('FALSE_ALARM')}
                          disabled={updating}
                          className="px-4 py-2 bg-green-100 text-green-800 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          False Alarm
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Signal Message Templates - only show for active sightings */}
        {sighting.status !== 'CLOSED' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Signal Message Templates</h2>
            <p className="text-sm text-gray-600 mb-4">Copy these messages to paste into Signal groups</p>

            {copiedMessage && (
              <div className="mb-4 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
                Copied: {copiedMessage}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => copyToClipboard(generateDispatchMessage(), 'Dispatch Request')}
                className="w-full text-left p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-blue-800">Dispatch Request</div>
                    <div className="text-sm text-blue-600">Request field team verification</div>
                  </div>
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => copyToClipboard(generateConfirmedMessage(), 'Confirmed Result')}
                className="w-full text-left p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-red-800">Confirmed Result</div>
                    <div className="text-sm text-red-600">ICE activity verified</div>
                  </div>
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => copyToClipboard(generateUnverifiedMessage(), 'Unverified Result')}
                className="w-full text-left p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">Unverified Result</div>
                    <div className="text-sm text-gray-600">Unable to confirm</div>
                  </div>
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
              </button>

              <button
                onClick={() => copyToClipboard(generateFalseAlarmMessage(), 'False Alarm')}
                className="w-full text-left p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-800">False Alarm</div>
                    <div className="text-sm text-green-600">Not ICE activity</div>
                  </div>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* SALUTE Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">S.A.L.U.T.E. Report</h2>
            {sighting.status !== 'CLOSED' && !isEditingSalute && (
              <button
                onClick={startEditingSalute}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
          </div>

          {isEditingSalute ? (
            // Edit Mode
            <div className="space-y-4">
              {/* Size */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  S
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Size / Strength</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    placeholder="e.g., 2 vans, 4 agents"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Activity */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  A
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Actions / Activity</label>
                  <textarea
                    value={editActivity}
                    onChange={(e) => setEditActivity(e.target.value)}
                    placeholder="Describe what was observed..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  L
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Location / Direction</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Address or description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                  {sighting.latitude && sighting.longitude && (
                    <p className="text-xs text-gray-400 mt-1">
                      Coordinates: ({sighting.latitude.toFixed(6)}, {sighting.longitude.toFixed(6)})
                    </p>
                  )}
                </div>
              </div>

              {/* Uniform */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  U
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Uniform / Clothes</label>
                  <input
                    type="text"
                    value={editUniform}
                    onChange={(e) => setEditUniform(e.target.value)}
                    placeholder="e.g., Blue vests, tactical gear"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Time */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  T
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Time & Date</label>
                  <input
                    type="datetime-local"
                    value={editObservedAt}
                    onChange={(e) => setEditObservedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Equipment */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  E
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Equipment / Weapons</label>
                  <input
                    type="text"
                    value={editEquipment}
                    onChange={(e) => setEditEquipment(e.target.value)}
                    placeholder="e.g., Handcuffs, radios, firearms"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Save/Cancel buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={cancelEditingSalute}
                  disabled={updating}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSalute}
                  disabled={updating}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="space-y-4">
              {/* Size */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  S
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Size / Strength</div>
                  <div className={sighting.size ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {sighting.size || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  A
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Actions / Activity</div>
                  <div className={sighting.activity ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {sighting.activity || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  L
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-500">Location / Direction</div>
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="text-gray-900">{sighting.location}</div>
                      {sighting.latitude && sighting.longitude && (
                        <div className="mt-2">
                          <a
                            href={`https://www.google.com/maps?q=${sighting.latitude},${sighting.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:underline"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Open in Google Maps
                          </a>
                          <span className="text-xs text-gray-400 ml-2">
                            ({sighting.latitude.toFixed(6)}, {sighting.longitude.toFixed(6)})
                          </span>
                        </div>
                      )}
                    </div>
                    {sighting.latitude && sighting.longitude && (
                      <div className="lg:w-64 xl:w-80 flex-shrink-0">
                        <div className="rounded-lg overflow-hidden border border-gray-200">
                          <SightingMap
                            latitude={sighting.latitude}
                            longitude={sighting.longitude}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Uniform */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  U
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Uniform / Clothes</div>
                  <div className={sighting.uniform ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {sighting.uniform || 'Not provided'}
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  T
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Time & Date</div>
                  <div className="text-gray-900">{formatDate(sighting.observedAt)}</div>
                </div>
              </div>

              {/* Equipment */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0">
                  E
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Equipment / Weapons</div>
                  <div className={sighting.equipment ? 'text-gray-900' : 'text-gray-400 italic'}>
                    {sighting.equipment || 'Not provided'}
                  </div>
                </div>
              </div>
            </div>
          )}
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
                      className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-cyan-500 transition-all"
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
                  <a href={`tel:${sighting.reporterPhone}`} className="text-cyan-600 hover:underline">
                    {sighting.reporterPhone}
                  </a>
                </div>
              )}
              {sighting.reporterEmail && (
                <div>
                  <span className="font-medium text-gray-500">Email:</span>{' '}
                  <a href={`mailto:${sighting.reporterEmail}`} className="text-cyan-600 hover:underline">
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={saveNotes}
              disabled={updating || notes === (sighting.notes || '')}
              className="px-4 py-2 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

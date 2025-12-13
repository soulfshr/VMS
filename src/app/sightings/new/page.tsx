'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFeatures } from '@/hooks/useFeatures';
import LocationPicker from '@/components/maps/LocationPicker';

interface LocationData {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export default function NewSightingPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.sightings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.sightings]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location state with coordinates (for LocationPicker)
  const [locationData, setLocationData] = useState<LocationData>({
    address: '',
    latitude: null,
    longitude: null,
  });

  // Form state - other optional fields
  const [formData, setFormData] = useState({
    size: '',
    activity: '',
    uniform: '',
    equipment: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!locationData.address.trim()) {
      setError('Location is required');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/sightings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: locationData.address,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          size: formData.size || undefined,
          activity: formData.activity || undefined,
          uniform: formData.uniform || undefined,
          equipment: formData.equipment || undefined,
          notes: formData.notes || undefined,
          observedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create sighting');
      }

      const sighting = await response.json();
      router.push(`/sightings/${sighting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sighting');
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/dashboard" className="hover:text-cyan-600">Dashboard</Link>
          <span>/</span>
          <Link href="/sightings" className="hover:text-cyan-600">Sightings</Link>
          <span>/</span>
          <span className="text-gray-700">New Report</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">New ICE Sighting</h1>
          <p className="text-gray-600 mt-1">
            Enter sighting details from Signal. Only location is required - add as much info as available.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location - Required */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-700 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-lg">
                L
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location / Direction <span className="text-red-500">*</span>
                </label>
                <LocationPicker
                  value={locationData}
                  onChange={setLocationData}
                  placeholder="e.g., 400 E Main St, Durham"
                />
                <p className="mt-1 text-xs text-gray-500">Start typing for address suggestions</p>
              </div>
            </div>
          </div>

          {/* Optional SALUTE Fields */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Details (Optional)</h2>
            <p className="text-sm text-gray-600 mb-6">
              Add any available information from the Signal report.
            </p>

            <div className="space-y-5">
              {/* Size */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-lg">
                  S
                </div>
                <div className="flex-1">
                  <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-1">
                    Size / Strength
                  </label>
                  <input
                    type="text"
                    id="size"
                    name="size"
                    value={formData.size}
                    onChange={handleChange}
                    placeholder="e.g., 3 individuals, 2 vehicles"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Activity */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-lg">
                  A
                </div>
                <div className="flex-1">
                  <label htmlFor="activity" className="block text-sm font-medium text-gray-700 mb-1">
                    Actions / Activity
                  </label>
                  <textarea
                    id="activity"
                    name="activity"
                    value={formData.activity}
                    onChange={handleChange}
                    placeholder="e.g., Asking for documents, surveillance"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Uniform */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-lg">
                  U
                </div>
                <div className="flex-1">
                  <label htmlFor="uniform" className="block text-sm font-medium text-gray-700 mb-1">
                    Uniform / Clothes
                  </label>
                  <input
                    type="text"
                    id="uniform"
                    name="uniform"
                    value={formData.uniform}
                    onChange={handleChange}
                    placeholder="e.g., Dark tactical vests, ICE on back"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Equipment */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold flex-shrink-0 text-lg">
                  E
                </div>
                <div className="flex-1">
                  <label htmlFor="equipment" className="block text-sm font-medium text-gray-700 mb-1">
                    Equipment / Weapons
                  </label>
                  <input
                    type="text"
                    id="equipment"
                    name="equipment"
                    value={formData.equipment}
                    onChange={handleChange}
                    placeholder="e.g., White unmarked van, radios"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Dispatcher Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional context or notes..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/sightings"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Sighting'}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">Workflow Tip</h3>
          <p className="text-sm text-blue-700">
            After creating this sighting, it will be automatically assigned to you with status &quot;Reviewing&quot;.
            You can then use the Signal message templates to coordinate with field teams.
          </p>
        </div>
      </div>
    </div>
  );
}

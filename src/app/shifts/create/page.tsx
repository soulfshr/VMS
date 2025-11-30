'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

export default function CreateShiftPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    type: 'PATROL',
    title: '',
    description: '',
    date: '',
    startTime: '09:00',
    endTime: '13:00',
    zoneId: '',
    meetingLocation: '',
    minVolunteers: 2,
    idealVolunteers: 4,
    maxVolunteers: 6,
    status: 'PUBLISHED',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/zones').then(res => res.json()),
    ])
      .then(([sessionData, zonesData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        // Only coordinators and admins can create shifts
        if (!['COORDINATOR', 'ADMINISTRATOR'].includes(sessionData.user.role)) {
          router.push('/shifts');
          return;
        }
        setUser(sessionData.user);
        if (Array.isArray(zonesData)) {
          setZones(zonesData);
          if (zonesData.length > 0) {
            setFormData(prev => ({ ...prev, zoneId: zonesData[0].id }));
          }
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Combine date and time into full ISO strings
      const dateObj = new Date(formData.date);
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);

      const startTime = new Date(dateObj);
      startTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(dateObj);
      endTime.setHours(endHour, endMin, 0, 0);

      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: dateObj.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create shift');
      }

      router.push('/shifts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shift');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/shifts" className="text-teal-600 hover:text-teal-700 text-sm mb-2 inline-block">
            ← Back to Shifts
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Shift</h1>
          <p className="text-gray-600">Schedule a new volunteer shift</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Shift Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shift Type *</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="PATROL">Patrol</option>
              <option value="COLLECTION">Collection (Intel)</option>
              <option value="ON_CALL_FIELD_SUPPORT">On-Call Field Support</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Morning Patrol, Evening Collection"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Additional details about this shift..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zone *</label>
            <select
              name="zoneId"
              value={formData.zoneId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} {zone.county && `(${zone.county})`}
                </option>
              ))}
            </select>
          </div>

          {/* Meeting Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Location</label>
            <input
              type="text"
              name="meetingLocation"
              value={formData.meetingLocation}
              onChange={handleChange}
              placeholder="e.g., Corner of Main St and 1st Ave"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Volunteer Capacity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Volunteers</label>
              <input
                type="number"
                name="minVolunteers"
                value={formData.minVolunteers}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ideal Volunteers</label>
              <input
                type="number"
                name="idealVolunteers"
                value={formData.idealVolunteers}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Volunteers</label>
              <input
                type="number"
                name="maxVolunteers"
                value={formData.maxVolunteers}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="DRAFT">Draft (not visible to volunteers)</option>
              <option value="PUBLISHED">Published (open for signups)</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Shift'}
            </button>
            <Link
              href="/shifts"
              className="py-3 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

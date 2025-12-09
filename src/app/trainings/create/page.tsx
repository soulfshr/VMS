'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';
import { useFeatures } from '@/hooks/useFeatures';

interface Zone {
  id: string;
  name: string;
  county: string | null;
}

interface TrainingType {
  id: string;
  name: string;
  slug: string;
  color: string;
  defaultDuration: number;
  defaultCapacity: number;
  grantsRole: string | null;
}

export default function CreateTrainingPage() {
  const router = useRouter();
  const features = useFeatures();

  // Feature flag redirect
  useEffect(() => {
    if (!features.isLoading && !features.trainings) {
      router.replace('/shifts');
    }
  }, [router, features.isLoading, features.trainings]);

  const [user, setUser] = useState<DevUser | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    trainingTypeId: '',
    title: '',
    description: '',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
    zoneId: '',
    location: '',
    meetingLink: '',
    minAttendees: 1,
    maxAttendees: 20,
    status: 'PUBLISHED',
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/zones').then(res => res.json()),
      fetch('/api/training-types').then(res => res.json()),
    ])
      .then(([sessionData, zonesData, typesData]) => {
        if (!sessionData.user) {
          router.push('/login');
          return;
        }
        // Only coordinators and admins can create trainings
        if (!['COORDINATOR', 'ADMINISTRATOR'].includes(sessionData.user.role)) {
          router.push('/trainings');
          return;
        }
        setUser(sessionData.user);
        if (Array.isArray(zonesData)) {
          setZones(zonesData);
        }
        if (Array.isArray(typesData) && typesData.length > 0) {
          setTrainingTypes(typesData);
          // Set default values from first training type
          const firstType = typesData[0];
          const durationMins = firstType.defaultDuration;
          const [startH, startM] = formData.startTime.split(':').map(Number);
          const totalMins = startH * 60 + startM + durationMins;
          const endH = Math.floor(totalMins / 60) % 24;
          const endM = totalMins % 60;
          setFormData(prev => ({
            ...prev,
            trainingTypeId: firstType.id,
            maxAttendees: firstType.defaultCapacity,
            endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
          }));
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const handleTrainingTypeChange = (typeId: string) => {
    const selectedType = trainingTypes.find(t => t.id === typeId);
    if (selectedType) {
      const durationMins = selectedType.defaultDuration;
      const [startH, startM] = formData.startTime.split(':').map(Number);
      const totalMins = startH * 60 + startM + durationMins;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      setFormData(prev => ({
        ...prev,
        trainingTypeId: typeId,
        maxAttendees: selectedType.defaultCapacity,
        endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      }));
    }
  };

  const handleStartTimeChange = (startTime: string) => {
    const selectedType = trainingTypes.find(t => t.id === formData.trainingTypeId);
    if (selectedType) {
      const durationMins = selectedType.defaultDuration;
      const [startH, startM] = startTime.split(':').map(Number);
      const totalMins = startH * 60 + startM + durationMins;
      const endH = Math.floor(totalMins / 60) % 24;
      const endM = totalMins % 60;
      setFormData(prev => ({
        ...prev,
        startTime,
        endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      }));
    } else {
      setFormData(prev => ({ ...prev, startTime }));
    }
  };

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

      const body = {
        trainingTypeId: formData.trainingTypeId,
        title: formData.title,
        description: formData.description || undefined,
        zoneId: formData.zoneId || undefined,
        location: formData.location || undefined,
        meetingLink: formData.meetingLink || undefined,
        minAttendees: formData.minAttendees,
        maxAttendees: formData.maxAttendees,
        status: formData.status,
        date: dateObj.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      const res = await fetch('/api/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create training');
      }

      router.push('/trainings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create training');
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (name === 'trainingTypeId') {
      handleTrainingTypeChange(value);
    } else if (name === 'startTime') {
      handleStartTimeChange(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseInt(value, 10) : value,
      }));
    }
  };

  const selectedType = trainingTypes.find(t => t.id === formData.trainingTypeId);

  const roleLabels: Record<string, string> = {
    VOLUNTEER: 'Volunteer',
    COORDINATOR: 'Coordinator',
    DISPATCHER: 'Dispatcher',
    ADMINISTRATOR: 'Administrator',
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  if (trainingTypes.length === 0) {
    return (
      <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Training Types Available</h2>
            <p className="text-gray-600 mb-4">
              Before scheduling trainings, you need to create training types in the admin settings.
            </p>
            <Link
              href="/admin/training-types"
              className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
            >
              Manage Training Types
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/trainings" className="text-cyan-600 hover:text-cyan-700 text-sm mb-2 inline-block">
            ← Back to Trainings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Training</h1>
          <p className="text-gray-600">Create a new training session for volunteers</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* Training Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Training Type *</label>
            <select
              name="trainingTypeId"
              value={formData.trainingTypeId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            >
              {trainingTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </select>
            {selectedType?.grantsRole && (
              <p className="text-sm text-purple-600 mt-1">
                Completing this training grants the {roleLabels[selectedType.grantsRole]} role
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder={`e.g., ${selectedType?.name || 'Training'} Session - December`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              placeholder="Additional details about this training session..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              {selectedType && (
                <p className="text-xs text-gray-500 mt-1">
                  Default: {selectedType.defaultDuration} minutes
                </p>
              )}
            </div>
          </div>

          {/* Zone (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zone (Optional)</label>
            <select
              name="zoneId"
              value={formData.zoneId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All zones / Not zone-specific</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} {zone.county && `(${zone.county})`}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">In-Person Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Community Center, 123 Main St"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Meeting Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Virtual Meeting Link</label>
            <input
              type="url"
              name="meetingLink"
              value={formData.meetingLink}
              onChange={handleChange}
              placeholder="e.g., https://zoom.us/j/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Provide either location, meeting link, or both for hybrid trainings
            </p>
          </div>

          {/* Attendee Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Attendees</label>
              <input
                type="number"
                name="minAttendees"
                value={formData.minAttendees}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
              <input
                type="number"
                name="maxAttendees"
                value={formData.maxAttendees}
                onChange={handleChange}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              className="flex-1 py-3 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Schedule Training'}
            </button>
            <Link
              href="/trainings"
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

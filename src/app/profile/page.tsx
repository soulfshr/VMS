'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const roleColors: Record<string, string> = {
    ADMINISTRATOR: 'bg-purple-100 text-purple-700',
    COORDINATOR: 'bg-blue-100 text-blue-700',
    DISPATCHER: 'bg-orange-100 text-orange-700',
    VOLUNTEER: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-24 h-24 bg-teal-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                {user.name.charAt(0)}
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role]}`}>
                {user.role}
              </span>
              {user.zone && (
                <p className="text-gray-500 mt-2">Zone: {user.zone}</p>
              )}
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Contact Information</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    defaultValue={user.phone || '(919) 555-0000'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Language</label>
                  <select
                    defaultValue={user.primaryLanguage || 'English'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Weekly Availability</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Set your recurring availability to help coordinators schedule shifts that fit your schedule.
                </p>
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                    <div key={day}>
                      <p className="font-medium text-gray-700 mb-2">{day}</p>
                      <button
                        className={`w-full py-2 rounded transition-colors ${
                          i === 1 || i === 3 || i === 5
                            ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {i === 1 || i === 3 || i === 5 ? 'AM' : '—'}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Click to toggle availability for each day
                </p>
              </div>
            </div>

            {/* Zone Preferences */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Zone Preferences</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Select zones you are willing to volunteer in:
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Durham 1', 'Durham 2', 'Durham 3', 'Orange 1', 'Wake 1', 'Wake 2'].map((zone) => (
                    <button
                      key={zone}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        zone === user.zone
                          ? 'bg-teal-600 text-white'
                          : zone.includes('Durham')
                          ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {zone}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Development Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            <strong>Development Preview:</strong> Profile editing is not yet connected to the database. Changes will not persist.
          </p>
        </div>
      </div>
    </div>
  );
}

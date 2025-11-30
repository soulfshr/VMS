'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';

const SAMPLE_SHIFTS = [
  {
    id: '1',
    type: 'PATROL',
    title: 'Morning Patrol',
    zone: 'Durham 1',
    date: 'Dec 2, 2025',
    time: '9:00 AM - 1:00 PM',
    spotsLeft: 2,
    totalSpots: 4,
  },
  {
    id: '2',
    type: 'PATROL',
    title: 'Afternoon Patrol',
    zone: 'Durham 2',
    date: 'Dec 2, 2025',
    time: '1:00 PM - 5:00 PM',
    spotsLeft: 3,
    totalSpots: 4,
  },
  {
    id: '3',
    type: 'COLLECTION',
    title: 'Evening Intel Collection',
    zone: 'Remote',
    date: 'Dec 3, 2025',
    time: '6:00 PM - 10:00 PM',
    spotsLeft: 1,
    totalSpots: 2,
  },
  {
    id: '4',
    type: 'ON_CALL_FIELD_SUPPORT',
    title: 'Weekend On-Call',
    zone: 'Wake 3',
    date: 'Dec 4, 2025',
    time: '8:00 AM - 12:00 PM',
    spotsLeft: 4,
    totalSpots: 6,
  },
  {
    id: '5',
    type: 'PATROL',
    title: 'Morning Patrol',
    zone: 'Orange 1',
    date: 'Dec 5, 2025',
    time: '7:00 AM - 11:00 AM',
    spotsLeft: 2,
    totalSpots: 3,
  },
];

const typeColors: Record<string, { bg: string; text: string }> = {
  PATROL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  COLLECTION: { bg: 'bg-purple-100', text: 'text-purple-700' },
  ON_CALL_FIELD_SUPPORT: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const typeLabels: Record<string, string> = {
  PATROL: 'Patrol',
  COLLECTION: 'Collection',
  ON_CALL_FIELD_SUPPORT: 'On-Call',
};

export default function ShiftsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');

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
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const filteredShifts = SAMPLE_SHIFTS.filter(shift => {
    if (filterType !== 'all' && shift.type !== filterType) return false;
    if (filterZone !== 'all' && shift.zone !== filterZone) return false;
    return true;
  });

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Shifts</h1>
          <p className="text-gray-600">Find and sign up for available volunteer shifts</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Types</option>
                <option value="PATROL">Patrol</option>
                <option value="COLLECTION">Collection</option>
                <option value="ON_CALL_FIELD_SUPPORT">On-Call Support</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
              <select
                value={filterZone}
                onChange={(e) => setFilterZone(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Zones</option>
                <option value="Durham 1">Durham 1</option>
                <option value="Durham 2">Durham 2</option>
                <option value="Orange 1">Orange 1</option>
                <option value="Wake 3">Wake 3</option>
                <option value="Remote">Remote</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shifts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[shift.type].bg} ${typeColors[shift.type].text}`}>
                  {typeLabels[shift.type]}
                </span>
                <span className="text-sm text-gray-500">
                  {shift.spotsLeft}/{shift.totalSpots} spots
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">{shift.title}</h3>
              <p className="text-sm text-gray-500 mb-3">{shift.zone}</p>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{shift.date}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{shift.time}</span>
              </div>

              <button className="w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                Sign Up
              </button>
            </div>
          ))}
        </div>

        {filteredShifts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No shifts match your filters.</p>
          </div>
        )}

        {/* Development Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">
            <strong>Development Preview:</strong> This page shows sample shift data. Full shift browsing, filtering, and RSVP functionality will be implemented with database integration.
          </p>
        </div>
      </div>
    </div>
  );
}

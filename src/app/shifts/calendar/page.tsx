'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Views } from 'react-big-calendar';
import type { DevUser } from '@/types/auth';
import type { CalendarEvent } from '@/components/ShiftCalendar';

// Dynamically import ShiftCalendar to avoid SSR issues
const ShiftCalendar = dynamic(
  () => import('@/components/ShiftCalendar'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[700px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    ),
  }
);

interface Zone {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  type: 'PATROL' | 'COLLECTION' | 'ON_CALL_FIELD_SUPPORT';
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  zone: Zone;
  status: string;
  confirmedCount: number;
  maxVolunteers: number;
  spotsLeft: number;
}

// Event colors for legend
const typeColors: Record<string, { bg: string; border: string }> = {
  PATROL: { bg: '#dbeafe', border: '#3b82f6' },
  COLLECTION: { bg: '#f3e8ff', border: '#a855f7' },
  ON_CALL_FIELD_SUPPORT: { bg: '#ffedd5', border: '#f97316' },
};

const statusColors: Record<string, { bg: string; border: string }> = {
  CANCELLED: { bg: '#fee2e2', border: '#ef4444' },
  DRAFT: { bg: '#f3f4f6', border: '#9ca3af' },
};

export default function ShiftCalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<DevUser | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchShifts = useCallback(async () => {
    try {
      // Fetch all shifts including cancelled for the calendar
      const params = new URLSearchParams();
      params.set('status', 'all');
      if (filterType !== 'all') params.set('type', filterType);
      if (filterZone !== 'all') params.set('zoneId', filterZone);

      const res = await fetch(`/api/shifts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch shifts');
      const data = await res.json();
      setShifts(data);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    }
  }, [filterType, filterZone]);

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
        setUser(sessionData.user);
        if (Array.isArray(zonesData)) {
          setZones(zonesData);
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user, fetchShifts]);

  // Convert shifts to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return shifts
      .filter(shift => filterStatus === 'all' || shift.status === filterStatus)
      .map(shift => ({
        id: shift.id,
        title: `${shift.title} (${shift.zone.name})`,
        start: new Date(shift.startTime),
        end: new Date(shift.endTime),
        resource: {
          type: shift.type,
          status: shift.status,
          zone: shift.zone.name,
          spotsLeft: shift.spotsLeft,
          confirmedCount: shift.confirmedCount,
          maxVolunteers: shift.maxVolunteers,
        },
      }));
  }, [shifts, filterStatus]);

  // Handle event click
  const handleSelectEvent = (event: CalendarEvent) => {
    router.push(`/shifts/${event.id}`);
  };

  // Handle slot selection (create new shift) - only for coordinators/admins
  const canCreateShift = user && ['COORDINATOR', 'ADMINISTRATOR'].includes(user.role);

  const handleSelectSlot = ({ start }: { start: Date }) => {
    if (!canCreateShift) return;
    const dateStr = start.toISOString().split('T')[0];
    router.push(`/shifts/create?date=${dateStr}`);
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
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Shift Calendar</h1>
            <p className="text-gray-600">View and manage all shifts in calendar view</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/shifts"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Grid View
            </Link>
            {['COORDINATOR', 'ADMINISTRATOR'].includes(user.role) && (
              <Link
                href="/shifts/create"
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                + Create Shift
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shift Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Legend */}
            <div className="flex-1 flex justify-end gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: typeColors.PATROL.bg, border: `2px solid ${typeColors.PATROL.border}` }} />
                <span className="text-sm text-gray-600">Patrol</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: typeColors.COLLECTION.bg, border: `2px solid ${typeColors.COLLECTION.border}` }} />
                <span className="text-sm text-gray-600">Collection</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: typeColors.ON_CALL_FIELD_SUPPORT.bg, border: `2px solid ${typeColors.ON_CALL_FIELD_SUPPORT.border}` }} />
                <span className="text-sm text-gray-600">On-Call</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: statusColors.CANCELLED.bg, border: `2px solid ${statusColors.CANCELLED.border}` }} />
                <span className="text-sm text-gray-600">Cancelled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <ShiftCalendar
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-gray-500">
          Showing {events.length} shift{events.length !== 1 ? 's' : ''}.
          {canCreateShift && ' Click on a date to create a new shift.'}
          {' '}Click on a shift to view details.
        </div>
      </div>
    </div>
  );
}

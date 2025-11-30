'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DevUser } from '@/types/auth';

export default function DashboardPage() {
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
        <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const roleColors: Record<string, string> = {
    ADMINISTRATOR: 'bg-purple-100 text-purple-700',
    COORDINATOR: 'bg-blue-100 text-blue-700',
    DISPATCHER: 'bg-orange-100 text-orange-700',
    VOLUNTEER: 'bg-green-100 text-green-700',
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name}!
          </h1>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[user.role]}`}>
              {user.role}
            </span>
            {user.zone && (
              <span className="text-gray-500">• {user.zone}</span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Upcoming Shifts</p>
            <p className="text-3xl font-bold text-gray-900">3</p>
            <p className="text-xs text-green-600 mt-1">Next: Tomorrow 9AM</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Hours This Month</p>
            <p className="text-3xl font-bold text-gray-900">24</p>
            <p className="text-xs text-gray-500 mt-1">6 shifts completed</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Training Status</p>
            <p className="text-3xl font-bold text-green-600">100%</p>
            <p className="text-xs text-gray-500 mt-1">All required complete</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Active Alerts</p>
            <p className="text-3xl font-bold text-orange-600">1</p>
            <p className="text-xs text-orange-600 mt-1">Durham area</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* My Upcoming Shifts */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">My Upcoming Shifts</h2>
              <Link href="/shifts" className="text-sm text-green-600 hover:text-green-700">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Sample Shift 1 */}
              <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">Patrol - Durham 1</p>
                    <p className="text-sm text-gray-500">Tomorrow, Dec 1 • 9:00 AM - 1:00 PM</p>
                  </div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    PATROL
                  </span>
                </div>
              </div>

              {/* Sample Shift 2 */}
              <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">Collection - Remote</p>
                    <p className="text-sm text-gray-500">Saturday, Dec 3 • 6:00 PM - 10:00 PM</p>
                  </div>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    COLLECTION
                  </span>
                </div>
              </div>

              {/* Sample Shift 3 */}
              <div className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">On-Call Support - Wake 3</p>
                    <p className="text-sm text-gray-500">Sunday, Dec 4 • 8:00 AM - 12:00 PM</p>
                  </div>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                    ON-CALL
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/shifts"
                  className="block p-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                >
                  <span className="font-medium">Browse Available Shifts</span>
                  <p className="text-xs text-green-600 mt-0.5">12 shifts open this week</p>
                </Link>
                <Link
                  href="/profile"
                  className="block p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">Update Availability</span>
                  <p className="text-xs text-gray-500 mt-0.5">Set your schedule preferences</p>
                </Link>
                <Link
                  href="/training"
                  className="block p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium">View Training</span>
                  <p className="text-xs text-gray-500 mt-0.5">All modules completed</p>
                </Link>
              </div>
            </div>

            {/* Active Alert */}
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-orange-800">Active Alert</h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Increased activity reported in Durham area. Stay alert if in zone.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">Posted 2 hours ago</p>
                </div>
              </div>
            </div>

            {/* Zone Info */}
            {user.zone && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="font-semibold text-gray-900 mb-3">Your Zone: {user.zone}</h2>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>• 8 volunteers assigned</p>
                  <p>• 3 shifts this week</p>
                  <p>• Signal group active</p>
                </div>
                <button className="mt-4 w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                  Open Zone Signal Group
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Development Mode Notice */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600">ℹ️</span>
            <div>
              <h3 className="font-semibold text-yellow-800">Development Preview</h3>
              <p className="text-sm text-yellow-700">
                This dashboard displays sample data. Full functionality will be available once connected to the database.
                You are logged in as <strong>{user.name}</strong> ({user.role}).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

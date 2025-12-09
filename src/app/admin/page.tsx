'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GuidedTour from '@/components/onboarding/GuidedTour';

import type { DevUser } from '@/types/auth';

interface Stats {
  shiftTypes: number;
  zones: number;
  autoConfirm: boolean;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/admin/shift-types').then(res => res.json()),
      fetch('/api/admin/zones').then(res => res.json()),
      fetch('/api/admin/settings').then(res => res.json()),
    ])
      .then(([session, shiftTypes, zones, settings]) => {
        if (session.user) {
          setUser(session.user);
        }
        setStats({
          shiftTypes: Array.isArray(shiftTypes) ? shiftTypes.filter((st: { isActive: boolean }) => st.isActive).length : 0,
          zones: Array.isArray(zones) ? zones.filter((z: { isActive: boolean }) => z.isActive).length : 0,
          autoConfirm: settings?.autoConfirmRsvp ?? false,
        });
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error loading stats:', err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Guided Tour */}
      {user && (
        <GuidedTour
          pageName="admin"
          userRole={user.role}
          autoStart={true}
        />
      )}

    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage organization settings and configuration</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-tour="admin-settings">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Shift Types</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.shiftTypes ?? 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
          <Link
            href="/admin/shift-types"
            className="text-sm text-cyan-600 hover:text-cyan-700 mt-4 inline-block"
          >
            Manage shift types →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Zones</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.zones ?? 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📍</span>
            </div>
          </div>
          <Link
            href="/admin/zones"
            className="text-sm text-cyan-600 hover:text-cyan-700 mt-4 inline-block"
          >
            Manage zones →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">RSVP Mode</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {stats?.autoConfirm ? 'Auto-Confirm' : 'Manual Approval'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <span className="text-2xl">{stats?.autoConfirm ? '✅' : '⏳'}</span>
            </div>
          </div>
          <Link
            href="/admin/settings"
            className="text-sm text-cyan-600 hover:text-cyan-700 mt-4 inline-block"
          >
            Change settings →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/shift-types"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-cyan-300 hover:bg-cyan-50 transition-colors"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">➕</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Add Shift Type</p>
              <p className="text-sm text-gray-500">Create a new shift type with role requirements</p>
            </div>
          </Link>

          <Link
            href="/admin/zones"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-cyan-300 hover:bg-cyan-50 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">➕</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Add Zone</p>
              <p className="text-sm text-gray-500">Create a new operational zone</p>
            </div>
          </Link>

          <Link
            href="/admin/settings"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-cyan-300 hover:bg-cyan-50 transition-colors"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">⚙️</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">General Settings</p>
              <p className="text-sm text-gray-500">Configure RSVP behavior and other options</p>
            </div>
          </Link>

          <Link
            href="/shifts"
            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-cyan-300 hover:bg-cyan-50 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">View Shifts</p>
              <p className="text-sm text-gray-500">Go to the shift management page</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}

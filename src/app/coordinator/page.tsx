'use client';

import Link from 'next/link';
import { useFeatures } from '@/hooks/useFeatures';

export default function CoordinatorPage() {
  const features = useFeatures();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coordinator Console</h1>
        <p className="text-gray-600 mt-1">
          Tools for coordinating volunteer activities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email Blast Card */}
        <Link
          href="/coordinator/email-blast"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📧</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-700">
                Email Blast
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Send email notifications to volunteers about upcoming shifts and trainings
              </p>
            </div>
          </div>
        </Link>

        {/* Mapping Card */}
        <Link
          href="/coordinator/mapping"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">🗺️</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-700">
                Mapping
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Manage zones, points of interest, and map locations
              </p>
            </div>
          </div>
        </Link>

        {/* Schedule Settings Card */}
        <Link
          href="/coordinator/settings"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚙️</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-700">
                Schedule Settings
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure dispatcher and volunteer scheduling modes
              </p>
            </div>
          </div>
        </Link>

        {/* Coverage Config Card */}
        <Link
          href="/coordinator/coverage-config"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-cyan-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-cyan-700">
                Coverage Config
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure zone coverage requirements, time slots, and date overrides
              </p>
            </div>
          </div>
        </Link>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="space-y-3">
            <Link
              href="/shifts"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
            >
              <span>📅</span> Manage Shifts
            </Link>
            {features.trainings && (
              <Link
                href="/trainings"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
              >
                <span>🎓</span> Manage Trainings
              </Link>
            )}
            <Link
              href="/volunteers"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
            >
              <span>👥</span> View Volunteers
            </Link>
            <Link
              href="/coverage"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-700"
            >
              <span>🗓️</span> Coverage Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

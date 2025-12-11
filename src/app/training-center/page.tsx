'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalModules: number;
  publishedModules: number;
  draftModules: number;
  totalSections: number;
  totalQuizzes: number;
  totalEnrollments: number;
  completedEnrollments: number;
  averageCompletionRate: number;
}

export default function TrainingCenterDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/training-center/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Center Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage interactive training modules with videos, text, and quizzes</p>
        </div>
        <Link
          href="/training-center/modules/new"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
        >
          Create Module
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Modules</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalModules ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Published</p>
          <p className="text-2xl font-bold text-green-600">{stats?.publishedModules ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Drafts</p>
          <p className="text-2xl font-bold text-yellow-600">{stats?.draftModules ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Sections</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalSections ?? 0}</p>
        </div>
      </div>

      {/* Engagement Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Enrollments</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalEnrollments ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Users enrolled in modules</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Completions</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.completedEnrollments ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Successfully completed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Completion Rate</p>
          <p className="text-2xl font-bold text-cyan-600">{stats?.averageCompletionRate ?? 0}%</p>
          <p className="text-xs text-gray-400 mt-1">Average across all modules</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/training-center/modules"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <span className="text-2xl">📚</span>
            <div>
              <p className="font-medium text-gray-900">Manage Modules</p>
              <p className="text-sm text-gray-500">View and edit training modules</p>
            </div>
          </Link>
          <Link
            href="/training-center/modules/new"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <span className="text-2xl">➕</span>
            <div>
              <p className="font-medium text-gray-900">Create Module</p>
              <p className="text-sm text-gray-500">Build a new training module</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-gray-50 opacity-60 cursor-not-allowed">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">Analytics</p>
              <p className="text-sm text-gray-500">Coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h2 className="font-semibold text-purple-900 mb-2">Training Center Features</h2>
        <p className="text-purple-700 text-sm mb-4">
          The Training Center enables interactive learning experiences for volunteers:
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-purple-700">
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Video lessons with progress tracking
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Rich text content sections
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Interactive quizzes with scoring
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Automatic qualification grants
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Per-section completion tracking
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">✓</span> Required vs optional modules
          </li>
        </ul>
      </div>
    </div>
  );
}

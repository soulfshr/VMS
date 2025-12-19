'use client';

import { useEffect, useState, useCallback } from 'react';

interface Activity {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  description: string;
  entityType: string;
  entityId: string | null;
  action: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const entityIcons: Record<string, string> = {
  User: '👤',
  Shift: '📅',
  ShiftVolunteer: '✋',
  Zone: '📍',
  CoverageSignup: '📋',
  TrainingModule: '📚',
  TrainingEnrollment: '🎓',
  IceSighting: '🚨',
  POI: '📌',
  EmailBlast: '📧',
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');

      const res = await fetch(`/api/coordinator/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch activities');

      const data = await res.json();
      setActivities(data.activities);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-600 mt-1">
          Recent changes and actions across the system
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-cyan-600 text-xl">ℹ️</span>
          <div className="text-sm text-cyan-800">
            <p className="font-medium">Transparency &amp; Accountability</p>
            <p className="mt-1 text-cyan-700">
              This log shows all significant actions taken in the system. Every change to shifts,
              volunteer profiles, zones, and other data is recorded with the who, what, and when.
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No activity recorded yet</p>
          <p className="text-sm mt-1">Actions will appear here once changes are made</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          {pagination && (
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} activities
              </span>
            </div>
          )}

          {/* Activity list */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Entity icon */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg shrink-0">
                    {entityIcons[activity.entityType] || '📋'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.actor}</span>
                      <span className="text-gray-600"> {activity.description}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${actionColors[activity.action] || 'bg-gray-100 text-gray-700'}`}>
                        {activity.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

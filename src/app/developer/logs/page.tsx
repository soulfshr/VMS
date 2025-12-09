'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface SystemLog {
  id: string;
  severity: string;
  category: string;
  message: string;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  endpoint: string | null;
  ipAddress: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const severityOptions = ['', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const categoryOptions = ['', 'AUTH', 'EMAIL', 'RSVP', 'SIGHTING', 'ADMIN', 'SYSTEM', 'RATE_LIMIT', 'API'];

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  ERROR: 'bg-orange-100 text-orange-800 border-orange-200',
  WARN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  INFO: 'bg-blue-100 text-blue-800 border-blue-200',
  DEBUG: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function LogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [severity, setSeverity] = useState(searchParams.get('severity') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Expanded log details
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '50');
      if (severity) params.set('severity', severity);
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`/api/developer/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');

      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, severity, category, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', page.toString());

    const newUrl = params.toString() ? `/developer/logs?${params}` : '/developer/logs';
    router.replace(newUrl, { scroll: false });
  }, [severity, category, search, page, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setSeverity('');
    setCategory('');
    setSearch('');
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
        <p className="text-gray-600 mt-1">View and search system event logs</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in messages..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {severityOptions.map((s) => (
                <option key={s} value={s}>{s || 'All Severities'}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c || 'All Categories'}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No logs found matching your criteria
        </div>
      ) : (
        <>
          {/* Stats bar */}
          {pagination && (
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
              </span>
            </div>
          )}

          {/* Log list */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <span className={`px-2 py-0.5 text-xs rounded font-medium border ${severityColors[log.severity] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                    {log.severity}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                    {log.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{log.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                      {log.endpoint && ` • ${log.endpoint}`}
                      {log.durationMs && ` • ${log.durationMs}ms`}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded details */}
                {expandedLog === log.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Log ID:</span>
                        <span className="ml-2 font-mono text-gray-700">{log.id}</span>
                      </div>
                      {log.userId && (
                        <div>
                          <span className="text-gray-500">User ID:</span>
                          <span className="ml-2 font-mono text-gray-700">{log.userId}</span>
                        </div>
                      )}
                      {log.endpoint && (
                        <div>
                          <span className="text-gray-500">Endpoint:</span>
                          <span className="ml-2 font-mono text-gray-700">{log.endpoint}</span>
                        </div>
                      )}
                      {log.ipAddress && (
                        <div>
                          <span className="text-gray-500">IP Address:</span>
                          <span className="ml-2 font-mono text-gray-700">{log.ipAddress}</span>
                        </div>
                      )}
                      {log.durationMs !== null && (
                        <div>
                          <span className="text-gray-500">Duration:</span>
                          <span className="ml-2 font-mono text-gray-700">{log.durationMs}ms</span>
                        </div>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-3">
                        <span className="text-sm text-gray-500">Metadata:</span>
                        <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
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

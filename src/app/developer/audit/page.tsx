'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Filters {
  entityTypes: string[];
  actions: string[];
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
  LOGIN: 'bg-purple-100 text-purple-800 border-purple-200',
  LOGOUT: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<Filters>({ entityTypes: [], actions: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [entityType, setEntityType] = useState(searchParams.get('entityType') || '');
  const [action, setAction] = useState(searchParams.get('action') || '');
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
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      if (search) params.set('search', search);

      const res = await fetch(`/api/developer/audit?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');

      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
      setFilters(data.filters);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, entityType, action, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', page.toString());

    const newUrl = params.toString() ? `/developer/audit?${params}` : '/developer/audit';
    router.replace(newUrl, { scroll: false });
  }, [entityType, action, search, page, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setEntityType('');
    setAction('');
    setSearch('');
    setPage(1);
  };

  // Format date/time nicely
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Render a diff view for before/after
  const renderDiff = (previous: Record<string, unknown> | null, current: Record<string, unknown> | null) => {
    if (!previous && !current) return null;

    const allKeys = new Set([
      ...(previous ? Object.keys(previous) : []),
      ...(current ? Object.keys(current) : []),
    ]);

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Previous Value */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            Previous
          </div>
          {previous ? (
            <pre className="p-3 bg-red-50 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto border border-red-100">
              {JSON.stringify(previous, null, 2)}
            </pre>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-400 italic">
              (no previous value)
            </div>
          )}
        </div>

        {/* New Value */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            New
          </div>
          {current ? (
            <pre className="p-3 bg-green-50 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto border border-green-100">
              {JSON.stringify(current, null, 2)}
            </pre>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-400 italic">
              (deleted)
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-gray-600 mt-1">Track all data changes in the system</p>
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
              placeholder="Search by email or entity ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {filters.entityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Actions</option>
              {filters.actions.map((a) => (
                <option key={a} value={a}>{a}</option>
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
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No audit logs found</p>
          <p className="text-sm mt-1">Changes will appear here once they are made</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          {pagination && (
            <div className="flex justify-between items-center mb-4 text-sm text-gray-600">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
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
                  <span className={`px-2 py-0.5 text-xs rounded font-medium border ${actionColors[log.action] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                    {log.action}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                    {log.entityType}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{log.userName || log.userEmail}</span>
                      <span className="text-gray-500">
                        {' '}{log.action.toLowerCase()}d{' '}
                        {log.entityType}
                        {log.entityId && (
                          <span className="font-mono text-xs ml-1">({log.entityId.slice(0, 8)}...)</span>
                        )}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(log.createdAt)}
                      <span className="mx-1">•</span>
                      {log.userEmail}
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
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {/* Entity Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">User ID:</span>
                        <span className="ml-2 font-mono text-xs text-gray-700">{log.userId}</span>
                      </div>
                      {log.entityId && (
                        <div>
                          <span className="text-gray-500">Entity ID:</span>
                          <span className="ml-2 font-mono text-xs text-gray-700">{log.entityId}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Timestamp:</span>
                        <span className="ml-2 text-gray-700">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Diff View */}
                    {(log.previousValue || log.newValue) && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Changes</h4>
                        {renderDiff(log.previousValue, log.newValue)}
                      </div>
                    )}

                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Metadata</h4>
                        <pre className="p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto">
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

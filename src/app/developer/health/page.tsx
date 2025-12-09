'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface HealthData {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceHealth[];
  timestamp: string;
}

interface HealthHistory {
  service: string;
  status: string;
  responseMs: number;
  error: string | null;
  checkedAt: string;
}

const statusColors = {
  healthy: 'bg-green-100 text-green-800 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  down: 'bg-red-100 text-red-800 border-red-200',
};

const statusIcons = {
  healthy: '✓',
  degraded: '⚠',
  down: '✕',
};

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [history, setHistory] = useState<HealthHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await fetch('/api/developer/health');
      if (!res.ok) throw new Error('Failed to fetch health');
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching health:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/developer/health/history');
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchHistory();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchHealth();
      fetchHistory();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchHealth, fetchHistory]);

  const handleManualRefresh = () => {
    fetchHealth(true);
    fetchHistory();
  };

  const getUptimePercentage = (serviceName: string) => {
    const serviceHistory = history.filter(h => h.service === serviceName);
    if (serviceHistory.length === 0) return null;
    const healthyCount = serviceHistory.filter(h => h.status === 'healthy').length;
    return ((healthyCount / serviceHistory.length) * 100).toFixed(1);
  };

  const getAverageResponseTime = (serviceName: string) => {
    const serviceHistory = history.filter(h => h.service === serviceName);
    if (serviceHistory.length === 0) return null;
    const total = serviceHistory.reduce((sum, h) => sum + h.responseMs, 0);
    return Math.round(total / serviceHistory.length);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Status</h1>
          <p className="text-gray-600 mt-1">Monitor service health and uptime</p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshing ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      {health && (
        <div className={`rounded-xl border p-6 mb-6 ${statusColors[health.overall]}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{statusIcons[health.overall]}</span>
            <div>
              <h2 className="text-xl font-bold capitalize">
                System {health.overall === 'healthy' ? 'Operational' : health.overall === 'degraded' ? 'Degraded' : 'Down'}
              </h2>
              <p className="text-sm opacity-75">
                {health.overall === 'healthy'
                  ? 'All services are running normally'
                  : health.overall === 'degraded'
                  ? 'Some services are experiencing issues'
                  : 'Critical services are unavailable'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {health?.services.map((service) => (
          <div key={service.service} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 capitalize">{service.service}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[service.status]}`}>
                {statusIcons[service.status]} {service.status}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Response Time</span>
                <span className={`font-medium ${
                  service.responseMs < 100 ? 'text-green-600' :
                  service.responseMs < 500 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {service.responseMs}ms
                </span>
              </div>

              {getUptimePercentage(service.service) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Uptime (24h)</span>
                  <span className={`font-medium ${
                    parseFloat(getUptimePercentage(service.service)!) >= 99 ? 'text-green-600' :
                    parseFloat(getUptimePercentage(service.service)!) >= 95 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {getUptimePercentage(service.service)}%
                  </span>
                </div>
              )}

              {getAverageResponseTime(service.service) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg Response (24h)</span>
                  <span className="font-medium text-gray-700">
                    {getAverageResponseTime(service.service)}ms
                  </span>
                </div>
              )}

              {service.error && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700 font-mono">{service.error}</p>
                </div>
              )}

              {service.details && Object.keys(service.details).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Details</p>
                  <div className="space-y-1">
                    {Object.entries(service.details).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-500">{key}</span>
                        <span className="font-mono text-gray-700">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Health Check History */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Health Checks</h3>
          <p className="text-sm text-gray-500">Last 50 health check results</p>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No health check history available yet
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.slice(0, 50).map((check, index) => (
              <div key={index} className="p-4 flex items-center gap-4">
                <span className={`w-2 h-2 rounded-full ${
                  check.status === 'healthy' ? 'bg-green-500' :
                  check.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <span className="font-medium text-gray-900 capitalize w-24">{check.service}</span>
                <span className={`text-sm w-20 ${
                  check.responseMs < 100 ? 'text-green-600' :
                  check.responseMs < 500 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {check.responseMs}ms
                </span>
                <span className="text-sm text-gray-500 flex-1">
                  {new Date(check.checkedAt).toLocaleString()}
                </span>
                {check.error && (
                  <span className="text-sm text-red-600 truncate max-w-xs" title={check.error}>
                    {check.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

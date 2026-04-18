import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { ExplainButton } from '../../components/ExplainButton';
import type { DashboardData } from '../../types';

type ContractLog = {
  endpoint: string;
  issues: string[];
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
  score?: number;
};

type ContractAuditResponse = {
  total: number;
  recent: ContractLog[];
  aggregates?: {
    bySeverity: { high: number; medium: number; low: number };
    topEndpoints: Array<{
      endpoint: string;
      count: number;
      highestSeverity: 'low' | 'medium' | 'high';
      averageScore: number;
    }>;
    weightedRisk: number;
    healthScore: number;
    stability: 'stable' | 'degraded' | 'critical';
  };
};

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [audit, setAudit] = useState<ContractAuditResponse | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard')
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));

    fetch('/api/logs/contract-error')
      .then((res) => res.json())
      .then((res) => setAudit(res))
      .catch(() => {});
  }, []);

  if (error) {
    return <div className="text-red-500 p-4 bg-red-500/10 rounded-lg border border-red-500/20">Error: {error}</div>;
  }

  if (!data) {
    return <div className="text-gray-500 font-mono text-sm animate-pulse">Loading system metrics...</div>;
  }

  const healthScore = audit?.aggregates?.healthScore ?? 100;
  const stability = audit?.aggregates?.stability ?? 'stable';
  const severityCounts = audit?.aggregates?.bySeverity ?? { high: 0, medium: 0, low: 0 };
  const topEndpoints = audit?.aggregates?.topEndpoints ?? [];
  const recentLogs = audit?.recent ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200">System Overview</h2>
        <ExplainButton context="CASA System Dashboard Metrics" data={data} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60">
          <div className="text-sm text-gray-500 mb-2">Active Policies</div>
          <div className="text-3xl text-gray-100">{data.activePolicies}</div>
        </div>
        <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60">
          <div className="text-sm text-gray-500 mb-2">Decisions (24h)</div>
          <div className="text-3xl text-gray-100">{data.decisions24h}</div>
        </div>
        <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60">
          <div className="text-sm text-gray-500 mb-2">Boundary Alerts</div>
          <div className={cn('text-3xl', data.boundaryAlerts > 0 ? 'text-amber-400' : 'text-gray-100')}>
            {data.boundaryAlerts}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-[#12121a] border border-blue-500/20 col-span-1">
          <div className="text-sm text-blue-400 mb-2">System Health</div>
          <div
            className={cn(
              'text-4xl font-semibold',
              healthScore >= 85 ? 'text-emerald-400' : healthScore >= 60 ? 'text-amber-400' : 'text-red-400',
            )}
          >
            {healthScore}
          </div>
          <div className="mt-2 text-xs font-mono text-gray-400 uppercase tracking-wide">{stability}</div>
          <div className="mt-3 text-xs text-gray-500">Weighted contract risk: {audit?.aggregates?.weightedRisk ?? 0}</div>
        </div>

        <div className="p-6 rounded-xl bg-[#12121a] border border-red-500/20 col-span-2">
          <div className="text-sm text-red-400 mb-3">Severity Distribution</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="text-red-300">High</div>
              <div className="mt-2 text-2xl text-red-200">{severityCounts.high}</div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-amber-300">Medium</div>
              <div className="mt-2 text-2xl text-amber-200">{severityCounts.medium}</div>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="text-blue-300">Low</div>
              <div className="mt-2 text-2xl text-blue-200">{severityCounts.low}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-[#12121a] border border-red-500/20">
          <div className="text-sm text-red-400 mb-3">Top Failing Endpoints</div>
          {topEndpoints.length === 0 ? (
            <div className="text-gray-500 text-sm">No endpoint failures recorded</div>
          ) : (
            <ul className="space-y-3 text-sm">
              {topEndpoints.map((item) => (
                <li key={item.endpoint} className="rounded-lg border border-gray-800/60 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-gray-200">{item.endpoint}</span>
                    <span
                      className={cn(
                        'text-xs uppercase tracking-wide',
                        item.highestSeverity === 'high'
                          ? 'text-red-300'
                          : item.highestSeverity === 'medium'
                            ? 'text-amber-300'
                            : 'text-blue-300',
                      )}
                    >
                      {item.highestSeverity}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Count: {item.count} · Avg score: {item.averageScore}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 rounded-xl bg-[#12121a] border border-red-500/20">
          <div className="text-sm text-red-400 mb-3">Recent Contract Audit</div>
          {recentLogs.length === 0 ? (
            <div className="text-gray-500 text-sm">No recent contract issues</div>
          ) : (
            <ul className="space-y-2 text-xs font-mono text-red-300 max-h-[360px] overflow-auto">
              {recentLogs.map((log, i) => (
                <li key={`${log.endpoint}-${log.timestamp}-${i}`} className="rounded-lg border border-gray-800/60 p-3">
                  <div>
                    {log.timestamp} — {log.endpoint}
                  </div>
                  <div className="mt-1 text-red-200">{log.issues.join(', ')}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
                    Severity: {log.severity ?? 'unknown'}
                    {typeof log.score === 'number' ? ` · Score: ${log.score}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

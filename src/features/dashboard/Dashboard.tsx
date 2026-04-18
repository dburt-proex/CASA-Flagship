import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { ExplainButton } from '../../components/ExplainButton';
import type { DashboardData } from '../../types';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [contractLogs, setContractLogs] = useState<any[]>([]);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));

    fetch('/api/logs/contract-error')
      .then(res => res.json())
      .then(res => setContractLogs(res.recent || []))
      .catch(() => {});
  }, []);

  if (error) return <div className="text-red-500 p-4 bg-red-500/10 rounded-lg border border-red-500/20">Error: {error}</div>;
  if (!data) return <div className="text-gray-500 font-mono text-sm animate-pulse">Loading system metrics...</div>;

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
          <div className={cn("text-3xl", data.boundaryAlerts > 0 ? "text-amber-400" : "text-gray-100")}>
            {data.boundaryAlerts}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-[#12121a] border border-red-500/20">
        <div className="text-sm text-red-400 mb-3">Contract Audit (Recent Issues)</div>
        {contractLogs.length === 0 ? (
          <div className="text-gray-500 text-sm">No recent contract issues</div>
        ) : (
          <ul className="space-y-2 text-xs font-mono text-red-300">
            {contractLogs.map((log, i) => (
              <li key={i}>
                <div>{log.timestamp} — {log.endpoint}</div>
                <div className="ml-2 text-red-200">{log.issues.join(', ')}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

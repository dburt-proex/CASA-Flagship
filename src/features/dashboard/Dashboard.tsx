import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="text-red-500 p-4 bg-red-500/10 rounded-lg border border-red-500/20">Error: {error}</div>;
  if (!data) return <div className="text-gray-500 font-mono text-sm animate-pulse">Loading system metrics...</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60 shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="text-sm text-gray-500 font-medium mb-2">Active Policies</div>
        <div className="text-3xl font-semibold tracking-tight text-gray-100">{data.activePolicies}</div>
      </div>
      <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60 shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="text-sm text-gray-500 font-medium mb-2">Decisions (24h)</div>
        <div className="text-3xl font-semibold tracking-tight text-gray-100">{data.decisions24h}</div>
      </div>
      <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60 shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="text-sm text-gray-500 font-medium mb-2">Boundary Alerts</div>
        <div className={cn("text-3xl font-semibold tracking-tight", data.boundaryAlerts > 0 ? "text-amber-400" : "text-gray-100")}>
          {data.boundaryAlerts}
        </div>
      </div>
    </div>
  );
}

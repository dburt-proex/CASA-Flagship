import React, { useState } from 'react';
import { Play, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { DryRunResult } from '../../types';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export function PolicyLab() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const runDryRun = async () => {
    setIsSimulating(true);
    setError(null);
    try {
      const data = await api.post<DryRunResult>('/policy/dryrun', {
        policyId: 'POL-102',
        parameters: { threshold: 0.8 }
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const applyPolicy = async () => {
    setIsConfirmOpen(false);
    // In a real app, this would call a PUT/POST endpoint to mutate the policy
    alert("Policy POL-102 applied to production successfully. Audit log generated.");
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-200">Policy Simulation Lab</h3>
          <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-mono">
            SAFE MODE
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-xs font-mono text-gray-500 uppercase">Target Policy</label>
            <select className="w-full bg-[#1a1a24] border border-gray-700/50 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50">
              <option>POL-102: Data Egress Boundary</option>
              <option>POL-105: Rate Limit Override</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-gray-500 uppercase">Environment</label>
            <select className="w-full bg-[#1a1a24] border border-gray-700/50 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50">
              <option>Staging (Shadow Mode)</option>
              <option>Production (Dry Run)</option>
            </select>
          </div>
        </div>
        
        <button 
          onClick={runDryRun}
          disabled={isSimulating}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSimulating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Execute Simulation
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5" />
          {error}
        </div>
      )}

      {result && (
        <div className="p-6 rounded-xl bg-[#12121a] border border-gray-800/60 shadow-lg space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between border-b border-gray-800/60 pb-4">
            <h4 className="text-md font-medium text-gray-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Simulation Results
            </h4>
            <div className="text-xs font-mono text-gray-500">ID: SIM-{Math.random().toString(36).substring(7).toUpperCase()}</div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-[#0a0a0c] rounded-lg border border-gray-800/60">
              <div className="text-xs text-gray-500 font-mono mb-1">OUTCOME</div>
              <div className="text-lg font-medium text-emerald-400 capitalize">{result.simulatedOutcome}</div>
            </div>
            <div className="p-4 bg-[#0a0a0c] rounded-lg border border-gray-800/60">
              <div className="text-xs text-gray-500 font-mono mb-1">IMPACT SCORE</div>
              <div className="text-lg font-medium text-gray-200">{result.impactScore} / 100</div>
            </div>
            <div className="p-4 bg-[#0a0a0c] rounded-lg border border-gray-800/60">
              <div className="text-xs text-gray-500 font-mono mb-1">STATUS</div>
              <div className="text-lg font-medium text-blue-400 capitalize">{result.status}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono text-gray-500 uppercase">Execution Logs</div>
            <div className="bg-[#0a0a0c] border border-gray-800/60 rounded-lg p-4 font-mono text-xs text-gray-400 space-y-1 h-32 overflow-y-auto">
              {result.logs.map((log, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-gray-600">[{new Date().toISOString().split('T')[1].split('.')[0]}]</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-800/60 flex justify-end">
            <button 
              onClick={() => setIsConfirmOpen(true)}
              className="px-6 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-colors"
            >
              Apply to Production
            </button>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmOpen}
        title="Confirm Policy Mutation"
        description="You are about to apply POL-102 to the production environment. This will immediately affect data egress boundaries for all active tenants. This action will be recorded in the immutable audit log."
        expectedConfirmationText="APPLY-POL-102"
        onConfirm={applyPolicy}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}

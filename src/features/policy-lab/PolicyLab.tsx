import React, { useState } from 'react';
import { Play, Sparkles, ArrowRight, Activity } from 'lucide-react';
import { api } from '../../lib/api';
import { DryRunResult, DryRunComparison } from '../../types';

type ContractReplayLog = {
  endpoint: string;
  issues: string[];
  timestamp: string;
  severity?: 'low' | 'medium' | 'high';
  score?: number;
};

type ContractReplayResponse = {
  total: number;
  recent: ContractReplayLog[];
};

export function PolicyLab() {
  const [baselineThreshold, setBaselineThreshold] = useState(0.7);
  const [candidateThreshold, setCandidateThreshold] = useState(0.85);

  const [baselineResult, setBaselineResult] = useState<DryRunResult | null>(null);
  const [candidateResult, setCandidateResult] = useState<DryRunResult | null>(null);
  const [comparison, setComparison] = useState<DryRunComparison | null>(null);
  const [systemReplay, setSystemReplay] = useState<{
    totalLogs: number;
    baselineReview: number;
    candidateReview: number;
    baselineHalt: number;
    candidateHalt: number;
    reviewDelta: number;
    haltDelta: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);

    try {
      const baseline = await api.post<DryRunResult>('/policy/dryrun', {
        policyId: 'POL-102',
        parameters: { threshold: baselineThreshold },
      });

      const candidate = await api.post<DryRunResult>('/policy/dryrun', {
        policyId: 'POL-102',
        parameters: { threshold: candidateThreshold },
      });

      const replayData = await fetch('/api/logs/contract-error').then((res) => res.json()) as ContractReplayResponse;
      const replayLogs = replayData.recent || [];

      const classify = (score: number, threshold: number) => {
        if (score >= threshold * 10 + 5) return 'halt';
        if (score >= threshold * 10) return 'review';
        return 'auto';
      };

      const baselineReview = replayLogs.filter((log) => classify(log.score ?? 0, baselineThreshold) === 'review').length;
      const candidateReview = replayLogs.filter((log) => classify(log.score ?? 0, candidateThreshold) === 'review').length;
      const baselineHalt = replayLogs.filter((log) => classify(log.score ?? 0, baselineThreshold) === 'halt').length;
      const candidateHalt = replayLogs.filter((log) => classify(log.score ?? 0, candidateThreshold) === 'halt').length;

      setSystemReplay({
        totalLogs: replayLogs.length,
        baselineReview,
        candidateReview,
        baselineHalt,
        candidateHalt,
        reviewDelta: candidateReview - baselineReview,
        haltDelta: candidateHalt - baselineHalt,
      });

      setBaselineResult(baseline);
      setCandidateResult(candidate);

      const impactDelta = candidate.impactScore - baseline.impactScore;
      const routingRecommendation = impactDelta > 10 ? 'halt' : impactDelta > 3 ? 'review' : 'ship';

      setComparison({
        baselineThreshold,
        candidateThreshold,
        thresholdDelta: candidateThreshold - baselineThreshold,
        baselineImpactScore: baseline.impactScore,
        candidateImpactScore: candidate.impactScore,
        impactDelta,
        baselineOutcome: baseline.simulatedOutcome,
        candidateOutcome: candidate.simulatedOutcome,
        routingRecommendation,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="p-6 bg-[#12121a] border border-gray-800/60 rounded-xl">
        <h3 className="text-lg text-gray-200 mb-4">Policy Dry-Run Simulator</h3>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-gray-500">Baseline Threshold</label>
            <input
              type="number"
              step="0.01"
              value={baselineThreshold}
              onChange={(e) => setBaselineThreshold(Number(e.target.value))}
              className="w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">Candidate Threshold</label>
            <input
              type="number"
              step="0.01"
              value={candidateThreshold}
              onChange={(e) => setCandidateThreshold(Number(e.target.value))}
              className="w-full mt-1 bg-[#1a1a24] border border-gray-700 rounded px-3 py-2"
            />
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="mt-4 flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded"
        >
          <Play className="w-4 h-4" /> Run Simulation
        </button>
      </div>

      {comparison && (
        <div className="p-6 bg-[#12121a] border border-gray-800/60 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-gray-200">
            <Sparkles className="w-4 h-4" /> Simulation Comparison
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>Baseline: {comparison.baselineImpactScore}</div>
            <div>Candidate: {comparison.candidateImpactScore}</div>
            <div>Delta: {comparison.impactDelta}</div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            {comparison.baselineOutcome}
            <ArrowRight className="w-4 h-4" />
            {comparison.candidateOutcome}
          </div>

          <div className="mt-4 p-4 border border-gray-700 rounded">
            <div className="text-xs text-gray-500">Routing Recommendation</div>
            <div
              className={`text-lg mt-1 ${
                comparison.routingRecommendation === 'ship'
                  ? 'text-emerald-400'
                  : comparison.routingRecommendation === 'review'
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {comparison.routingRecommendation.toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {systemReplay && (
        <div className="p-6 bg-[#12121a] border border-gray-800/60 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-gray-200">
            <Activity className="w-4 h-4" /> System-Wide Replay
          </div>

          <div className="text-xs text-gray-500">Replayed Logs: {systemReplay.totalLogs}</div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-4 border border-gray-700 rounded">
              <div className="text-xs text-gray-500">Baseline Review / Halt</div>
              <div className="mt-2 text-gray-200">{systemReplay.baselineReview} / {systemReplay.baselineHalt}</div>
            </div>
            <div className="p-4 border border-gray-700 rounded">
              <div className="text-xs text-gray-500">Candidate Review / Halt</div>
              <div className="mt-2 text-gray-200">{systemReplay.candidateReview} / {systemReplay.candidateHalt}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-4 border border-gray-700 rounded">
              <div className="text-xs text-gray-500">Review Delta</div>
              <div className={`mt-2 ${systemReplay.reviewDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {systemReplay.reviewDelta}
              </div>
            </div>
            <div className="p-4 border border-gray-700 rounded">
              <div className="text-xs text-gray-500">Halt Delta</div>
              <div className={`mt-2 ${systemReplay.haltDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {systemReplay.haltDelta}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

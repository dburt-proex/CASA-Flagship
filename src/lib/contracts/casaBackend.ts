import { z } from 'zod';

export const DashboardSchema = z.object({
  activePolicies: z.number(),
  decisions24h: z.number(),
  boundaryAlerts: z.number(),
  systemStatus: z.string(),
});

export const BoundaryStressSchema = z.object({
  stressLevel: z.string(),
  criticalBoundaries: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const PolicyDryRunSchema = z.object({
  status: z.string(),
  simulatedOutcome: z.string(),
  impactScore: z.number(),
  logs: z.array(z.string()),
});

export const DecisionReplaySchema = z.object({
  decisionId: z.string(),
  timestamp: z.string(),
  originalOutcome: z.string(),
  policyApplied: z.string(),
  context: z.record(z.string(), z.unknown()),
});

export type Dashboard = z.infer<typeof DashboardSchema>;
export type BoundaryStress = z.infer<typeof BoundaryStressSchema>;
export type PolicyDryRun = z.infer<typeof PolicyDryRunSchema>;
export type DecisionReplay = z.infer<typeof DecisionReplaySchema>;

export const parseDashboard = (input: unknown): Dashboard => DashboardSchema.parse(input);
export const parseBoundaryStress = (input: unknown): BoundaryStress => BoundaryStressSchema.parse(input);
export const parsePolicyDryRun = (input: unknown): PolicyDryRun => PolicyDryRunSchema.parse(input);
export const parseDecisionReplay = (input: unknown): DecisionReplay => DecisionReplaySchema.parse(input);

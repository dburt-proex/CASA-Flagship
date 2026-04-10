import { z } from 'zod';

// ============================================================================
// Python Bridge Contracts
// ============================================================================

export const DashboardSchema = z.object({
  activePolicies: z.number(),
  decisions24h: z.number(),
  boundaryAlerts: z.number(),
  systemStatus: z.enum(['healthy', 'degraded', 'critical']),
});

export const BoundaryStressSchema = z.object({
  stressLevel: z.number().min(0).max(100),
  criticalBoundaries: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const PolicyDryRunRequestSchema = z.object({
  policyId: z.string(),
  parameters: z.record(z.string(), z.any()),
  environment: z.enum(['staging', 'production']).default('staging'),
});

export const PolicyDryRunResponseSchema = z.object({
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
  context: z.record(z.string(), z.any()),
});

// ============================================================================
// API Route Contracts
// ============================================================================

export const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string(),
});

export const AdminApplyPolicySchema = z.object({
  policyId: z.string(),
  confirmationCode: z.string(),
  reason: z.string(),
});

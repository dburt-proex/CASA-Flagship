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
  policyId: z.string().min(1).max(100),
  parameters: z.record(z.string().max(100), z.unknown()),
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
  context: z.record(z.string(), z.unknown()),
});

// ============================================================================
// API Route Contracts
// ============================================================================

export const ChatRequestSchema = z.object({
  sessionId: z.string().max(200).optional(),
  message: z.string().min(1).max(10000),
});

export const AdminApplyPolicySchema = z.object({
  policyId: z.string().min(1).max(100),
  confirmationCode: z.string().min(1).max(200),
  reason: z.string().min(1).max(2000),
});

export const ContractErrorLogSchema = z.object({
  endpoint: z.string().min(1).max(500),
  issues: z.array(z.string().min(1).max(500)).min(1).max(20),
});

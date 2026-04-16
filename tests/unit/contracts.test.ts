import { describe, it, expect } from 'vitest';
import {
  DashboardSchema,
  BoundaryStressSchema,
  PolicyDryRunRequestSchema,
  PolicyDryRunResponseSchema,
  DecisionReplaySchema,
  ChatRequestSchema,
  AdminApplyPolicySchema,
} from '../../src/server/schemas/contracts';

// ============================================================================
// Dashboard Schema
// ============================================================================
describe('DashboardSchema', () => {
  it('accepts valid dashboard data', () => {
    const data = {
      activePolicies: 5,
      decisions24h: 120,
      boundaryAlerts: 3,
      systemStatus: 'healthy',
    };
    expect(DashboardSchema.parse(data)).toEqual(data);
  });

  it('accepts all valid system statuses', () => {
    for (const status of ['healthy', 'degraded', 'critical']) {
      expect(() =>
        DashboardSchema.parse({
          activePolicies: 1,
          decisions24h: 0,
          boundaryAlerts: 0,
          systemStatus: status,
        })
      ).not.toThrow();
    }
  });

  it('rejects invalid system status', () => {
    expect(() =>
      DashboardSchema.parse({
        activePolicies: 1,
        decisions24h: 0,
        boundaryAlerts: 0,
        systemStatus: 'invalid',
      })
    ).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => DashboardSchema.parse({})).toThrow();
    expect(() => DashboardSchema.parse({ activePolicies: 1 })).toThrow();
  });

  it('rejects non-numeric values', () => {
    expect(() =>
      DashboardSchema.parse({
        activePolicies: 'five',
        decisions24h: 0,
        boundaryAlerts: 0,
        systemStatus: 'healthy',
      })
    ).toThrow();
  });
});

// ============================================================================
// BoundaryStress Schema
// ============================================================================
describe('BoundaryStressSchema', () => {
  it('accepts valid boundary stress data', () => {
    const data = {
      stressLevel: 50,
      criticalBoundaries: ['boundary-1', 'boundary-2'],
      recommendations: ['action-1'],
    };
    expect(BoundaryStressSchema.parse(data)).toEqual(data);
  });

  it('accepts edge values for stressLevel', () => {
    expect(() =>
      BoundaryStressSchema.parse({
        stressLevel: 0,
        criticalBoundaries: [],
        recommendations: [],
      })
    ).not.toThrow();

    expect(() =>
      BoundaryStressSchema.parse({
        stressLevel: 100,
        criticalBoundaries: [],
        recommendations: [],
      })
    ).not.toThrow();
  });

  it('rejects stressLevel out of range', () => {
    expect(() =>
      BoundaryStressSchema.parse({
        stressLevel: -1,
        criticalBoundaries: [],
        recommendations: [],
      })
    ).toThrow();

    expect(() =>
      BoundaryStressSchema.parse({
        stressLevel: 101,
        criticalBoundaries: [],
        recommendations: [],
      })
    ).toThrow();
  });

  it('rejects non-array for criticalBoundaries', () => {
    expect(() =>
      BoundaryStressSchema.parse({
        stressLevel: 50,
        criticalBoundaries: 'not-an-array',
        recommendations: [],
      })
    ).toThrow();
  });
});

// ============================================================================
// PolicyDryRunRequest Schema
// ============================================================================
describe('PolicyDryRunRequestSchema', () => {
  it('accepts valid dry-run request', () => {
    const data = {
      policyId: 'POL-102',
      parameters: { threshold: 0.8 },
      environment: 'staging',
    };
    const result = PolicyDryRunRequestSchema.parse(data);
    expect(result.policyId).toBe('POL-102');
    expect(result.environment).toBe('staging');
  });

  it('defaults environment to staging', () => {
    const data = {
      policyId: 'POL-102',
      parameters: {},
    };
    const result = PolicyDryRunRequestSchema.parse(data);
    expect(result.environment).toBe('staging');
  });

  it('rejects invalid environment', () => {
    expect(() =>
      PolicyDryRunRequestSchema.parse({
        policyId: 'POL-102',
        parameters: {},
        environment: 'invalid',
      })
    ).toThrow();
  });

  it('rejects empty policyId', () => {
    expect(() =>
      PolicyDryRunRequestSchema.parse({
        policyId: '',
        parameters: {},
      })
    ).toThrow();
  });

  it('rejects overly long policyId', () => {
    expect(() =>
      PolicyDryRunRequestSchema.parse({
        policyId: 'A'.repeat(101),
        parameters: {},
      })
    ).toThrow();
  });
});

// ============================================================================
// PolicyDryRunResponse Schema
// ============================================================================
describe('PolicyDryRunResponseSchema', () => {
  it('accepts valid dry-run response', () => {
    const data = {
      status: 'success',
      simulatedOutcome: 'allow',
      impactScore: 42,
      logs: ['step-1', 'step-2'],
    };
    expect(PolicyDryRunResponseSchema.parse(data)).toEqual(data);
  });

  it('rejects missing fields', () => {
    expect(() => PolicyDryRunResponseSchema.parse({ status: 'ok' })).toThrow();
  });
});

// ============================================================================
// DecisionReplay Schema
// ============================================================================
describe('DecisionReplaySchema', () => {
  it('accepts valid decision replay data', () => {
    const data = {
      decisionId: 'DEC-001',
      timestamp: '2025-01-01T00:00:00Z',
      originalOutcome: 'allow',
      policyApplied: 'POL-102',
      context: { key: 'value' },
    };
    expect(DecisionReplaySchema.parse(data)).toEqual(data);
  });

  it('rejects missing decisionId', () => {
    expect(() =>
      DecisionReplaySchema.parse({
        timestamp: '2025-01-01T00:00:00Z',
        originalOutcome: 'allow',
        policyApplied: 'POL-102',
        context: {},
      })
    ).toThrow();
  });
});

// ============================================================================
// ChatRequest Schema
// ============================================================================
describe('ChatRequestSchema', () => {
  it('accepts valid chat request with sessionId', () => {
    const data = { sessionId: 'sess-123', message: 'Hello' };
    expect(ChatRequestSchema.parse(data)).toEqual(data);
  });

  it('accepts chat request without sessionId', () => {
    const data = { message: 'Hello' };
    expect(ChatRequestSchema.parse(data)).toEqual(data);
  });

  it('rejects empty message', () => {
    expect(() => ChatRequestSchema.parse({ message: '' })).toThrow();
  });

  it('rejects overly long message', () => {
    expect(() =>
      ChatRequestSchema.parse({ message: 'A'.repeat(10001) })
    ).toThrow();
  });

  it('rejects overly long sessionId', () => {
    expect(() =>
      ChatRequestSchema.parse({ sessionId: 'S'.repeat(201), message: 'Hello' })
    ).toThrow();
  });

  it('rejects missing message', () => {
    expect(() => ChatRequestSchema.parse({})).toThrow();
  });
});

// ============================================================================
// AdminApplyPolicy Schema
// ============================================================================
describe('AdminApplyPolicySchema', () => {
  it('accepts valid admin apply request', () => {
    const data = {
      policyId: 'POL-102',
      confirmationCode: 'APPLY-POL-102',
      reason: 'Necessary for compliance',
    };
    expect(AdminApplyPolicySchema.parse(data)).toEqual(data);
  });

  it('rejects empty policyId', () => {
    expect(() =>
      AdminApplyPolicySchema.parse({
        policyId: '',
        confirmationCode: 'APPLY-POL-102',
        reason: 'Test',
      })
    ).toThrow();
  });

  it('rejects empty reason', () => {
    expect(() =>
      AdminApplyPolicySchema.parse({
        policyId: 'POL-102',
        confirmationCode: 'APPLY-POL-102',
        reason: '',
      })
    ).toThrow();
  });

  it('rejects overly long reason', () => {
    expect(() =>
      AdminApplyPolicySchema.parse({
        policyId: 'POL-102',
        confirmationCode: 'APPLY-POL-102',
        reason: 'A'.repeat(2001),
      })
    ).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => AdminApplyPolicySchema.parse({})).toThrow();
  });
});

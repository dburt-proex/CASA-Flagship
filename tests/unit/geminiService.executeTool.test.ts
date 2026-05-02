/**
 * Unit tests for geminiService.executeTool — tool dispatch, validation,
 * unknown tool handling, and oversized payload truncation.
 *
 * Strategy: mock backendBridge and opsMetrics so no real HTTP or GCP calls
 * are made. Import executeTool directly (it is exported from gemini.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ioredis before importing gemini.ts (it connects at module load)
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  })),
}));

// Mock @google/genai so no real API calls happen during import
vi.mock('@google/genai', () => ({
  GoogleGenAI: function GoogleGenAI() { return {}; },
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
  Content: {},
}));

// Mock backendBridge
vi.mock('../../src/server/services/backendBridge.js', () => ({
  backendBridge: {
    getDashboard: vi.fn().mockResolvedValue({ activePolicies: 3, decisions24h: 10, boundaryAlerts: 0, systemStatus: 'healthy' }),
    getBoundaryStress: vi.fn().mockResolvedValue({ stressLevel: 20, criticalBoundaries: [], recommendations: ['STABLE'] }),
    runDryRun: vi.fn().mockResolvedValue({ status: 'SIMULATED', simulatedOutcome: 'No changes', impactScore: 0, logs: [] }),
    replayDecision: vi.fn().mockResolvedValue({ decisionId: 'DEC-1', timestamp: '', originalOutcome: 'ALLOW', policyApplied: 'POL-1', context: {} }),
  },
}));

const { executeTool } = await import('../../src/server/services/gemini.js');

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

describe('executeTool — tool dispatch', () => {
  it('dispatches fetchDashboard', async () => {
    const result = await executeTool({ name: 'fetchDashboard', args: {} });
    expect(result).toMatchObject({ activePolicies: 3, systemStatus: 'healthy' });
  });

  it('dispatches fetchBoundaryStress', async () => {
    const result = await executeTool({ name: 'fetchBoundaryStress', args: {} });
    expect(result).toMatchObject({ stressLevel: 20 });
  });

  it('dispatches runPolicyDryRun with valid policyId', async () => {
    const result = await executeTool({ name: 'runPolicyDryRun', args: { policyId: 'POL-102', environment: 'staging' } });
    expect(result).toMatchObject({ status: 'SIMULATED' });
  });

  it('dispatches replayDecision with valid decisionId', async () => {
    const result = await executeTool({ name: 'replayDecision', args: { decisionId: 'DEC-1' } });
    expect(result).toMatchObject({ decisionId: 'DEC-1' });
  });
});

// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------

describe('executeTool — unknown tool', () => {
  it('returns error object for unknown tool name', async () => {
    const result = await executeTool({ name: 'deleteEverything', args: {} });
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/unknown tool/i);
  });
});

// ---------------------------------------------------------------------------
// Input validation — max(100) on policyId / decisionId
// ---------------------------------------------------------------------------

describe('executeTool — input validation', () => {
  it('returns error when policyId is missing', async () => {
    const result = await executeTool({ name: 'runPolicyDryRun', args: {} });
    expect(result).toHaveProperty('error');
  });

  it('returns error when policyId exceeds 100 chars', async () => {
    const result = await executeTool({ name: 'runPolicyDryRun', args: { policyId: 'A'.repeat(101) } });
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/invalid|max/i);
  });

  it('returns error when policyId is not a string', async () => {
    const result = await executeTool({ name: 'runPolicyDryRun', args: { policyId: 12345 } });
    expect(result).toHaveProperty('error');
  });

  it('returns error when decisionId is missing', async () => {
    const result = await executeTool({ name: 'replayDecision', args: {} });
    expect(result).toHaveProperty('error');
  });

  it('returns error when decisionId exceeds 100 chars', async () => {
    const result = await executeTool({ name: 'replayDecision', args: { decisionId: 'X'.repeat(101) } });
    expect(result).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// Oversized payload truncation
// ---------------------------------------------------------------------------

describe('executeTool — payload truncation', () => {
  it('truncates payload when backendBridge returns >50000 chars', async () => {
    const { backendBridge } = await import('../../src/server/services/backendBridge.js');
    (backendBridge.getDashboard as any).mockResolvedValueOnce(
      // Create an object whose JSON representation is > 50000 chars
      { activePolicies: 1, decisions24h: 0, boundaryAlerts: 0, systemStatus: 'healthy', bigData: 'X'.repeat(60000) }
    );
    const result = await executeTool({ name: 'fetchDashboard', args: {} });
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/too large|truncated/i);
  });
});

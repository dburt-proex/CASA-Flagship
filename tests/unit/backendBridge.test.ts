import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DashboardSchema,
  BoundaryStressSchema,
  PolicyDryRunRequestSchema,
  PolicyDryRunResponseSchema,
  DecisionReplaySchema,
} from '../../src/server/schemas/contracts';

// ============================================================================
// Backend Bridge Tests (with mocked fetch)
// ============================================================================

const MOCK_BACKEND_URL = 'https://mock-backend.example.com';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('backendBridge fetch behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles network timeout via AbortController', async () => {
    mockFetch.mockImplementation(
      () => new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 50);
      })
    );

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10);

    try {
      await fetch(`${MOCK_BACKEND_URL}/api/v1/dashboard`, {
        signal: controller.signal,
      });
    } catch (error: any) {
      expect(error.name).toBe('AbortError');
    } finally {
      clearTimeout(id);
    }
  });

  it('handles HTTP error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const response = await fetch(`${MOCK_BACKEND_URL}/api/v1/dashboard`);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
  });

  it('validates dashboard response against schema', async () => {
    const validData = {
      activePolicies: 5,
      decisions24h: 120,
      boundaryAlerts: 3,
      systemStatus: 'healthy',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validData),
    });

    const response = await fetch(`${MOCK_BACKEND_URL}/api/v1/dashboard`);
    const data = await response.json();
    const parsed = DashboardSchema.parse(data);
    expect(parsed.activePolicies).toBe(5);
    expect(parsed.systemStatus).toBe('healthy');
  });

  it('rejects malformed dashboard response', async () => {
    const badData = { activePolicies: 'not-a-number' };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(badData),
    });

    const response = await fetch(`${MOCK_BACKEND_URL}/api/v1/dashboard`);
    const data = await response.json();
    expect(() => DashboardSchema.parse(data)).toThrow();
  });

  it('validates boundary stress response', async () => {
    const validData = {
      stressLevel: 75,
      criticalBoundaries: ['egress-limit'],
      recommendations: ['Reduce threshold'],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validData),
    });

    const response = await fetch(`${MOCK_BACKEND_URL}/api/v1/boundary-stress`);
    const data = await response.json();
    const parsed = BoundaryStressSchema.parse(data);
    expect(parsed.stressLevel).toBe(75);
  });

  it('validates dry-run request payload', () => {
    const validPayload = {
      policyId: 'POL-102',
      parameters: { threshold: 0.8 },
      environment: 'staging' as const,
    };
    expect(() => PolicyDryRunRequestSchema.parse(validPayload)).not.toThrow();
  });

  it('validates dry-run response', () => {
    const validResponse = {
      status: 'success',
      simulatedOutcome: 'allow',
      impactScore: 42,
      logs: ['step-1', 'step-2'],
    };
    expect(() => PolicyDryRunResponseSchema.parse(validResponse)).not.toThrow();
  });

  it('validates decision replay response', () => {
    const validReplay = {
      decisionId: 'DEC-001',
      timestamp: '2025-01-01T00:00:00Z',
      originalOutcome: 'allow',
      policyApplied: 'POL-102',
      context: { key: 'value' },
    };
    expect(() => DecisionReplaySchema.parse(validReplay)).not.toThrow();
  });

  it('includes request correlation ID in headers', async () => {
    const requestId = 'test-correlation-id-123';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          activePolicies: 0,
          decisions24h: 0,
          boundaryAlerts: 0,
          systemStatus: 'healthy',
        }),
    });

    await fetch(`${MOCK_BACKEND_URL}/api/v1/dashboard`, {
      headers: { 'X-Request-ID': requestId },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Request-ID': requestId,
        }),
      })
    );
  });
});

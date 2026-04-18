import { 
  DashboardSchema, 
  BoundaryStressSchema, 
  PolicyDryRunRequestSchema, 
  PolicyDryRunResponseSchema,
  DecisionReplaySchema
} from '../schemas/contracts.js';
import { z } from 'zod';

const BACKEND_API_URL = process.env.PYTHON_API_URL || process.env.BACKEND_API_URL || 'https://dburt-proex-python-fastapi-backend.onrender.com';
console.log('[BACKEND BRIDGE] Initialized with URL:', BACKEND_API_URL);

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Backend Bridge Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Backend Bridge Timeout: Request to ${url} exceeded ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

function buildHeaders(requestId?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (requestId) headers['X-Request-ID'] = requestId;
  return headers;
}

export const backendBridge = {
  async getDashboard(requestId?: string): Promise<z.infer<typeof DashboardSchema>> {
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/api/v1/dashboard`, { headers: buildHeaders(requestId) });
    return DashboardSchema.parse(data);
  },

  async getBoundaryStress(requestId?: string): Promise<z.infer<typeof BoundaryStressSchema>> {
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/api/v1/boundary-stress`, { headers: buildHeaders(requestId) });
    return BoundaryStressSchema.parse(data);
  },

  async runDryRun(payload: z.infer<typeof PolicyDryRunRequestSchema>, requestId?: string): Promise<z.infer<typeof PolicyDryRunResponseSchema>> {
    PolicyDryRunRequestSchema.parse(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...buildHeaders(requestId) };
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/api/v1/policy/dryrun`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return PolicyDryRunResponseSchema.parse(data);
  },

  async replayDecision(decisionId: string, requestId?: string): Promise<z.infer<typeof DecisionReplaySchema>> {
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/api/v1/decision-replay/${decisionId}`, { headers: buildHeaders(requestId) });
    return DecisionReplaySchema.parse(data);
  },

  async applyPolicy(policyId: string, reason: string, requestId?: string): Promise<{ success: boolean; auditId: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...buildHeaders(requestId) };
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/api/v1/admin/policy/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ policyId, reason })
    });
    return data as { success: boolean; auditId: string };
  }
};

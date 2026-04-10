import { 
  DashboardSchema, 
  BoundaryStressSchema, 
  PolicyDryRunRequestSchema, 
  PolicyDryRunResponseSchema,
  DecisionReplaySchema
} from '../schemas/contracts';
import { z } from 'zod';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Python Bridge Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Python Bridge Timeout: Request to ${url} exceeded ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export const pythonBridge = {
  async getDashboard(requestId?: string): Promise<z.infer<typeof DashboardSchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${PYTHON_API_URL}/api/v1/dashboard`, { headers });
    return DashboardSchema.parse(data);
  },

  async getBoundaryStress(requestId?: string): Promise<z.infer<typeof BoundaryStressSchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${PYTHON_API_URL}/api/v1/boundary-stress`, { headers });
    return BoundaryStressSchema.parse(data);
  },

  async runDryRun(payload: z.infer<typeof PolicyDryRunRequestSchema>, requestId?: string): Promise<z.infer<typeof PolicyDryRunResponseSchema>> {
    PolicyDryRunRequestSchema.parse(payload);
    const headers = {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-ID': requestId } : {})
    };
    const data = await fetchWithTimeout(`${PYTHON_API_URL}/api/v1/policy/dryrun`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return PolicyDryRunResponseSchema.parse(data);
  },

  async replayDecision(decisionId: string, requestId?: string): Promise<z.infer<typeof DecisionReplaySchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${PYTHON_API_URL}/api/v1/decision-replay/${decisionId}`, { headers });
    return DecisionReplaySchema.parse(data);
  },

  async applyPolicy(policyId: string, reason: string, requestId?: string): Promise<{ success: boolean; auditId: string }> {
    const headers = {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-ID': requestId } : {})
    };
    const data = await fetchWithTimeout(`${PYTHON_API_URL}/api/v1/admin/policy/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ policyId, reason })
    });
    return data;
  }
};

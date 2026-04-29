import { 
  DashboardSchema, 
  BoundaryStressSchema, 
  PolicyDryRunRequestSchema, 
  PolicyDryRunResponseSchema,
  DecisionReplaySchema
} from '../schemas/contracts.js';
import { z } from 'zod';

let BACKEND_API_URL = process.env.CASA_GOVERNANCE_API_URL || process.env.CASA_API_URL || process.env.BACKEND_API_URL || 'http://127.0.0.1:5000';
if (BACKEND_API_URL.startsWith('CASA_GOVERNANCE_API_URL=')) {
  BACKEND_API_URL = BACKEND_API_URL.replace('CASA_GOVERNANCE_API_URL=', '');
}
if (BACKEND_API_URL.endsWith('/')) {
  BACKEND_API_URL = BACKEND_API_URL.slice(0, -1);
}
console.log('[BACKEND BRIDGE] Initialized with canonical CASA Governance API:', BACKEND_API_URL);

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(`Backend Bridge Error: Response payload too large (${contentLength} bytes)`);
    }

    if (!response.ok) {
      throw new Error(`Backend Bridge Error: ${response.status} ${response.statusText}`);
    }
    
    const text = await response.text();
    if (text.length > 5 * 1024 * 1024) { // 5MB limit
      throw new Error(`Backend Bridge Error: Response payload too large (${text.length} characters)`);
    }
    
    return JSON.parse(text);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Backend Bridge Timeout: Request to ${url} exceeded ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export const backendBridge = {
  async getDashboard(requestId?: string): Promise<z.infer<typeof DashboardSchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/dashboard`, { headers });
    return DashboardSchema.parse(data);
  },

  async getBoundaryStress(requestId?: string): Promise<z.infer<typeof BoundaryStressSchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/boundary-stress`, { headers });
    return BoundaryStressSchema.parse(data);
  },

  async runDryRun(payload: z.infer<typeof PolicyDryRunRequestSchema>, requestId?: string): Promise<z.infer<typeof PolicyDryRunResponseSchema>> {
    PolicyDryRunRequestSchema.parse(payload);
    const headers = {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-ID': requestId } : {})
    };
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/policy/dryrun`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return PolicyDryRunResponseSchema.parse(data);
  },

  async replayDecision(decisionId: string, requestId?: string): Promise<z.infer<typeof DecisionReplaySchema>> {
    const headers = requestId ? { 'X-Request-ID': requestId } : {};
    const data = await fetchWithTimeout(`${BACKEND_API_URL}/decision-replay/${decisionId}`, { headers });
    return DecisionReplaySchema.parse(data);
  },

  async applyPolicy(_policyId: string, _reason: string, _requestId?: string): Promise<{ success: boolean; auditId: string }> {
    throw new Error('Canonical CASA governance API does not yet expose admin policy apply. Add this endpoint in casa-control-plane before enabling policy mutation from CASA-Flagship.');
  }
};

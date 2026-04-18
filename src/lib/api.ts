import {
  BoundaryStressSchema,
  DashboardSchema,
  DecisionReplaySchema,
  PolicyDryRunResponseSchema,
} from '../server/schemas/contracts';

function handleUnauthorized(): never {
  localStorage.removeItem('casa_token');
  localStorage.removeItem('casa_user');
  window.location.reload();
  // reload() navigates away; this throw keeps the return type as `never`
  throw new Error('Unauthorized — session cleared');
}

function parseKnownGetResponse<T>(endpoint: string, data: unknown): T {
  switch (endpoint) {
    case '/v1/dashboard':
    case '/dashboard':
      return DashboardSchema.parse(data) as T;
    case '/v1/boundary-stress':
    case '/boundary-stress':
    case '/stress':
      return BoundaryStressSchema.parse(data) as T;
    default:
      return data as T;
  }
}

function parseKnownPostResponse<T>(endpoint: string, data: unknown): T {
  switch (endpoint) {
    case '/v1/policy/dryrun':
    case '/policy/dryrun':
      return PolicyDryRunResponseSchema.parse(data) as T;
    default:
      return data as T;
  }
}

export const api = {
  async post<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const token = localStorage.getItem('casa_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      const errorData = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }

    const data = await res.json() as unknown;
    return parseKnownPostResponse<T>(endpoint, data);
  },

  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('casa_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      headers
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      const errorData = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }

    const data = await res.json() as unknown;

    if (endpoint.startsWith('/v1/decision-replay/') || endpoint.startsWith('/replay/')) {
      return DecisionReplaySchema.parse(data) as T;
    }

    return parseKnownGetResponse<T>(endpoint, data);
  }
};

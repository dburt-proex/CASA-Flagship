import { ZodError } from 'zod';
import {
  BoundaryStressSchema,
  DashboardSchema,
  DecisionReplaySchema,
  PolicyDryRunResponseSchema,
} from '../server/schemas/contracts';

export class ApiContractError extends Error {
  endpoint: string;
  issues: string[];
  payload: unknown;

  constructor(endpoint: string, payload: unknown, issues: string[]) {
    super(`Contract validation failed for ${endpoint}`);
    this.name = 'ApiContractError';
    this.endpoint = endpoint;
    this.payload = payload;
    this.issues = issues;
  }
}

async function sendToBackend(error: ApiContractError) {
  try {
    await fetch('/api/logs/contract-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: error.endpoint,
        issues: error.issues,
      }),
    });
  } catch {
    // logging must never break runtime behavior
  }
}

function reportContractError(error: ApiContractError): void {
  console.error('[CASA contract error]', {
    endpoint: error.endpoint,
    issues: error.issues,
    payload: error.payload,
  });

  void sendToBackend(error);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('casa:contract-error', {
        detail: {
          endpoint: error.endpoint,
          issues: error.issues,
        },
      }),
    );
  }
}

function toApiContractError(endpoint: string, payload: unknown, error: unknown): ApiContractError {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
    return new ApiContractError(endpoint, payload, issues);
  }

  return new ApiContractError(endpoint, payload, ['Unknown contract validation failure']);
}

function validateOrThrow<T>(endpoint: string, payload: unknown, parser: (input: unknown) => T): T {
  try {
    return parser(payload);
  } catch (error) {
    const contractError = toApiContractError(endpoint, payload, error);
    reportContractError(contractError);
    throw contractError;
  }
}

function handleUnauthorized(): never {
  localStorage.removeItem('casa_token');
  localStorage.removeItem('casa_user');
  window.location.reload();
  throw new Error('Unauthorized, session cleared');
}

function parseKnownGetResponse<T>(endpoint: string, data: unknown): T {
  switch (endpoint) {
    case '/v1/dashboard':
    case '/dashboard':
      return validateOrThrow(endpoint, data, DashboardSchema.parse) as T;
    case '/v1/boundary-stress':
    case '/boundary-stress':
    case '/stress':
      return validateOrThrow(endpoint, data, BoundaryStressSchema.parse) as T;
    default:
      return data as T;
  }
}

function parseKnownPostResponse<T>(endpoint: string, data: unknown): T {
  switch (endpoint) {
    case '/v1/policy/dryrun':
    case '/policy/dryrun':
      return validateOrThrow(endpoint, data, PolicyDryRunResponseSchema.parse) as T;
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
      headers.Authorization = `Bearer ${token}`;
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

      const errorData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }

    const data = (await res.json()) as unknown;
    return parseKnownPostResponse<T>(endpoint, data);
  },

  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('casa_token');
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`/api${endpoint}`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }

      const errorData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errorData.error ?? `API Error: ${res.statusText}`);
    }

    const data = (await res.json()) as unknown;

    if (endpoint.startsWith('/v1/decision-replay/') || endpoint.startsWith('/replay/')) {
      return validateOrThrow(endpoint, data, DecisionReplaySchema.parse) as T;
    }

    return parseKnownGetResponse<T>(endpoint, data);
  },
};

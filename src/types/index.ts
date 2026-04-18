export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'archived';
}

export interface DryRunResult {
  status: string;
  simulatedOutcome: string;
  impactScore: number;
  logs: string[];
}

// Mirrors DashboardSchema in src/server/schemas/contracts.ts
export interface DashboardData {
  activePolicies: number;
  decisions24h: number;
  boundaryAlerts: number;
  systemStatus: 'healthy' | 'degraded' | 'critical';
}

// Structured result returned by the Gemini policy analysis endpoint.
export interface PolicyAnalysis {
  summary: string;
  predictedReviewLoad: string;
  outcomeComparison: string;
  approvalBrief: string;
}

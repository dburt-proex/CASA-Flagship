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

export interface PolicyScenarioConfig {
  policyId: string;
  environment: 'staging' | 'production';
  threshold: number;
}

export interface DryRunComparison {
  baselineThreshold: number;
  candidateThreshold: number;
  thresholdDelta: number;
  baselineImpactScore: number;
  candidateImpactScore: number;
  impactDelta: number;
  baselineOutcome: string;
  candidateOutcome: string;
  routingRecommendation: 'ship' | 'review' | 'halt';
}

export interface PolicyVersion {
  id: string;
  label: string;
  threshold: number;
}

export interface ReplayWindowOption {
  id: '24h' | '7d' | '30d' | 'all';
  label: string;
}

export interface HistoricalReplaySummary {
  replayWindow: ReplayWindowOption['id'];
  totalLogs: number;
  baselineReview: number;
  candidateReview: number;
  baselineHalt: number;
  candidateHalt: number;
  reviewDelta: number;
  haltDelta: number;
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

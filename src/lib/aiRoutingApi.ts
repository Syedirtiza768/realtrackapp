import { fetchWithAuth } from './authApi';

export type SegmentStat = {
  segmentKey: string;
  model: string;
  attempts: number;
  firstPassRate: number;
  escalationRate: number;
  avgCost: number;
  avgValidationScore: number;
  avgComplianceScore: number;
  humanApprovalRate: number;
  publishSuccessRate: number;
  hardFailRate: number;
  publishErrorRate: number;
};

export type RoutingStatsResponse = {
  generatedAt: string;
  policyVersion: number | null;
  segments: SegmentStat[];
  costByLane: Record<string, number>;
  sessionCostUsd: number;
};

export type RoutingRecommendation = {
  segment: string;
  model: string;
  attempts: number;
  reward: number;
  prior: number | null;
};

export type RoutingRecommendationsResponse = {
  generatedAt: string;
  recommendations: RoutingRecommendation[];
};

export type RoutingPolicy = {
  version: number | null;
  generatedAt?: string;
  canaryPercent?: number;
  source?: string;
  segments?: Record<string, { lane: string; model: string }>;
  thresholds?: Record<string, number>;
  escalationChain?: string[];
  blocklist?: string[];
  pins?: Record<string, string>;
};

export function fetchAiRoutingStats(): Promise<RoutingStatsResponse> {
  return fetchWithAuth<RoutingStatsResponse>('/api/ai/routing/stats');
}

export function fetchAiRoutingRecommendations(): Promise<RoutingRecommendationsResponse> {
  return fetchWithAuth<RoutingRecommendationsResponse>(
    '/api/ai/routing/recommendations',
  );
}

export function fetchAiRoutingPolicy(): Promise<RoutingPolicy> {
  return fetchWithAuth<RoutingPolicy>('/api/ai/routing/policy');
}

export function runAiRoutingOptimize(): Promise<RoutingPolicy> {
  return fetchWithAuth<RoutingPolicy>('/api/ai/routing/optimize', {
    method: 'POST',
  });
}

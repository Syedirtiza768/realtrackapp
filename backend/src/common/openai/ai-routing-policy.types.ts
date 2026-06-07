/**
 * AI routing policy schema — shared between ModelRouter and AiOptimizer.
 */

export type AiLane = 'default' | 'flagship' | 'bulk' | 'escalation' | 'text';

export type RunMode = 'default' | 'bulk' | 'flagship';

export interface SegmentRoute {
  lane: AiLane;
  model: string;
}

export interface RoutingThresholds {
  flagshipMinPrice: number;
  fitmentMinRows: number;
  autoApproveMinScore: number;
}

export interface AiRoutingPolicy {
  version: number;
  generatedAt: string;
  canaryPercent?: number;
  source?: string;
  segments: Record<string, SegmentRoute>;
  thresholds: RoutingThresholds;
  escalationChain: string[];
  blocklist: string[];
  pins?: Record<string, SegmentRoute>;
}

export interface PartContext {
  sku?: string;
  partNumber?: string;
  partName?: string;
  partType?: string;
  price?: number;
  marketplace?: string;
  donorMake?: string;
}

export interface RouteSelection {
  lane: AiLane;
  model: string;
  policyVersion: number | null;
  segmentKey: string;
}

export interface ValidationResult {
  pass: boolean;
  score: number;
  hardFails: string[];
  softFails: string[];
  escalate: boolean;
  fitmentRowCount: number;
}

export interface GuardResult {
  item: Record<string, unknown>;
  fixes: string[];
}

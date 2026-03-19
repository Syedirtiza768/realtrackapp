/**
 * pricingApi.ts — Typed frontend API client for Pricing Intelligence.
 *
 * Phase 5: Market Intelligence & Dynamic Pricing
 * Covers: competitor data, AI pricing suggestions, auto-reprice, market snapshots.
 */
import { authGet, authPost } from './authApi';

/* ─── Types ─── */

export interface CompetitorPrice {
  id: string;
  masterProductId: string | null;
  partNumber: string;
  ebayItemId: string | null;
  title: string | null;
  seller: string | null;
  price: number;
  currency: string;
  condition: string | null;
  quantityAvailable: number | null;
  quantitySold: number | null;
  capturedAt: string;
}

export interface MarketSnapshot {
  id: string;
  masterProductId: string;
  partNumber: string;
  totalListings: number;
  avgPrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  recommendedPricing: {
    competitive: number | null;
    premium: number | null;
    aggressive: number | null;
    rationale: string | null;
  } | null;
  marketInsights: string[];
  confidence: number | null;
  aiCostUsd: number | null;
  capturedAt: string;
}

export interface PricingSuggestion {
  suggestedPrice: number;
  reasoning: string;
  marketPosition: 'below_average' | 'average' | 'above_average';
  confidence: number;
  minViablePrice: number;
  maxRecommendedPrice: number;
  marginPercent: number;
  competitorCount: number;
  pricingStrategy: 'undercut' | 'match' | 'premium' | 'value';
  actionItems: string[];
}

export interface RepriceResult {
  offerId: string;
  storeId: string;
  storeName: string;
  oldPrice: number | null;
  newPrice: number;
  action: 'repriced' | 'unchanged' | 'skipped' | 'error';
  error?: string;
}

export interface RepriceResponse {
  suggestion: PricingSuggestion;
  results: RepriceResult[];
}

export interface CollectResult {
  processed?: number;
  collected?: number;
  pricesCollected?: number;
  errors?: number;
}

/* ─── Market Data ─── */

export async function getLatestSnapshot(productId: string): Promise<MarketSnapshot | null> {
  return authGet<MarketSnapshot | null>(`/api/pricing/${productId}/snapshot`);
}

export async function getSnapshotHistory(
  productId: string,
  limit = 30,
): Promise<MarketSnapshot[]> {
  return authGet<MarketSnapshot[]>(`/api/pricing/${productId}/snapshots?limit=${limit}`);
}

export async function getCompetitorHistory(
  productId: string,
  days = 30,
): Promise<CompetitorPrice[]> {
  return authGet<CompetitorPrice[]>(`/api/pricing/${productId}/competitors?days=${days}`);
}

/* ─── AI Pricing ─── */

export async function getPricingSuggestion(productId: string): Promise<PricingSuggestion> {
  return authGet<PricingSuggestion>(`/api/pricing/${productId}/suggestion`);
}

export async function repriceProduct(
  productId: string,
  options?: { storeIds?: string[]; forceApply?: boolean },
): Promise<RepriceResponse> {
  return authPost<RepriceResponse>('/api/pricing/reprice', {
    productId,
    ...options,
  });
}

/* ─── Data Collection ─── */

export async function collectCompetitorPrices(productId?: string): Promise<CollectResult> {
  return authPost<CollectResult>('/api/pricing/collect', { productId });
}

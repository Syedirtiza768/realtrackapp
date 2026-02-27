/* ─── Multi-Store + AI Enhancement Types ────────────────────
 *  Types for the enterprise multi-store, AI enhancement,
 *  and demo simulation systems.
 * ────────────────────────────────────────────────────────── */

// ─── Stores ───

export interface Store {
  id: string;
  connectionId: string;
  channel: string;
  storeName: string;
  storeUrl: string | null;
  externalStoreId: string | null;
  status: 'active' | 'paused' | 'suspended' | 'archived';
  isPrimary: boolean;
  config: Record<string, unknown>;
  metricsCache: Record<string, unknown>;
  listingCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Listing Channel Instances ───

export type InstanceSyncStatus = 'synced' | 'pending' | 'publishing' | 'error' | 'ended' | 'draft';

export interface ListingChannelInstance {
  id: string;
  listingId: string;
  connectionId: string;
  storeId: string;
  channel: string;
  externalId: string | null;
  externalUrl: string | null;
  overridePrice: number | null;
  overrideQuantity: number | null;
  overrideTitle: string | null;
  channelSpecificData: Record<string, unknown>;
  syncStatus: InstanceSyncStatus;
  lastPushedVersion: number | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  retryCount: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  store?: Store;
}

export interface ChannelSummaryItem {
  channel: string;
  storeCount: number;
  publishedCount: number;
  totalStores: Array<{
    storeId: string;
    storeName: string;
    syncStatus: InstanceSyncStatus;
    externalId: string | null;
  }>;
}

export interface ListingChannelOverview {
  instances: ListingChannelInstance[];
  channelSummary: ChannelSummaryItem[];
}

export interface MultiStorePublishResult {
  results: Array<{
    storeId: string;
    instanceId?: string;
    status: string;
    error?: string;
  }>;
}

// ─── AI Enhancements ───

export type EnhancementType =
  | 'title_optimization'
  | 'description_generation'
  | 'item_specifics'
  | 'fitment_detection'
  | 'image_enhancement';

export type EnhancementStatus = 'requested' | 'processing' | 'generated' | 'approved' | 'rejected';

export interface AiEnhancement {
  id: string;
  listingId: string;
  enhancementType: EnhancementType;
  status: EnhancementStatus;
  inputData: Record<string, unknown>;
  originalValue: string | null;
  enhancedValue: string | null;
  enhancedData: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  confidenceScore: number | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  costUsd: number | null;
  version: number;
  enhancementVersion: number;
  approvedBy: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiEnhancementStats {
  totalCount: number;
  byType: Array<{ type: string; count: string }>;
  byStatus: Array<{ status: string; count: string }>;
  avgConfidence: number;
}

// ─── Demo Simulation ───

export interface DemoSimulationLog {
  id: string;
  operationType: string;
  channel: string;
  storeId: string | null;
  listingId: string | null;
  instanceId: string | null;
  simulatedExternalId: string | null;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  simulatedLatencyMs: number;
  simulatedSuccess: boolean;
  simulatedError: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Dashboard Multi-Store Metrics ───

export interface MultiStoreMetrics {
  stores: Array<{
    channel: string;
    storeCount: string;
    totalListings: string;
    connectionCount: string;
  }>;
  instances: Array<{
    channel: string;
    syncStatus: string;
    count: string;
    uniqueListings: string;
    uniqueStores: string;
  }>;
  aiEnhancements: Array<{
    type: string;
    status: string;
    count: string;
    avgConfidence: string;
    totalTokens: string;
  }>;
  demoSimulations: Array<{
    operationType: string;
    channel: string;
    count: string;
    avgLatency: string;
    successCount: string;
  }>;
  computedAt: string;
}

// ─── Enhancement Type Display Config ───

export const ENHANCEMENT_TYPE_META: Record<
  EnhancementType,
  { label: string; icon: string; description: string; color: string }
> = {
  title_optimization: {
    label: 'Title Optimizer',
    icon: 'Type',
    description: 'AI-optimized titles for maximum search visibility',
    color: 'blue',
  },
  description_generation: {
    label: 'Description Generator',
    icon: 'FileText',
    description: 'Professional HTML descriptions with structured sections',
    color: 'purple',
  },
  item_specifics: {
    label: 'Item Specifics',
    icon: 'ListChecks',
    description: 'Auto-populate eBay item specifics from catalog data',
    color: 'green',
  },
  fitment_detection: {
    label: 'Fitment Detection',
    icon: 'Car',
    description: 'Detect vehicle compatibility from title and part data',
    color: 'orange',
  },
  image_enhancement: {
    label: 'Image Enhancement',
    icon: 'Image',
    description: 'Professional image processing for marketplace compliance',
    color: 'pink',
  },
};

export const CHANNEL_COLORS: Record<string, string> = {
  ebay: '#E53238',
  shopify: '#96BF48',
  amazon: '#FF9900',
  walmart: '#0071DC',
};

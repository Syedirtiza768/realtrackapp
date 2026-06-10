/* ─── Pipeline Types ──────────────────────────────────────
 *  TypeScript types for the VIN-to-listing enrichment pipeline.
 * ────────────────────────────────────────────────────────── */

export type PipelineJobStatus =
  | 'pending'
  | 'uploading'
  | 'vin_decode'
  | 'category_mapping'
  | 'enrichment'
  | 'validation'
  | 'output_generation'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OptimizationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_review';

export type FitmentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_review';

export type EnrichmentMode = 'ai' | 'fallback' | 'mixed' | 'none';

export interface PipelineCategoryMappingSummary {
  apiMapped?: number;
  fallbackMapped?: number;
  apiRate?: string;
  apiSkippedReason?: string | null;
  treeCacheHit?: boolean;
  treeCacheSource?: string | null;
  taxonomyErrors?: Array<{ type?: string; message: string; source?: string; status?: number | null }>;
}

export interface PipelineEnrichmentSummary {
  enrichmentMode?: EnrichmentMode;
  totalAiEnriched?: number;
  totalFallbackEnrichment?: number;
  totalListingsGenerated?: number;
  openRouterModel?: string;
  openRouterProbeErrors?: Array<{ type?: string; message: string }>;
  enrichmentErrors?: Array<{ type?: string; message: string; batchSize?: number }>;
  categoryMapping?: PipelineCategoryMappingSummary;
  categoryTaxonomyBackoff?: boolean;
  localization?: {
    auAiTranslated?: number;
    deAiTranslated?: number;
    auRuleOnly?: number;
    deRuleOnly?: number;
    errors?: number;
  };
}

export interface PipelineJob {
  id: string;
  status: PipelineJobStatus;
  originalFilename: string;
  storedFilePath: string | null;
  fileSizeBytes: number;
  totalParts: number;
  processedParts: number;
  vinDecodeSuccess: number;
  vinDecodeFailed: number;
  categoryApiCount: number;
  categoryFallbackCount: number;
  enrichedCount: number;
  fallbackCount: number;
  openaiTokensUsed: number;
  openaiCostUsd: number;
  outputUsPath: string | null;
  outputAuPath: string | null;
  outputDePath: string | null;
  reportPath: string | null;
  optimizationStatus?: OptimizationStatus;
  optimizationProcessed?: number;
  optimizationTotal?: number;
  optimizationPassCount?: number;
  optimizationReviewCount?: number;
  optimizationBlockCount?: number;
  stageDetails: Record<string, unknown> | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptimizationSummary {
  productId: string;
  sku: string | null;
  optimizationStatus: OptimizationStatus;
  fitmentStatus: FitmentStatus;
  ebayValidationStatus: string | null;
  optimizedTitle: string | null;
  validationStatus: 'pass' | 'review' | 'block';
  uploadReadinessScore: number;
  seoScore: number;
  readinessScore: number;
  fitmentConfidence: number | null;
  fitmentRowCount: number;
  manualReview: boolean;
  errors: Array<{ code: string; severity: string; message: string; field?: string }>;
  warnings: Array<{ code: string; severity: string; message: string; field?: string }>;
  missingDataReport: string[];
  canPublish: boolean;
}

export interface JobOptimizationStatus {
  jobId: string;
  optimizationStatus: OptimizationStatus;
  processed: number;
  total: number;
  passCount: number;
  reviewCount: number;
  blockCount: number;
  byMarketplace?: Record<string, {
    status: string;
    passCount: number;
    reviewCount: number;
    blockCount: number;
    processed?: number;
    total?: number;
  }>;
  products: ProductOptimizationSummary[];
}

export interface PipelineStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface EnterpriseListingOptimization {
  productId: string;
  sku: string | null;
  optimizedTitle: string;
  validationStatus: 'pass' | 'review' | 'block';
  uploadReadinessScore: number;
  complianceWarnings: Array<{
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    field?: string;
  }>;
  missingDataReport: string[];
  finalUploadPayload: Record<string, unknown>;
}

export interface EnterpriseOptimizationResult {
  jobId: string;
  marketplace: 'US' | 'DE' | 'AU';
  totalProducts: number;
  aiGeneratedCount: number;
  blockedCount: number;
  reviewCount: number;
  passCount: number;
  averageUploadReadiness: number;
  listings: EnterpriseListingOptimization[];
}

export interface CombinedOptimizationResult {
  job: PipelineJob;
  enterprise: EnterpriseOptimizationResult;
}

export type ListingQualityProfile =
  | 'max_seo_comprehensive'
  | 'balanced'
  | 'creative_exploration';

/** Stage metadata for the progress stepper */
export const PIPELINE_STAGES: Array<{
  key: PipelineJobStatus;
  label: string;
  description: string;
}> = [
  { key: 'uploading', label: 'Upload', description: 'Uploading file' },
  { key: 'vin_decode', label: 'VIN Decode', description: 'Decoding VINs via NHTSA' },
  { key: 'category_mapping', label: 'Categories', description: 'Mapping eBay categories' },
  { key: 'enrichment', label: 'Enrichment', description: 'AI-powered listing enrichment' },
  { key: 'validation', label: 'Validation', description: 'Compliance checks' },
  { key: 'output_generation', label: 'Output', description: 'Generating templates' },
];

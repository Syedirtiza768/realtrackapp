/* ─── Motors Intelligence Types ────────────────────────────
 *  TypeScript types for the Motors Intelligence pipeline.
 * ────────────────────────────────────────────────────────── */

/* ── Enums ────────────────────────────────────────────────── */

export type MotorsProductStatus =
  | 'pending'
  | 'extracting'
  | 'identifying'
  | 'resolving_fitment'
  | 'generating_listing'
  | 'validating'
  | 'review_required'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected';

export type MotorsSourceType =
  | 'image_upload'
  | 'catalog_import'
  | 'manual_entry'
  | 'supplier_feed'
  | 'barcode_scan';

export type ReviewTaskStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'deferred' | 'auto_resolved';
export type ReviewTaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type ReviewReason =
  | 'low_confidence_identity'
  | 'multiple_identities'
  | 'no_identity_match'
  | 'ocr_conflict'
  | 'brand_ambiguity'
  | 'fitment_mismatch'
  | 'fitment_incomplete'
  | 'compliance_failure'
  | 'title_quality'
  | 'description_quality'
  | 'image_only'
  | 'manual_override'
  | 'price_anomaly'
  | 'duplicate_detected'
  | 'category_uncertain';

/* ── Core Types ───────────────────────────────────────────── */

export interface MotorsProduct {
  id: string;
  organizationId: string | null;
  listingId: string | null;
  catalogProductId: string | null;
  status: MotorsProductStatus;
  sourceType: MotorsSourceType;

  // Resolved identity
  brand: string | null;
  mpn: string | null;
  mpnNormalized: string | null;
  oemPartNumber: string | null;
  interchangeNumbers: string[];
  upc: string | null;
  epid: string | null;
  productType: string | null;
  productFamily: string | null;
  placement: string | null;
  condition: string | null;

  // Confidence scores
  identityConfidence: number;
  fitmentConfidence: number;
  complianceScore: number;
  contentQualityScore: number;

  // Generated listing content
  generatedTitle: string | null;
  generatedHtmlDescription: string | null;
  generatedBulletFeatures: string[];
  generatedItemSpecifics: Record<string, string>;

  // Fitment
  fitmentRows: FitmentRow[];

  // Images
  imageUrls: string[];
  imageAssetIds: string[];

  // Pricing
  price: number | null;
  quantity: number | null;

  // eBay publishing
  ebayCategoryId: string | null;
  ebayCategoryName: string | null;
  ebayItemId: string | null;
  publishedAt: string | null;
  publishError: string | null;

  // Metadata
  rawSupplierData: Record<string, unknown> | null;
  processingNotes: string[];
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FitmentRow {
  year: number;
  make: string;
  model: string;
  submodel?: string;
  engine?: string;
  notes?: string;
}

export interface ReviewTask {
  id: string;
  motorsProductId: string;
  status: ReviewTaskStatus;
  priority: ReviewTaskPriority;
  reason: ReviewReason;
  reasonDetails: string | null;

  // Snapshots for context
  productSnapshot: Record<string, unknown> | null;
  candidatesSnapshot: Record<string, unknown>[] | null;
  extractionSnapshot: Record<string, unknown> | null;
  fitmentSnapshot: Record<string, unknown> | null;
  validationSnapshot: Record<string, unknown> | null;
  complianceSnapshot: Record<string, unknown> | null;

  // Assignment
  assignedTo: string | null;
  assignedAt: string | null;

  // Resolution
  resolution: string | null;
  resolutionData: Record<string, unknown> | null;
  resolvedBy: string | null;
  resolvedAt: string | null;

  // Links
  motorsProduct?: MotorsProduct;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCandidate {
  id: string;
  motorsProductId: string;
  catalogProductId: string | null;
  status: 'pending' | 'selected' | 'rejected' | 'merged';
  brand: string | null;
  mpn: string | null;
  oemPartNumber: string | null;
  productType: string | null;
  compositeScore: number;
  exactMpnScore: number;
  brandMatchScore: number;
  ocrMpnScore: number;
  visualFamilyScore: number;
  dimensionMatchScore: number;
  supplierDescSimilarityScore: number;
  fitmentConsistencyScore: number;
  source: string;
  sourceDetails: Record<string, unknown> | null;
}

export interface ExtractedAttribute {
  id: string;
  motorsProductId: string;
  extractionMethod: 'ocr' | 'vision' | 'regex' | 'supplier';
  rawOcrText: string | null;
  brand: string | null;
  mpn: string | null;
  oemPartNumber: string | null;
  upc: string | null;
  productType: string | null;
  productFamily: string | null;
  placement: string | null;
  confidenceScores: Record<string, number> | null;
  normalizedOutput: Record<string, unknown> | null;
  approvedOutput: Record<string, unknown> | null;
  aiCostUsd: number | null;
}

export interface ValidationResult {
  id: string;
  motorsProductId: string;
  isPublishable: boolean;
  errors: string[];
  warnings: string[];
  infos: string[];
  categoryRequirementsMet: boolean;
  requiredSpecificsPresent: boolean;
  requiredSpecificsMissing: string[];
  duplicateDetected: boolean;
  aspectCoverage: number;
  complianceScore: number;
}

/* ── Query Types ──────────────────────────────────────────── */

export interface MotorsProductQuery {
  status?: MotorsProductStatus;
  sourceType?: MotorsSourceType;
  brand?: string;
  productType?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ReviewTaskQuery {
  status?: ReviewTaskStatus;
  priority?: ReviewTaskPriority;
  reason?: ReviewReason;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

/* ── Result Types ─────────────────────────────────────────── */

export interface PipelineResult {
  motorsProductId: string;
  status: MotorsProductStatus;
  identityConfidence: number | null;
  fitmentConfidence: number | null;
  complianceConfidence: number | null;
  contentQualityScore: number | null;
  publishable: boolean;
  reviewRequired: boolean;
  reviewTaskId: string | null;
  errors: string[];
  warnings: string[];
}

export interface MotorsStats {
  byStatus: Record<MotorsProductStatus, number>;
  bySource: Record<MotorsSourceType, number>;
  avgConfidence: {
    identity: number;
    fitment: number;
    compliance: number;
    contentQuality: number;
  };
  publishedToday: number;
  reviewPending: number;
  total: number;
}

export interface ReviewStats {
  byStatus: Record<ReviewTaskStatus, number>;
  byPriority: Record<ReviewTaskPriority, number>;
  byReason: Record<ReviewReason, number>;
  avgResolutionTimeMinutes: number;
  totalPending: number;
}

/* ── Image Upload Types ───────────────────────────────────── */

export interface ImageUploadFile {
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface ImageUploadRequest {
  files: ImageUploadFile[];
  brand?: string;
  mpn?: string;
  productType?: string;
  condition?: string;
  price?: number;
  quantity?: number;
  autoRunPipeline?: boolean;
}

export interface ImageUploadResponse {
  motorsProductId: string;
  uploadUrls: { fileName: string; uploadUrl: string; key: string }[];
  status: string;
}

export interface ConfirmUploadRequest {
  uploadedKeys: string[];
  autoRunPipeline?: boolean;
}

export interface ConfirmUploadResponse {
  motorsProductId: string;
  imageUrls: string[];
  pipelineStarted: boolean;
  status: string;
}

/* ── Pipeline Progress Types ──────────────────────────────── */

export interface PipelineStage {
  stage: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PipelineProgress {
  motorsProductId: string;
  overallStatus: string;
  currentStage: string | null;
  stages: PipelineStage[];
  confidence: {
    identity: number | null;
    fitment: number | null;
    compliance: number | null;
    content: number | null;
  };
  completedAt?: string;
  done?: boolean;
}

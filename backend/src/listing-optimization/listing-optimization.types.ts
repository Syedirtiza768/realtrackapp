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

export type EbayValidationStatus = 'valid' | 'invalid' | 'unsupported' | 'needs_review';

export interface FitmentRow {
  year: string;
  make: string;
  model: string;
  trim?: string;
  engine?: string;
  drivetrain?: string;
  bodyType?: string;
  transmission?: string;
  position?: string;
  notes?: string;
  exclusions?: string;
  confidence: number;
  source: string;
  validationStatus: 'valid' | 'rejected' | 'needs_review';
  rejectedReason?: string;
}

export interface OptimizationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface ProductOptimizationSummary {
  productId: string;
  sku: string | null;
  optimizationStatus: OptimizationStatus;
  fitmentStatus: FitmentStatus;
  ebayValidationStatus: EbayValidationStatus | null;
  optimizedTitle: string | null;
  validationStatus: 'pass' | 'review' | 'block';
  uploadReadinessScore: number;
  seoScore: number;
  readinessScore: number;
  fitmentConfidence: number | null;
  fitmentRowCount: number;
  manualReview: boolean;
  errors: OptimizationIssue[];
  warnings: OptimizationIssue[];
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

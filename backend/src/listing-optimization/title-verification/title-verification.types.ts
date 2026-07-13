/**
 * Types for the title/part consistency verification pass — a batched,
 * text-only Gemini check that runs after listing optimization, comparing
 * a product's title text against its already-identified part fields.
 */

export interface TitleVerificationBatchItem {
  id: string;
  title: string;
  partType: string | null;
  mpn: string | null;
  oemPartNumber: string | null;
  brand: string | null;
  categoryName: string | null;
}

export interface TitleVerificationModelResult {
  id: string;
  match: boolean;
  confidence: number;
  issue: string | null;
}

export type TitleVerificationJobStatus = 'completed' | 'partial';

export interface TitleVerificationSummary {
  jobId: string;
  status: TitleVerificationJobStatus;
  totalProducts: number;
  processedProducts: number;
  flaggedCount: number;
  unprocessedProductIds: string[];
  estimatedCostUsd: number;
}

export interface TitleVerificationWarning {
  code: 'TITLE_PART_MISMATCH';
  severity: 'warning';
  message: string;
  field: 'title';
  confidence: number;
  source: 'title-verification';
  detectedAt: string;
}

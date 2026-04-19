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
  stageDetails: Record<string, unknown> | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

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

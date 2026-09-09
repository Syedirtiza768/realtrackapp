/* ── Types for the CSV Catalog Import system ─────────────── */

export type CatalogImportStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type ImportRowStatus =
  | 'inserted'
  | 'duplicate_skipped'
  | 'duplicate_flagged'
  | 'updated'
  | 'invalid'
  | 'error';

export interface CatalogImport {
  id: string;
  fileName: string;
  filePath: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  detectedHeaders: string[];
  columnMapping: Record<string, string> | null;
  status: CatalogImportStatus;
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedDuplicates: number;
  flaggedForReview: number;
  invalidRows: number;
  errorMessage: string | null;
  warnings: string[] | null;
  lastProcessedRow: number;
  createdBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  verification?: ImportVerificationSummary | null;
}

export interface ImportVerificationSummary {
  importId: string;
  expectedInsertedRows: number;
  catalogProductsByImport: number;
  listingRecordsByImport: number;
  sampleSkus: string[];
  db: {
    database: string;
    schema: string;
  } | null;
}

export interface CatalogImportRow {
  id: string;
  importId: string;
  rowNumber: number;
  status: ImportRowStatus;
  matchStrategy: string | null;
  matchedProductId: string | null;
  createdProductId: string | null;
  message: string | null;
  rawData: Record<string, string> | null;
  createdAt: string;
}

export interface CatalogField {
  field: string;
  label: string;
  required: boolean;
}

export interface UploadResponse {
  import: CatalogImport;
  detectedHeaders: string[];
  columnMapping: Record<string, string>;
  catalogFields: CatalogField[];
}

export interface ImportListResponse {
  imports: CatalogImport[];
  total: number;
}

export interface ImportRowListResponse {
  rows: CatalogImportRow[];
  total: number;
}

export interface ImportStats {
  totalImports: number;
  totalProductsInserted: number;
  totalDuplicatesSkipped: number;
  totalInvalidRows: number;
  totalCatalogProducts: number;
  recentImports: CatalogImport[];
}

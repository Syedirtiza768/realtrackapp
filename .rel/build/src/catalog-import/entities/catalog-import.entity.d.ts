import type { ProductVertical } from '../../verticals/vertical.types.js';
export type CatalogImportStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
export declare class CatalogImport {
    id: string;
    fileName: string;
    filePath: string | null;
    fileSizeBytes: number | null;
    mimeType: string | null;
    detectedHeaders: string[];
    columnMapping: Record<string, string> | null;
    organizationId: string | null;
    vertical: ProductVertical | null;
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
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

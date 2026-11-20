import type { EbayCompatibilityPayload } from '../channels/ebay/ebay-api.types.js';
export interface ParsedFitmentRow {
    year: string;
    make: string;
    model: string;
    trim?: string;
    engine?: string;
    submodel?: string;
    notes?: string;
}
export declare function getFitmentValidationStatus(raw: Record<string, unknown>): string;
export declare function isUnpublishableFitmentRow(raw: Record<string, unknown>): boolean;
export declare function selectPublishFitmentSource(fitmentData: Record<string, unknown>[] | null | undefined, fitmentRows: Record<string, unknown>[] | null | undefined, options?: {
    requireValidated?: boolean;
}): Record<string, unknown>[] | undefined;
export declare function pickCanonicalPropertyValue(options: Array<{
    value: string;
}>, query: string): string | undefined;
export declare function parseFitmentEntry(raw: Record<string, unknown>): ParsedFitmentRow | null;
export declare function isSameMakeVariant(rawBrand: string, fitmentMake: string): boolean;
export declare function fitmentDataToCompatibilityPayload(fitmentData: Record<string, unknown>[] | null | undefined, options?: {
    excludeRejected?: boolean;
    excludeNeedsReview?: boolean;
}): EbayCompatibilityPayload | undefined;
export declare function compatibilityHasOptionalFields(payload?: EbayCompatibilityPayload | null): boolean;
export declare function toCoreCompatibilityPayload(payload?: EbayCompatibilityPayload | null): EbayCompatibilityPayload | undefined;
export declare function serializeValidatedFitmentRow(row: ParsedFitmentRow, mvlStatus: 'valid' | 'needs_review' | 'rejected', extra?: Record<string, unknown>): Record<string, unknown>;

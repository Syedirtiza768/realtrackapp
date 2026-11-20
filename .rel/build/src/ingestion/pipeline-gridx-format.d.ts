import type { WorkSheet } from 'xlsx';
export declare const PIPELINE_GRIDX_REQUIRED_HEADERS: readonly ["Part Number", "Price", "Quantity", "Vehicle Make", "Description", "Image URLs", "SKU"];
export type PipelineGridxValidationResult = {
    ok: true;
    headers: string[];
} | {
    ok: false;
    missing: string[];
    headers: string[];
    message: string;
};
export declare function validatePipelineGridxHeaders(rows: unknown[][]): PipelineGridxValidationResult;
export declare function sheetToVisibleAoa(ws: WorkSheet): unknown[][];
export declare function countHiddenDataRows(ws: WorkSheet): number;
export declare function parsePipelineUploadRows(fileBuffer: Buffer): unknown[][];
export declare function countHiddenDataRowsInUpload(fileBuffer: Buffer): number;

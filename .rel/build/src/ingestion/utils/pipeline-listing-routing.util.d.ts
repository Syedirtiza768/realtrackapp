export interface PipelineListingRouteResult<T> {
    rowsToUpdate: Array<{
        id: string;
        lr: T;
    }>;
    rowsToInsert: T[];
    droppedDuplicates: number;
}
export declare function routePipelineListingRecords<T extends {
    customLabelSku?: string | null;
}>(listingRecords: T[], activeIdBySku: Map<string, string>): PipelineListingRouteResult<T>;
export declare function buildActiveIdBySku(rows: Array<{
    id: string;
    customLabelSku: string | null;
}>): Map<string, string>;

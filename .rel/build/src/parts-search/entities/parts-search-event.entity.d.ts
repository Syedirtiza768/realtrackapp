export type PartsSearchEventType = 'query' | 'select' | 'request';
export type PartsSearchRequestStatus = 'open' | 'done' | 'dismissed';
export declare class PartsSearchEvent {
    id: string;
    createdAt: Date;
    type: PartsSearchEventType;
    userId: string | null;
    userEmail: string | null;
    query: string;
    numbers: string[];
    vehicle: Record<string, unknown> | null;
    resultCount: number;
    inStockCount: number;
    fitsCount: number;
    demand: boolean;
    partId: string | null;
    requestRef: string | null;
    note: string | null;
    status: PartsSearchRequestStatus | null;
    updatedBy: string | null;
    updatedAt: Date | null;
}

export declare class ListingRevision {
    id: string;
    listingId: string;
    version: number;
    statusBefore: string | null;
    statusAfter: string;
    snapshot: Record<string, unknown>;
    changeReason: string | null;
    changedBy: string | null;
    createdAt: Date;
}

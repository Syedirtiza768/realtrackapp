export type PrimemotiveListingChangeType = 'listing.added' | 'listing.updated' | 'listing.removed';
export declare class EbayPublishedListingChange {
    id: string;
    sequence: string | null;
    organizationId: string;
    storeId: string;
    listingId: string;
    eventType: PrimemotiveListingChangeType;
    listingSnapshot: Record<string, unknown>;
    occurredAt: Date;
    deliveryAttempts: number;
    nextAttemptAt: Date;
    deliveredAt: Date | null;
    lastDeliveryError: string | null;
    createdAt: Date;
}

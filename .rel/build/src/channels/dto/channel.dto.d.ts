export declare class ConnectChannelDto {
    channel: string;
    shopDomain?: string;
}
export declare class OAuthCallbackDto {
    code: string;
    state: string;
}
export declare class PublishListingDto {
    connectionId: string;
    listingId: string;
}
export declare class PublishMultiDto {
    listingId: string;
    channels: string[];
    overrides?: Record<string, {
        price?: number;
        title?: string;
        quantity?: number;
    }>;
    storeId?: string;
}
export declare class BulkPublishDto {
    listingIds: string[];
    channels: string[];
    storeId?: string;
}
export declare class SyncInventoryDto {
    connectionId: string;
}
export declare class WebhookPayloadDto {
    payload?: Record<string, unknown>;
}

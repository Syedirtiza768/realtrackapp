export type UUID = string;

export type Marketplace = 'ebay' | 'shopify' | 'amazon' | 'walmart' | 'custom';

export type ProductCondition =
    | 'new'
    | 'new_open_box'
    | 'remanufactured'
    | 'used'
    | 'for_parts';

export type IngestionMode = 'single' | 'bulk' | 'bundle';

export interface ProductImage {
    id: UUID;
    productId?: UUID;
    bundleId?: UUID;
    uri: string;
    source: 'camera' | 'upload';
    angle?: string;
    capturedAt: string;
}

export interface FitmentRecord {
    make: string;
    model: string;
    yearFrom: number;
    yearTo: number;
    engineVariant?: string;
    trimLevel?: string;
    source: 'manual' | 'ai' | 'catalog';
    confidence: number;
    ebayMotorsReady: boolean;
}

export interface ProductVariantRef {
    variantSku: string;
    relation: 'size' | 'color' | 'finish' | 'configuration';
}

export interface ProductCrossReference {
    type: 'oem' | 'aftermarket' | 'internal';
    value: string;
    brand?: string;
}

export interface ProductCatalogItem {
    id: UUID;
    sku: string;
    internalSku: string;
    title: string;
    seoTitle: string;
    description: string;
    technicalSpecifications: Record<string, string | number | boolean>;
    suggestedCategory: string;
    itemSpecifics: Record<string, string | number | boolean>;
    brand?: string;
    categoryPath: string[];
    condition: ProductCondition;
    images: ProductImage[];
    fitment: FitmentRecord[];
    variantRefs: ProductVariantRef[];
    bundledSkus: string[];
    crossReferences: ProductCrossReference[];
    updatedAt: string;
}

export interface ListingState {
    productId: UUID;
    marketplace: Marketplace;
    externalListingId?: string;
    title: string;
    description: string;
    images: ProductImage[];
    price: number;
    quantity: number;
    channelCategory?: string;
    itemSpecifics: Record<string, string | number | boolean>;
    status: 'draft' | 'active' | 'paused' | 'ended';
    lastSyncedAt?: string;
}

export interface InventorySnapshot {
    productId: UUID;
    onHand: number;
    reserved: number;
    available: number;
    marketplaces: Partial<Record<Marketplace, number>>;
    updatedAt: string;
}

export interface AuditLogEntry {
    id: UUID;
    entityType: 'product' | 'listing' | 'inventory' | 'fitment';
    entityId: UUID;
    actorId: string;
    action: 'create' | 'update' | 'delete' | 'sync' | 'publish';
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    createdAt: string;
}

export interface ImageRecognitionResult {
    partName: string;
    category: string;
    brand?: string;
    condition?: ProductCondition;
    confidence: number;
    tags: string[];
}

export interface AiGeneratedProductData {
    seoTitle: string;
    technicalSpecifications: Record<string, string | number | boolean>;
    description: string;
    suggestedCategory: string;
    itemSpecifics: Record<string, string | number | boolean>;
}

export interface IngestionListingSeed {
    recognition: ImageRecognitionResult;
    generatedData: AiGeneratedProductData;
    images: ProductImage[];
}

export interface IngestionJob {
    id: UUID;
    mode: IngestionMode;
    imageIds: UUID[];
    status: 'queued' | 'processing' | 'needs_review' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
}

export interface SearchQuery {
    text?: string;
    attributes?: Record<string, string[]>;
    fitment?: {
        make: string;
        model: string;
        year?: number;
        engineVariant?: string;
        trimLevel?: string;
    };
    page: number;
    pageSize: number;
}

export interface SearchResult<T> {
    total: number;
    page: number;
    pageSize: number;
    results: T[];
}

export interface ChannelAdapter {
    marketplace: Marketplace;
    publishListing(payload: ListingState): Promise<{ externalListingId: string }>;
    updateListing(payload: ListingState): Promise<void>;
    endListing(externalListingId: string): Promise<void>;
    syncInventory(externalListingId: string, quantity: number): Promise<void>;
}

export interface InventorySyncEvent {
    eventId: UUID;
    type: 'sale' | 'cancel' | 'restock' | 'manual_adjustment';
    productId: UUID;
    quantityDelta: number;
    marketplace?: Marketplace;
    occurredAt: string;
}

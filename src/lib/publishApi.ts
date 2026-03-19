/**
 * publishApi — Typed frontend client for eBay multi-store publishing.
 */

import { authPost, authDelete, fetchWithAuth } from './authApi';

const BASE = '/api/channels/ebay';

/* ── Types ── */

export interface PublishRequest {
  listingId: string;
  storeIds: string[];
  sku: string;
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  conditionDescription?: string;
  price: number;
  currency?: string;
  quantity: number;
  imageUrls: string[];
  aspects: Record<string, string[]>;
  compatibility?: unknown;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  listingDuration?: string;
}

export interface PublishResult {
  storeId: string;
  storeName: string;
  success: boolean;
  offerId?: string;
  listingId?: string;
  error?: string;
}

export interface BatchPublishResult {
  listingId: string;
  results: PublishResult[];
}

/* ── Endpoints ── */

/**
 * Publish a listing to one or more eBay stores.
 */
export function publishToEbay(req: PublishRequest): Promise<PublishResult[]> {
  return authPost(`${BASE}/publish`, req);
}

/**
 * Batch publish multiple listings.
 */
export function batchPublishToEbay(items: PublishRequest[]): Promise<BatchPublishResult[]> {
  return authPost(`${BASE}/publish-batch`, { items });
}

/**
 * Update price and quantity for existing eBay offers.
 */
export function updateOfferPriceQuantity(
  storeId: string,
  offers: Array<{ offerId: string; price: number; quantity: number; currency?: string }>,
): Promise<unknown> {
  return fetchWithAuth(`${BASE}/offers/price-quantity`, {
    method: 'PATCH',
    body: JSON.stringify({ storeId, offers }),
  });
}

/**
 * End/withdraw an eBay listing.
 */
export function endEbayListing(offerId: string, storeId: string): Promise<void> {
  return authDelete(`${BASE}/offers/${offerId}?storeId=${encodeURIComponent(storeId)}`);
}

/* ── Listing Generation ── */

const LISTING_BASE = '/api/listings';

export interface GenerateListingRequest {
  masterProductId: string;
  templateId?: string;
  storeId?: string;
  categoryName?: string;
}

export interface ListingGenerationResult {
  title: string;
  subtitle: string | null;
  description: string;
  itemSpecifics: Record<string, string>;
  bulletPoints: string[];
  searchTerms: string[];
  pricePositioning: {
    suggestedPrice: number | null;
    rationale: string | null;
  };
}

export interface GeneratedListingResponse {
  generation: ListingGenerationResult;
  product: { id: string; sku: string; title: string };
  appliedOverrides: {
    price: number;
    title: string;
    storeId?: string;
  } | null;
}

export interface GenerateAndPublishRequest extends GenerateListingRequest {
  storeIds: string[];
  publishImmediately?: boolean;
}

/**
 * Generate AI-optimized listing content for a master product.
 */
export function generateListing(req: GenerateListingRequest): Promise<GeneratedListingResponse> {
  return authPost(`${LISTING_BASE}/generate`, req);
}

/**
 * Batch generate listings for multiple products.
 */
export function generateListingBatch(
  items: GenerateListingRequest[],
): Promise<GeneratedListingResponse[]> {
  return authPost(`${LISTING_BASE}/generate-batch`, { items });
}

/**
 * Generate listing, create draft offers, and optionally publish.
 */
export function generateAndPublish(
  req: GenerateAndPublishRequest,
): Promise<{ generation: ListingGenerationResult; offers: unknown[]; publishResults?: PublishResult[] }> {
  return authPost(`${LISTING_BASE}/generate-publish`, req);
}

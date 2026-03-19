/**
 * listingGenerationApi — Typed frontend client for AI listing generation.
 *
 * Endpoints:
 *  POST /listings/generate         — Single product
 *  POST /listings/generate-batch   — Multiple products
 *  POST /listings/generate-publish — Generate + draft/publish to stores
 */

import { authPost } from './authApi';

const BASE = '/api/listings';

/* ── Types ── */

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

export interface GenerateListingInput {
  masterProductId: string;
  templateId?: string;
  storeId?: string;
  categoryName?: string;
}

export interface GenerateAndPublishInput extends GenerateListingInput {
  storeIds: string[];
  publishImmediately?: boolean;
}

export interface GeneratedListingWithMeta {
  generation: ListingGenerationResult;
  product: {
    id: string;
    sku: string;
    title: string;
    brand: string | null;
  };
  appliedOverrides: {
    price: number;
    title: string;
    storeId?: string;
  } | null;
}

export interface GenerateAndPublishResult {
  generation: ListingGenerationResult;
  offers: Array<{
    storeId: string;
    offerId: string;
    status: string;
  }>;
  publishResults?: Array<{
    storeId: string;
    success: boolean;
    listingId?: string;
    error?: string;
  }>;
}

/* ── Endpoints ── */

/**
 * Generate AI-optimized listing content for a single master product.
 */
export function generateListing(
  input: GenerateListingInput,
): Promise<GeneratedListingWithMeta> {
  return authPost(`${BASE}/generate`, input);
}

/**
 * Batch generate listings for multiple products.
 */
export function generateListingBatch(
  items: GenerateListingInput[],
): Promise<GeneratedListingWithMeta[]> {
  return authPost(`${BASE}/generate-batch`, { items });
}

/**
 * Generate listing, create draft offers, and optionally publish to eBay.
 */
export function generateAndPublish(
  input: GenerateAndPublishInput,
): Promise<GenerateAndPublishResult> {
  return authPost(`${BASE}/generate-publish`, input);
}

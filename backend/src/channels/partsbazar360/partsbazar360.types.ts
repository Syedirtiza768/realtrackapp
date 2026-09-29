/**
 * PartsBazar360 channel — wire types.
 *
 * RealTrack publishes listings into partsbazar360.com by POSTing to its
 * `/integrations/realtrack/listings` endpoint. The receiver feeds each listing
 * through the same ingestion pipeline it uses when it pulls our published
 * listings, so `PartsBazarListingPayload` deliberately mirrors the
 * published-listings shape (`docs/integrations/partsbazar360-publish.md`).
 */

export const PARTSBAZAR360_CHANNEL = 'partsbazar360';

/** Provenance hints the receiver applies to the catalog rows it creates. */
export interface PartsBazarProvenanceHints {
  qualityTier?: 'NEW' | 'USED' | 'REFURBISHED' | 'REMANUFACTURED' | 'FOR_PARTS';
  partSource?: 'OEM' | 'AFTERMARKET';
  partType?: string;
}

export interface PartsBazarCompatibility {
  compatibleProducts: Array<{
    compatibilityProperties: Array<{ name: string; value: string }>;
    notes?: string;
  }>;
}

export interface PartsBazarListingPayload {
  title: string;
  sku: string | null;
  /** Seller base price in USD. PartsBazar360 applies its own marketplace pricing. */
  price: string;
  currency: string;
  quantityAvailable: number;
  listingStatus: 'active' | 'ended';
  marketplaceId: string;
  condition: string;
  categoryName: string | null;
  brand: string | null;
  mpn: string | null;
  oeNumbers: string[];
  description: string | null;
  imageUrls: string[];
  itemSpecifics: Record<string, string | string[]>;
  compatibility: PartsBazarCompatibility | null;
  ebayItemId: string | null;
  listingUrl: string | null;
}

export interface PartsBazarPushItem {
  /** RealTrack `listing_records.id` — the receiver's idempotency key. */
  sourceListingId: string;
  listing: PartsBazarListingPayload;
  hints: PartsBazarProvenanceHints;
}

export interface PartsBazarPushItemResult {
  sourceListingId: string;
  status: 'queued' | 'rejected';
  reason?: string;
}

export type PartsBazarRemoteStatus =
  | 'queued'
  | 'imported'
  | 'rejected'
  | 'failed'
  | 'ended'
  | 'unknown';

export interface PartsBazarStatusResponse {
  sourceListingId: string;
  status: PartsBazarRemoteStatus;
  outcome: string | null;
  error: string | null;
  updatedAt: string | null;
  offer: {
    id: string;
    status: string;
    price: number;
    currency: string;
  } | null;
  part: { id: string; slug: string | null; url: string | null } | null;
}

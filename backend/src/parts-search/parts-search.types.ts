/**
 * Response shapes for the Parts Search portal.
 *
 * Results come from PartsBazar360 (`/api/v1/search` for the public audience,
 * `/api/integrations/realtrack/search` for the internal one). Only the fields
 * the portal relies on are typed; everything else passes through unchanged.
 */

export type PartsSearchAudience = 'internal' | 'public';

export interface PartsSearchFacetBucket {
  value: string;
  count: number;
}

export interface PartsSearchWarehouseStock {
  warehouseId: string;
  name: string;
  location: string | null;
  quantity: number;
  status: string;
}

/** One PartsBazar360 offer, any status. Internal audience only. */
export interface PartsSearchInternalOffer {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerStoreId: string | null;
  sellerStatus: string;
  status: string;
  price: number;
  sellerBasePrice: number | null;
  currency: string;
  condition: string;
  partSource: string;
  qualityTier: string;
  sourceTag: string | null;
  sourceKey: string | null;
  sellerSku: string | null;
  sellerTitle: string | null;
  externalOfferId: string | null;
  leadTimeDays: number | null;
  quantity: number;
  warehouses: PartsSearchWarehouseStock[];
  buyerVisible: boolean;
  outrankedBySuperior: boolean;
  updatedAt: string;
}

export interface PartsSearchResultItem {
  id: string;
  title?: string;
  brand?: string | null;
  brandDisplay?: string | null;
  category?: string | null;
  partType?: string | null;
  manufacturerPartNumber?: string | null;
  displayNumbers?: string[];
  oemNumbers?: string[];
  conditions?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  currencies?: string[];
  offerCount?: number;
  inStock?: boolean;
  imageUrls?: string[];
  makes?: string[];
  models?: string[];
  years?: number[];
  fitmentStatus?: string | null;
  sellerNames?: string[];
  sourceTags?: string[];
  matchedVia?: string[];
  matchedViaInterchange?: boolean;
  internalOffers?: PartsSearchInternalOffer[];
  internalOfferCount?: number;
  [key: string]: unknown;
}

export interface PartsSearchResponse {
  query: { original: string; normalized: string; interpreted: Record<string, unknown> };
  results: PartsSearchResultItem[];
  facets: Record<string, PartsSearchFacetBucket[]>;
  appliedFilters: Record<string, unknown>;
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalRelation: 'eq' | 'gte';
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  corrections: Array<{ type: string; message: string; suggestion?: string }>;
  meta: {
    tookMs: number;
    index: string;
    degraded: boolean;
    /** Which PartsBazar360 endpoint actually answered. */
    audience: PartsSearchAudience;
    /** Set when internal search is configured but failed and public search answered instead. */
    internalUnavailableReason?: string;
    cached?: boolean;
  };
  requestId: string;
}

export interface PartsSearchSuggestResponse {
  parts: Array<{
    id: string;
    title: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    minPrice: number | null;
    currency: string | null;
    manufacturerPartNumber: string | null;
  }>;
  categories: string[];
  categoryGroups: string[];
  brands: string[];
  makes: string[];
}

export interface PartsSearchStatus {
  apiUrl: string;
  internalConfigured: boolean;
  audience: PartsSearchAudience;
  upstream: { ok: boolean; index?: string; degraded?: boolean; message?: string };
  internal: { ok: boolean; message?: string } | null;
}

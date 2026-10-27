/**
 * partsSearchApi.ts — typed client for the Parts Search portal (/api/parts-search).
 *
 * The backend proxies PartsBazar360 universal search. With an internal key it
 * returns every offer (seller, store, source, stock); without one it returns
 * the public buyer view. `meta.audience` says which one answered.
 */
import { fetchWithAuth } from './authApi';
import { toProxyUrl } from './imageUrl';

const base = '/api/parts-search';

export const PARTS_SEARCH_SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
  { value: 'best_condition', label: 'Best condition' },
] as const;
export const PARTS_SEARCH_PAGE_SIZES = [24, 48, 72] as const;

/** Multi-value filters, in the order the facet sidebar shows them. */
export const PARTS_SEARCH_LIST_FILTERS = [
  'make',
  'model',
  'category',
  'brand',
  'partType',
  'condition',
  'seller',
  'sourceTag',
] as const;
export type PartsSearchListFilter = (typeof PARTS_SEARCH_LIST_FILTERS)[number];

export type PartsSearchAudience = 'internal' | 'public';

export interface PartsSearchParams {
  q?: string;
  make?: string[];
  model?: string[];
  category?: string[];
  brand?: string[];
  partType?: string[];
  condition?: string[];
  seller?: string[];
  sourceTag?: string[];
  year?: number;
  priceMin?: number;
  priceMax?: number;
  hasImage?: boolean;
  inStock?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface WarehouseStock {
  warehouseId: string;
  name: string;
  location: string | null;
  quantity: number;
  status: string;
}

export interface InternalOffer {
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
  warehouses: WarehouseStock[];
  buyerVisible: boolean;
  outrankedBySuperior: boolean;
  updatedAt: string;
}

export interface PartsSearchResult {
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
  internalOffers?: InternalOffer[];
  internalOfferCount?: number;
}

export interface PartsSearchResponse {
  query: { original: string; normalized: string; interpreted: Record<string, unknown> };
  results: PartsSearchResult[];
  facets: Record<string, FacetBucket[]>;
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
    audience: PartsSearchAudience;
    internalUnavailableReason?: string;
    cached?: boolean;
  };
  requestId: string;
}

export interface SuggestPart {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  minPrice: number | null;
  currency: string | null;
  manufacturerPartNumber: string | null;
}

export interface PartsSuggestResponse {
  parts: SuggestPart[];
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

export type PartNumberRole = 'MPN' | 'BRAND_MPN' | 'OEM' | 'SUPERSEDED' | 'INTERCHANGE' | 'OEM_CROSS_REFERENCE' | 'OE';

export interface PartCrossReference {
  number: string;
  normalized: string;
  role: PartNumberRole;
  source: string;
  verified: boolean;
}

export interface PartFitment {
  make: string;
  model: string;
  generation: string | null;
  startYear: number | null;
  endYear: number | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  market: string | null;
  /** A (catalogue/VIN) … F (title parse). */
  evidenceLevel: string;
  confidence: number;
  verificationStatus: string;
  source: string | null;
  notes: string | null;
}

/** Part detail: internal view (internalOffers + sourceRecords) or the public PDP payload. */
export interface PartDetail {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  manufacturerPartNumber?: string | null;
  genuineOemPartNumber?: string | null;
  oeNumbers?: string[];
  category?: string | null;
  categoryGroup?: string | null;
  partType?: string | null;
  partSource?: string | null;
  qualityTier?: string | null;
  position?: string | null;
  vehicleSystem?: string | null;
  fitmentStatus?: string | null;
  compatibility?: unknown;
  imageUrls?: string[];
  listingUrl?: string | null;
  ebayItemId?: string | null;
  publicUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  audience: PartsSearchAudience;
  internalUnavailableReason?: string;
  internalOffers?: InternalOffer[];
  internalOfferCount?: number;
  /** Internal: every number on the part with its role (MPN, superseded, interchange, OE…). */
  crossReferences?: PartCrossReference[];
  /** Internal: structured fitment rows, strongest evidence first (≤ 1000). */
  fitments?: PartFitment[];
  fitmentCount?: number;
  /** Internal: listing aspects as stored (eBay item specifics etc.). */
  itemSpecifics?: Record<string, unknown> | null;
  genuineOem?: boolean;
  sourceRecords?: Array<{
    id: string;
    sellerOfferId: string | null;
    sourceType: string;
    sourcePlatform: string | null;
    externalId: string | null;
    sourceFileName: string | null;
    sourceSheet: string | null;
    sourceRowNumber: number | null;
    matchConfidence: number | null;
    importedAt: string;
    lastSyncedAt: string | null;
  }>;
  /** Public PDP offers (buyer view only). */
  offers?: Array<{
    id: string;
    price: number;
    currency: string;
    condition: string;
    status?: string;
    sellerName?: string;
    seller?: { name?: string | null } | null;
  }>;
}

/* ── URL <-> params ───────────────────────────────────────────────── */

function num(value: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Read portal search state from the results-page URL. */
export function paramsFromUrl(search: URLSearchParams): PartsSearchParams {
  const params: PartsSearchParams = {};
  const q = search.get('q')?.trim();
  if (q) params.q = q;
  for (const key of PARTS_SEARCH_LIST_FILTERS) {
    const values = search.getAll(key).filter(Boolean);
    if (values.length) params[key] = values;
  }
  params.year = num(search.get('year'));
  params.priceMin = num(search.get('priceMin'));
  params.priceMax = num(search.get('priceMax'));
  if (search.get('hasImage') === 'true') params.hasImage = true;
  if (search.get('inStock') === 'true') params.inStock = true;
  const sort = search.get('sort');
  if (sort && PARTS_SEARCH_SORTS.some((option) => option.value === sort)) params.sort = sort;
  params.page = num(search.get('page'));
  const pageSize = num(search.get('pageSize'));
  if (pageSize && (PARTS_SEARCH_PAGE_SIZES as readonly number[]).includes(pageSize)) params.pageSize = pageSize;
  return params;
}

/** Serialize params as repeated keys (keeps values that contain commas intact). */
export function paramsToQuery(params: PartsSearchParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  for (const key of PARTS_SEARCH_LIST_FILTERS) {
    for (const value of params[key] ?? []) query.append(key, value);
  }
  const scalars: Array<keyof PartsSearchParams> = ['year', 'priceMin', 'priceMax', 'hasImage', 'inStock', 'sort', 'page', 'pageSize'];
  for (const key of scalars) {
    const value = params[key];
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (key === 'page' && value === 1) continue;
    if (key === 'sort' && value === 'relevance') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export function resultsPath(params: PartsSearchParams): string {
  const query = paramsToQuery(params);
  return `/parts-search/results${query ? `?${query}` : ''}`;
}

/* ── Calls ────────────────────────────────────────────────────────── */

export function searchParts(params: PartsSearchParams, signal?: AbortSignal) {
  const query = paramsToQuery(params);
  return fetchWithAuth<PartsSearchResponse>(`${base}/query${query ? `?${query}` : ''}`, { signal });
}

export function suggestParts(q: string, signal?: AbortSignal) {
  return fetchWithAuth<PartsSuggestResponse>(`${base}/suggest?q=${encodeURIComponent(q)}`, { signal });
}

export function getPartDetail(id: string, signal?: AbortSignal) {
  return fetchWithAuth<PartDetail>(`${base}/parts/${encodeURIComponent(id)}`, { signal });
}

export function getPartsSearchStatus(signal?: AbortSignal) {
  return fetchWithAuth<PartsSearchStatus>(`${base}/status`, { signal });
}

/* ── Formatting ───────────────────────────────────────────────────── */

const PARTSBAZAR360_ORIGIN = 'https://partsbazar360.com';

/**
 * Browser-safe image URL for a PartsBazar360 part. Many parts reuse Omni Core's
 * own (private) S3 catalogue images, so absolute URLs go through `toProxyUrl`,
 * which routes our bucket via /api/storage/serve and leaves eBay etc. as-is.
 * Site-relative paths belong to partsbazar360.com.
 */
export function partImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('//')) return toProxyUrl(`https:${url}`);
  if (/^https?:\/\//i.test(url)) return toProxyUrl(url);
  if (url.startsWith('/')) return `${PARTSBAZAR360_ORIGIN}${url}`;
  return null;
}

/** Public buyer page for a part on partsbazar360.com. */
export function partPublicUrl(part: { id: string; slug?: string | null; publicUrl?: string | null }): string {
  if (part.publicUrl) return part.publicUrl;
  return part.slug ? `${PARTSBAZAR360_ORIGIN}/parts/${part.slug}` : `${PARTSBAZAR360_ORIGIN}/part/${part.id}`;
}

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency ?? ''} ${value.toFixed(2)}`.trim();
  }
}

export function formatTotal(response: Pick<PartsSearchResponse, 'pagination'>): string {
  const { totalResults, totalRelation } = response.pagination;
  const formatted = totalResults.toLocaleString();
  return totalRelation === 'gte' ? `${formatted}+` : formatted;
}

const MATCH_LABELS: Record<string, string> = {
  oem: 'OEM number',
  sku: 'Seller SKU',
  normalized: 'Part number',
  interchange: 'Interchange number',
  superseded: 'Superseded number',
  prefix: 'Partial part number',
};

/** Human label for why a result matched (first number-type reason wins). */
export function matchReason(result: PartsSearchResult): string | null {
  const matched = result.matchedVia ?? [];
  for (const key of ['oem', 'normalized', 'sku', 'interchange', 'superseded', 'prefix']) {
    if (matched.includes(key)) return MATCH_LABELS[key];
  }
  return null;
}

/* ── Recent searches (per browser; convenience only) ──────────────── */

const RECENT_KEY = 'mk_parts_search_recent';

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string): void {
  const query = q.trim();
  if (!query) return;
  try {
    const next = [query, ...readRecentSearches().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

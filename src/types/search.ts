/* --- Search Types -----------------------------------------------------
 *  Types for the advanced search API.
 *  Separate from the legacy listings.ts types.
 * -------------------------------------------------------------------- */

/* -- Search Query ---------------------------------------------------- */

export interface SearchQuery {
  limit?: number;
  offset?: number;
  cursor?: string;
  q?: string;
  exactSku?: string;
  brands?: string;        // comma-separated
  categories?: string;    // comma-separated category IDs
  categoryNames?: string;
  conditions?: string;    // comma-separated
  types?: string;
  sourceFiles?: string;
  formats?: string;
  locations?: string;
  mpns?: string;
  makes?: string;         // comma-separated fitment make IDs
  models?: string;        // comma-separated fitment model IDs
  pipelineJobIds?: string; // comma-separated pipeline job UUIDs
  teamIds?: string;        // comma-separated team UUIDs
  marketplaces?: string;  // comma-separated marketplace codes
  minPrice?: number;
  maxPrice?: number;
  hasImage?: string;
  hasPrice?: string;
  catalogStatus?: string;
  stockLevel?: string;
  shippingProfiles?: string;
  importedFrom?: string;
  importedTo?: string;
  filterMode?: 'and' | 'or';
  sort?: SortMode;
}

export type CatalogListingStatus = 'published' | 'ready_to_publish' | 'need_images';

export type StockLevelFilter = 'in_stock' | 'out_of_stock' | 'low_stock';

export type DateAddedPreset = 'all' | 'last_7' | 'last_30' | 'last_90' | 'custom';

export type SortMode =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'title_asc'
  | 'title_desc'
  | 'sku_asc';

/* -- Search Response ------------------------------------------------- */

export interface SearchResponse {
  total: number;
  limit: number;
  offset: number;
  nextCursor: string | null;
  queryTimeMs: number;
  items: SearchItem[];
}

export interface SearchItem {
  id: string;
  customLabelSku: string | null;
  title: string | null;
  cBrand: string | null;
  cType: string | null;
  categoryId: string | null;
  categoryName: string | null;
  startPrice: string | null;
  quantity: string | null;
  conditionId: string | null;
  itemPhotoUrl: string | null;
  cManufacturerPartNumber: string | null;
  cOeOemPartNumber: string | null;
  location: string | null;
  format: string | null;
  sourceFileName: string | null;
  importedAt: string;
  description: string | null;
  cFeatures: string | null;
  pEpid: string | null;
  pUpc: string | null;
  relevanceScore: number | null;
  titleHighlight: string | null;
  fitmentCount: number | null;
  /** Marketplace this listing targets (US/AU/DE/GB etc) */
  marketplace?: string | null;
  pipelineJobId?: string | null;
  /** Aggregated marketplaces across all SKU siblings (populated by catalog dedup) */
  marketplaces?: string[];
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  catalogStatus?: CatalogListingStatus;
  shippingProfileName?: string | null;
}

/* -- Suggestions ----------------------------------------------------- */

export interface SuggestResponse {
  suggestions: Suggestion[];
  queryTimeMs: number;
}

export interface Suggestion {
  type: 'sku' | 'title' | 'brand' | 'category' | 'mpn';
  value: string;
  label: string;
  count?: number;
  score: number;
}

/* -- Dynamic Facets -------------------------------------------------- */

export interface DynamicFacets {
  brands: FacetBucket[];
  categories: CategoryFacetBucket[];
  conditions: FacetBucket[];
  types: FacetBucket[];
  sourceFiles: FacetBucket[];
  formats: FacetBucket[];
  locations: FacetBucket[];
  mpns: FacetBucket[];
  makes: FacetBucket[];
  models: FacetBucket[];
  pipelineJobs: FacetBucket[];
  marketplaces: FacetBucket[];
  teams: TeamFacetBucket[];
  shippingProfiles: FacetBucket[];
  priceRange: { min: number | null; max: number | null };
  totalFiltered: number;
  queryTimeMs: number;
}

export interface TeamFacetBucket extends FacetBucket {
  label: string;
  color?: string;
}

export interface FacetBucket {
  value: string;
  count: number;
  label?: string;  // display label (e.g. make/model name when value is an ID)
}

export interface CategoryFacetBucket extends FacetBucket {
  id: string;
}

/* -- Full Detail (from /listings/:id) -------------------------------- */

export interface ListingDetail {
  id: string;
  customLabelSku: string | null;
  title: string | null;
  cBrand: string | null;
  cType: string | null;
  categoryId: string | null;
  categoryName: string | null;
  startPrice: string | null;
  quantity: string | null;
  conditionId: string | null;
  itemPhotoUrl: string | null;
  cManufacturerPartNumber: string | null;
  cOeOemPartNumber: string | null;
  location: string | null;
  format: string | null;
  sourceFileName: string | null;
  importedAt: string;
  description: string | null;
  cFeatures: string | null;
  pEpid: string | null;
  pUpc: string | null;
  action: string | null;
  relationship: string | null;
  relationshipDetails: string | null;
  scheduleTime: string | null;
  buyItNowPrice: string | null;
  bestOfferEnabled: string | null;
  bestOfferAutoAcceptPrice: string | null;
  minimumBestOfferPrice: string | null;
  immediatePayRequired: string | null;
  duration: string | null;
  shippingService1Option: string | null;
  shippingService1Cost: string | null;
  shippingService2Option: string | null;
  shippingService2Cost: string | null;
  maxDispatchTime: string | null;
  returnsAcceptedOption: string | null;
  refundOption: string | null;
  returnShippingCostPaidBy: string | null;
  shippingProfileName: string | null;
  returnProfileName: string | null;
  paymentProfileName: string | null;
  cItemHeight: string | null;
  cItemLength: string | null;
  cItemWidth: string | null;
  cItemDiameter: string | null;
  cOperatingMode: string | null;
  cFuelType: string | null;
  cDriveType: string | null;
  manufacturerName: string | null;
  sourceFilePath: string | null;
  sheetName: string | null;
  sourceRowNumber: number;
  version: number;
}

/* -- Active Filter State --------------------------------------------- */

export interface ActiveFilters {
  brands: string[];
  categories: string[];       // category IDs
  categoryNames: string[];    // for display
  conditions: string[];
  types: string[];
  sourceFiles: string[];
  formats: string[];
  locations: string[];
  mpns: string[];
  makes: string[];            // vehicle make names (extracted from title)
  makeNames: string[];        // same as makes (kept for compat)
  models: string[];           // vehicle model names (extracted from title)
  modelNames: string[];       // same as models (kept for compat)
  pipelineJobIds: string[];   // pipeline job UUIDs
  teamIds: string[];          // team UUIDs
  marketplaces: string[];     // marketplace codes
  minPrice: number | null;
  maxPrice: number | null;
  hasImage: boolean;
  hasPrice: boolean;
  stockLevels: StockLevelFilter[];
  shippingProfiles: string[];
  dateAddedPreset: DateAddedPreset;
  dateAddedFrom: string;    // YYYY-MM-DD, used when preset is 'custom'
  dateAddedTo: string;      // YYYY-MM-DD, used when preset is 'custom'
  catalogStatuses: CatalogListingStatus[];
}

export const EMPTY_FILTERS: ActiveFilters = {
  brands: [],
  categories: [],
  categoryNames: [],
  conditions: [],
  types: [],
  sourceFiles: [],
  formats: [],
  locations: [],
  mpns: [],
  makes: [],
  makeNames: [],
  models: [],
  modelNames: [],
  pipelineJobIds: [],
  teamIds: [],
  marketplaces: [],
  minPrice: null,
  maxPrice: null,
  hasImage: false,
  hasPrice: false,
  stockLevels: [],
  shippingProfiles: [],
  dateAddedPreset: 'all',
  dateAddedFrom: '',
  dateAddedTo: '',
  catalogStatuses: [],
};

function datePresetToRange(preset: DateAddedPreset): { from?: string; to?: string } {
  if (preset === 'all' || preset === 'custom') return {};
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  if (preset === 'last_7') fromDate.setDate(fromDate.getDate() - 7);
  else if (preset === 'last_30') fromDate.setDate(fromDate.getDate() - 30);
  else if (preset === 'last_90') fromDate.setDate(fromDate.getDate() - 90);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function datePresetToQuery(preset: DateAddedPreset): { importedFrom?: string; importedTo?: string } {
  const { from, to } = datePresetToRange(preset);
  return {
    importedFrom: from,
    importedTo: to,
  };
}

export function filtersToQuery(f: ActiveFilters): Partial<SearchQuery> {
  return {
    brands: f.brands.length ? f.brands.join(',') : undefined,
    categories: f.categories.length ? f.categories.join(',') : undefined,
    conditions: f.conditions.length ? f.conditions.join(',') : undefined,
    types: f.types.length ? f.types.join(',') : undefined,
    sourceFiles: f.sourceFiles.length ? f.sourceFiles.join(',') : undefined,
    formats: f.formats.length ? f.formats.join(',') : undefined,
    locations: f.locations.length ? f.locations.join(',') : undefined,
    mpns: f.mpns.length ? f.mpns.join(',') : undefined,
    makes: f.makes.length ? f.makes.join(',') : undefined,
    models: f.models.length ? f.models.join(',') : undefined,
    pipelineJobIds: f.pipelineJobIds.length ? f.pipelineJobIds.join(',') : undefined,
    teamIds: f.teamIds.length ? f.teamIds.join(',') : undefined,
    marketplaces: f.marketplaces.length ? f.marketplaces.join(',') : undefined,
    minPrice: f.minPrice ?? undefined,
    maxPrice: f.maxPrice ?? undefined,
    hasImage: f.hasImage ? '1' : undefined,
    hasPrice: f.hasPrice ? '1' : undefined,
    stockLevel: f.stockLevels.length ? f.stockLevels.join(',') : undefined,
    shippingProfiles: f.shippingProfiles.length ? f.shippingProfiles.join(',') : undefined,
    catalogStatus: f.catalogStatuses.length ? f.catalogStatuses.join(',') : undefined,
    ...(f.dateAddedPreset === 'custom'
      ? { importedFrom: f.dateAddedFrom || undefined, importedTo: f.dateAddedTo || undefined }
      : datePresetToQuery(f.dateAddedPreset)),
  };
}

export function countActiveFilters(f: ActiveFilters): number {
  let count = 0;
  count += f.brands.length;
  count += f.categories.length;
  count += f.conditions.length;
  count += f.types.length;
  count += f.sourceFiles.length;
  count += f.formats.length;
  count += f.locations.length;
  count += f.mpns.length;
  count += f.makes.length;
  count += f.models.length;
  count += f.pipelineJobIds.length;
  count += f.teamIds.length;
  count += f.marketplaces.length;
  if (f.minPrice != null) count++;
  if (f.maxPrice != null) count++;
  if (f.hasImage) count++;
  if (f.hasPrice) count++;
  count += f.stockLevels.length;
  count += f.shippingProfiles.length;
  if (f.dateAddedPreset === 'custom' && (f.dateAddedFrom || f.dateAddedTo)) count++;
  else if (f.dateAddedPreset !== 'all' && f.dateAddedPreset !== 'custom') count++;
  count += f.catalogStatuses.length;
  return count;
}

/* -- Condition labels ------------------------------------------------ */

export const CONDITION_MAP: Record<string, string> = {
  '1000': 'New',
  '1500': 'New (Other)',
  '2000': 'Certified Refurbished',
  '2500': 'Seller Refurbished',
  '3000': 'Used',
  '3000-Used': 'Used',
  '7000': 'For Parts',
};

export function conditionLabel(id: string | null): string {
  if (!id) return 'Unknown';
  return CONDITION_MAP[id] ?? id;
}

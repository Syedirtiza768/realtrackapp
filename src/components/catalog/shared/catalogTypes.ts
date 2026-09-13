export type ProductVertical = 'automotive' | 'business_industrial' | 'fashion';

export type CatalogSort = 'relevance' | 'newest' | 'updated' | 'title_asc' | 'title_desc' | 'sku_asc' | 'price_asc' | 'price_desc';
export type CatalogStock = 'in_stock' | 'low_stock' | 'out_of_stock';

export type CatalogFilters = {
  brands: string[];
  categories: string[];
  conditions: string[];
  types: string[];
  sourceFiles: string[];
  formats: string[];
  locations: string[];
  mpns: string[];
  teamIds: string[];
  marketplaces: string[];
  shippingProfiles: string[];
  stockLevels: CatalogStock[];
  catalogStatuses: string[];
  validationStatuses: string[];
  minPrice: string;
  maxPrice: string;
  hasImage: boolean;
  hasPrice: boolean;
  importedFrom: string;
  importedTo: string;
  attributes: Record<string, string[]>;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  brands: [], categories: [], conditions: [], types: [], sourceFiles: [], formats: [], locations: [], mpns: [], teamIds: [], marketplaces: [], shippingProfiles: [], stockLevels: [], catalogStatuses: [], validationStatuses: [], minPrice: '', maxPrice: '', hasImage: false, hasPrice: false, importedFrom: '', importedTo: '', attributes: {},
};

export type FacetBucket = { value: string; label?: string; count: number };

export type CatalogPublication = {
  id: string;
  storeName: string;
  marketplaceId: string;
  listingStatus: string;
  listingUrl: string | null;
  offerId: string | null;
  listingId: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
};

export type CatalogItem = {
  id: string;
  vertical: ProductVertical | null;
  sku: string | null;
  title: string;
  description: string | null;
  brand: string | null;
  mpn: string | null;
  conditionId: string | null;
  conditionLabel: string | null;
  price: number | null;
  quantity: number | null;
  imageUrls: string[];
  categoryId: string | null;
  categoryName: string | null;
  partType: string | null;
  location: string | null;
  format: string | null;
  shippingProfile: string | null;
  paymentProfile: string | null;
  returnProfile: string | null;
  sourceFile: string | null;
  sourceRow: number | null;
  importId: string | null;
  pipelineJobId: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  verticalAttributes: Record<string, unknown>;
  verticalValidationStatus: string;
  manualReview: boolean;
  readinessScore: number | null;
  seoScore: number | null;
  reviewStatus: string | null;
  publicationStatus: 'published' | 'unpublished' | 'blocked';
  publications: CatalogPublication[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogResponse = { vertical: ProductVertical; total: number; limit: number; offset: number; nextCursor: string | null; queryTimeMs: number; items: CatalogItem[] };
export type CatalogSummary = { vertical: ProductVertical; organizationId: string; total: number; withImages: number; missingImages: number; published: number };
export type CatalogFacets = {
  vertical: ProductVertical;
  totalFiltered: number;
  queryTimeMs: number;
  brands: FacetBucket[];
  categories: FacetBucket[];
  conditions: FacetBucket[];
  types: FacetBucket[];
  sourceFiles: FacetBucket[];
  formats: FacetBucket[];
  locations: FacetBucket[];
  mpns: FacetBucket[];
  teams: FacetBucket[];
  marketplaces: FacetBucket[];
  shippingProfiles: FacetBucket[];
  stockLevels: FacetBucket[];
  catalogStatuses: FacetBucket[];
  validationStatuses: FacetBucket[];
  attributeFacets: Record<string, FacetBucket[]>;
  priceRange: { min: number | null; max: number | null };
};

export type CatalogConfig = {
  vertical: ProductVertical;
  label: string;
  accent: string;
  route: string;
  editorUrl: (id?: string) => string;
  attributes: Array<{ key: string; label: string; valueLabels?: Record<string, string> }>;
  quickAttributes: string[];
  protectedStatuses: string[];
  filterLabels?: Partial<Record<keyof CatalogFilters, string>>;
};

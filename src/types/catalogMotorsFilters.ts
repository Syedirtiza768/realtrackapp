/** eBay Motors CSV catalog — API response shapes for /api/catalog-products */

export interface CatalogProductDerivedDto {
  image_count: number;
  has_images: boolean;
  fitment_count: number;
  has_fitment: boolean;
  unique_make_count: number;
  unique_model_count: number;
  year_min: number | null;
  year_max: number | null;
  price_band: string;
  title_length: number;
  has_oem_number: boolean;
  has_placement: boolean;
  has_material: boolean;
  has_features: boolean;
  has_country: boolean;
  duplicate_fitment_row_count: number;
  has_duplicate_fitment: boolean;
  data_completeness_score: number;
  readiness_status: 'ready' | 'needs_review';
  readiness_missing_gates: string[];
  store_routing_recommendation: string;
  manual_review_reasons: string[];
  marketplace_us_ready: boolean;
  marketplace_de_review: boolean;
  marketplace_au_review: boolean;
  marketplace_multi_candidate: boolean;
  marketplace_manual_review: boolean;
  category_buckets: string[];
}

export interface CatalogProductRowDto {
  id: string;
  sku: string | null;
  title: string;
  price: number | null;
  quantity: number | null;
  brand: string | null;
  partType: string | null;
  categoryId: string | null;
  conditionId: string | null;
  conditionLabel: string | null;
  shippingProfile: string | null;
  returnProfile: string | null;
  paymentProfile: string | null;
  location: string | null;
  importId: string | null;
  derived?: CatalogProductDerivedDto;
}

export interface CatalogProductsListResponse {
  products: CatalogProductRowDto[];
  total: number;
}

/** Flat query params sent to GET /api/catalog-products */
export interface CatalogMotorsListQuery {
  limit?: number;
  offset?: number;
  search?: string;
  importId?: string;
  pipelineJobId?: string;
  includeDerived?: boolean;
  sku?: string;
  priceMin?: number;
  priceMax?: number;
  priceBands?: string;
  readinessStatus?: 'ready' | 'needs_review' | 'all';
  missingImages?: boolean;
  hasImages?: boolean;
  missingOem?: boolean;
  missingPlacement?: boolean;
  missingPlacementWhenRequired?: boolean;
  missingMaterial?: boolean;
  missingFeatures?: boolean;
  missingCountry?: boolean;
  missingFitment?: boolean;
  hasFitment?: boolean;
  missingDescription?: boolean;
  singleQty?: boolean;
  multiQty?: boolean;
  inStock?: boolean;
  multiMake?: boolean;
  singleMake?: boolean;
  fitmentMake?: string;
  fitmentModel?: string;
  yearMin?: number;
  yearMax?: number;
  fitmentCountMin?: number;
  fitmentCountMax?: number;
  titleLenMin?: number;
  titleLenMax?: number;
  imageCountMin?: number;
  imageCountMax?: number;
  duplicateFitment?: boolean;
  brands?: string;
  partTypes?: string;
  categoryIds?: string;
  categoryBucket?: string;
  conditionIds?: string;
  shippingProfile?: string;
  returnProfile?: string;
  paymentProfile?: string;
  location?: string;
  format?: string;
  duration?: string;
  fixedPrice?: boolean;
  gtcDuration?: boolean;
}

import type { CatalogProduct } from '../entities/catalog-product.entity.js';
import {
  MOTORS_CATEGORY_BUCKETS,
  type MotorsCategoryBucket,
} from '../config/motors-category-buckets.js';

export type ReadinessStatus = 'ready' | 'needs_review';

export interface CatalogProductDerived {
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
  readiness_status: ReadinessStatus;
  readiness_missing_gates: string[];
  store_routing_recommendation: string;
  manual_review_reasons: string[];
  marketplace_us_ready: boolean;
  marketplace_de_review: boolean;
  marketplace_au_review: boolean;
  marketplace_multi_candidate: boolean;
  marketplace_manual_review: boolean;
  category_buckets: MotorsCategoryBucket[];
}

const NON_EMPTY = (v: string | null | undefined): boolean =>
  v != null && String(v).trim().length > 0;

function fitmentRows(product: CatalogProduct): Record<string, unknown>[] {
  const f = product.fitmentData;
  if (!f || !Array.isArray(f)) return [];
  return f;
}

function yearFromEntry(e: Record<string, unknown>): number | null {
  const y = e['Year'] ?? e['year'];
  if (y == null) return null;
  const n = parseInt(String(y), 10);
  return Number.isFinite(n) ? n : null;
}

function makeFromEntry(e: Record<string, unknown>): string {
  const m = e['Make'] ?? e['make'];
  return m != null ? String(m).trim().toLowerCase() : '';
}

function modelFromEntry(e: Record<string, unknown>): string {
  const m = e['Model'] ?? e['model'];
  return m != null ? String(m).trim().toLowerCase() : '';
}

/** Heuristic: placement is important for body / lighting / large exterior parts. */
export function placementLikelyRequired(
  partType: string | null | undefined,
): boolean {
  if (!partType) return false;
  const t = partType.toLowerCase();
  return (
    /head\s*light|headlight|tail\s*light|taillight|lamp|fog\s*light/i.test(t) ||
    /bumper|fender|hood|bonnet|door\s*panel|mirror|quarter\s*panel|rocker/i.test(
      t,
    ) ||
    /deck\s*lid|trunk\s*lid|tailgate/i.test(t)
  );
}

export function priceBandFromPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(Number(price))) return 'unknown';
  const p = Number(price);
  if (p < 100) return 'under_100';
  if (p < 200) return '100_199';
  if (p < 500) return '200_499';
  if (p < 1000) return '500_999';
  return '1000_plus';
}

function duplicateFitmentCount(rows: Record<string, unknown>[]): number {
  const sigs = new Map<string, number>();
  for (const e of rows) {
    const y = yearFromEntry(e) ?? '';
    const mk = makeFromEntry(e);
    const md = modelFromEntry(e);
    const key = `${y}|${mk}|${md}`;
    sigs.set(key, (sigs.get(key) ?? 0) + 1);
  }
  let dups = 0;
  for (const c of sigs.values()) {
    if (c > 1) dups += c - 1;
  }
  return dups;
}

function categoryBucketsForProduct(
  categoryId: string | null,
): MotorsCategoryBucket[] {
  if (!categoryId) return [];
  const out: MotorsCategoryBucket[] = [];
  const cid = String(categoryId).trim();
  Object.keys(MOTORS_CATEGORY_BUCKETS).forEach((bucket) => {
    const ids = MOTORS_CATEGORY_BUCKETS[bucket];
    if (ids.length && ids.includes(cid)) {
      out.push(bucket);
    }
  });
  return out;
}

function strictReadyGates(product: CatalogProduct): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!NON_EMPTY(product.title)) missing.push('title');
  if (product.price == null || Number(product.price) <= 0)
    missing.push('price');
  if (product.quantity == null || product.quantity < 1)
    missing.push('quantity');
  if (!NON_EMPTY(product.brand)) missing.push('brand');
  if (!NON_EMPTY(product.partType)) missing.push('partType');
  if (!NON_EMPTY(product.mpn)) missing.push('mpn');
  if (!NON_EMPTY(product.description)) missing.push('description');
  const imgCount = product.imageUrls?.filter((u) => NON_EMPTY(u)).length ?? 0;
  if (imgCount < 1) missing.push('images');
  const fit = fitmentRows(product);
  if (fit.length < 1) missing.push('fitment');
  if (!NON_EMPTY(product.shippingProfile)) missing.push('shippingProfile');
  if (!NON_EMPTY(product.returnProfile)) missing.push('returnProfile');
  if (!NON_EMPTY(product.paymentProfile)) missing.push('paymentProfile');
  return { ok: missing.length === 0, missing };
}

function manualReviewReasons(
  product: CatalogProduct,
  derived: {
    has_images: boolean;
    has_oem_number: boolean;
    has_fitment: boolean;
    duplicate_fitment_row_count: number;
    title_length: number;
  },
): string[] {
  const reasons: string[] = [];
  if (!derived.has_images) reasons.push('MISSING_IMAGES');
  if (!derived.has_oem_number) reasons.push('MISSING_OEM');
  if (
    placementLikelyRequired(product.partType) &&
    !NON_EMPTY(product.placement)
  ) {
    reasons.push('MISSING_PLACEMENT');
  }
  if (!derived.has_fitment) reasons.push('MISSING_FITMENT');
  if (derived.duplicate_fitment_row_count > 0) reasons.push('DUP_FITMENT');
  if (derived.title_length > 0 && derived.title_length < 20)
    reasons.push('TITLE_SHORT');
  if (derived.title_length > 80) reasons.push('TITLE_LONG');
  if (
    product.brand &&
    product.brandNormalized &&
    product.brand.trim().toUpperCase().replace(/\s+/g, ' ') !==
      product.brandNormalized.toUpperCase().replace(/\s+/g, ' ')
  ) {
    reasons.push('BRAND_NORMALIZE');
  }
  return reasons;
}

function storeRoutingRecommendation(
  product: CatalogProduct,
  readiness: ReadinessStatus,
  band: string,
): string {
  if (readiness !== 'ready') {
    return 'Do not route — fix readiness (staging only)';
  }
  const make = fitmentRows(product)[0];
  const mk = make ? makeFromEntry(make) : '';
  if (mk && product.brand) {
    return `Candidate: brand=${product.brand} make=${mk} band=${band} — assign store manually`;
  }
  if (band === '1000_plus' || band === '500_999') {
    return 'Premium / high-ticket route — assign store manually';
  }
  return 'General Motors catalog — assign store manually';
}

export function computeCatalogProductDerived(
  product: CatalogProduct,
): CatalogProductDerived {
  const urls = (product.imageUrls ?? []).filter((u) => NON_EMPTY(u));
  const image_count = urls.length;
  const has_images = image_count >= 1;
  const rows = fitmentRows(product);
  const fitment_count = rows.length;
  const has_fitment = fitment_count >= 1;

  const makes = new Set<string>();
  const models = new Set<string>();
  const years: number[] = [];
  for (const e of rows) {
    const mk = makeFromEntry(e);
    const md = modelFromEntry(e);
    if (mk) makes.add(mk);
    if (mk || md) models.add(`${mk}::${md}`);
    const y = yearFromEntry(e);
    if (y != null) years.push(y);
  }

  const year_min = years.length ? Math.min(...years) : null;
  const year_max = years.length ? Math.max(...years) : null;

  const price_band = priceBandFromPrice(
    product.price != null ? Number(product.price) : null,
  );
  const title_length = product.title?.length ?? 0;

  const has_oem_number = NON_EMPTY(product.oemPartNumber);
  const has_placement = NON_EMPTY(product.placement);
  const has_material = NON_EMPTY(product.material);
  const has_features = NON_EMPTY(product.features);
  const has_country = NON_EMPTY(product.countryOfOrigin);

  const duplicate_fitment_row_count = duplicateFitmentCount(rows);
  const has_duplicate_fitment = duplicate_fitment_row_count > 0;

  const gates = strictReadyGates(product);
  const mr = manualReviewReasons(product, {
    has_images,
    has_oem_number,
    has_fitment,
    duplicate_fitment_row_count,
    title_length,
  });

  const readiness_status: ReadinessStatus =
    gates.ok && mr.length === 0 ? 'ready' : 'needs_review';

  const weights: Array<{ ok: boolean; pts: number }> = [
    { ok: NON_EMPTY(product.title), pts: 10 },
    { ok: product.price != null && Number(product.price) > 0, pts: 10 },
    { ok: product.quantity != null && product.quantity >= 1, pts: 10 },
    { ok: NON_EMPTY(product.brand), pts: 10 },
    { ok: NON_EMPTY(product.partType), pts: 10 },
    { ok: NON_EMPTY(product.mpn), pts: 10 },
    { ok: NON_EMPTY(product.description), pts: 10 },
    { ok: has_images, pts: 10 },
    { ok: has_fitment, pts: 10 },
    {
      ok:
        NON_EMPTY(product.shippingProfile) &&
        NON_EMPTY(product.returnProfile) &&
        NON_EMPTY(product.paymentProfile),
      pts: 10,
    },
  ];
  const data_completeness_score = Math.min(
    100,
    weights.reduce((s, w) => s + (w.ok ? w.pts : 0), 0),
  );

  const marketplace_us_ready =
    readiness_status === 'ready' &&
    has_oem_number &&
    has_images &&
    image_count >= 2 &&
    has_fitment;

  const marketplace_multi_candidate =
    data_completeness_score >= 80 &&
    has_fitment &&
    has_oem_number &&
    has_images;

  const marketplace_de_review = marketplace_multi_candidate;
  const marketplace_au_review = marketplace_multi_candidate;
  const marketplace_manual_review =
    readiness_status !== 'ready' || mr.length > 0;

  return {
    image_count,
    has_images,
    fitment_count,
    has_fitment,
    unique_make_count: makes.size,
    unique_model_count: models.size,
    year_min,
    year_max,
    price_band,
    title_length,
    has_oem_number,
    has_placement,
    has_material,
    has_features,
    has_country,
    duplicate_fitment_row_count,
    has_duplicate_fitment,
    data_completeness_score,
    readiness_status,
    readiness_missing_gates: gates.missing,
    store_routing_recommendation: storeRoutingRecommendation(
      product,
      readiness_status,
      price_band,
    ),
    manual_review_reasons: mr,
    marketplace_us_ready,
    marketplace_de_review,
    marketplace_au_review,
    marketplace_multi_candidate,
    marketplace_manual_review,
    category_buckets: categoryBucketsForProduct(product.categoryId),
  };
}

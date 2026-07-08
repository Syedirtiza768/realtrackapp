import type { SelectQueryBuilder } from 'typeorm';
import type { CatalogProduct } from '../entities/catalog-product.entity.js';
import {
  MOTORS_CATEGORY_BUCKETS,
  type MotorsCategoryBucket,
} from '../config/motors-category-buckets.js';

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  const x = v.toLowerCase();
  if (x === 'true' || x === '1' || x === 'yes') return true;
  if (x === 'false' || x === '0' || x === 'no') return false;
  return undefined;
}

function parseIntOpt(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseFloatOpt(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function splitList(v: string | undefined): string[] | undefined {
  if (!v?.trim()) return undefined;
  return v
    .split(/[,|]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface CatalogProductListParams {
  limit: number;
  offset: number;
  pipelineJobId?: string;
  importId?: string;
  search?: string;
  includeDerived: boolean;
  sku?: string;
  priceMin?: number;
  priceMax?: number;
  priceBands?: string[];
  quantityMin?: number;
  quantityMax?: number;
  singleQty?: boolean;
  multiQty?: boolean;
  inStock?: boolean;
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
  categoryIds?: string[];
  categoryBucket?: MotorsCategoryBucket;
  brands?: string[];
  partTypes?: string[];
  conditionIds?: string[];
  shippingProfile?: string;
  returnProfile?: string;
  paymentProfile?: string;
  location?: string;
  format?: string;
  duration?: string;
  fitmentMake?: string;
  fitmentModel?: string;
  yearMin?: number;
  yearMax?: number;
  multiMake?: boolean;
  singleMake?: boolean;
  fitmentCountMin?: number;
  fitmentCountMax?: number;
  titleLenMin?: number;
  titleLenMax?: number;
  imageCountMin?: number;
  imageCountMax?: number;
  duplicateFitment?: boolean;
  fixedPrice?: boolean;
  gtcDuration?: boolean;
}

export function parseCatalogProductListQuery(
  q: Record<string, string | undefined>,
): CatalogProductListParams {
  const priceBands = splitList(q.priceBands ?? q.priceBand);
  const inc = parseBool(q.includeDerived);
  return {
    limit: Math.min(200, Math.max(1, parseIntOpt(q.limit) ?? 50)),
    offset: Math.max(0, parseIntOpt(q.offset) ?? 0),
    pipelineJobId: q.pipelineJobId?.trim() || undefined,
    importId: q.importId?.trim() || undefined,
    search: q.search?.trim() || undefined,
    includeDerived: inc !== false,
    sku: q.sku?.trim() || undefined,
    priceMin: parseFloatOpt(q.priceMin),
    priceMax: parseFloatOpt(q.priceMax),
    priceBands: priceBands?.length ? priceBands : undefined,
    quantityMin: parseIntOpt(q.quantityMin),
    quantityMax: parseIntOpt(q.quantityMax),
    singleQty: parseBool(q.singleQty),
    multiQty: parseBool(q.multiQty),
    inStock: parseBool(q.inStock),
    readinessStatus:
      q.readinessStatus === 'ready' || q.readinessStatus === 'needs_review'
        ? q.readinessStatus
        : q.readinessStatus === 'all'
          ? 'all'
          : undefined,
    missingImages: parseBool(q.missingImages),
    hasImages: parseBool(q.hasImages),
    missingOem: parseBool(q.missingOem),
    missingPlacement: parseBool(q.missingPlacement),
    missingPlacementWhenRequired: parseBool(q.missingPlacementWhenRequired),
    missingMaterial: parseBool(q.missingMaterial),
    missingFeatures: parseBool(q.missingFeatures),
    missingCountry: parseBool(q.missingCountry),
    missingFitment: parseBool(q.missingFitment),
    hasFitment: parseBool(q.hasFitment),
    missingDescription: parseBool(q.missingDescription),
    categoryIds: splitList(q.categoryIds),
    categoryBucket: (q.categoryBucket as MotorsCategoryBucket) || undefined,
    brands: splitList(q.brands),
    partTypes: splitList(q.partTypes),
    conditionIds: splitList(q.conditionIds),
    shippingProfile: q.shippingProfile?.trim() || undefined,
    returnProfile: q.returnProfile?.trim() || undefined,
    paymentProfile: q.paymentProfile?.trim() || undefined,
    location: q.location?.trim() || undefined,
    format: q.format?.trim() || undefined,
    duration: q.duration?.trim() || undefined,
    fitmentMake: q.fitmentMake?.trim() || undefined,
    fitmentModel: q.fitmentModel?.trim() || undefined,
    yearMin: parseIntOpt(q.yearMin),
    yearMax: parseIntOpt(q.yearMax),
    multiMake: parseBool(q.multiMake),
    singleMake: parseBool(q.singleMake),
    fitmentCountMin: parseIntOpt(q.fitmentCountMin),
    fitmentCountMax: parseIntOpt(q.fitmentCountMax),
    titleLenMin: parseIntOpt(q.titleLenMin),
    titleLenMax: parseIntOpt(q.titleLenMax),
    imageCountMin: parseIntOpt(q.imageCountMin),
    imageCountMax: parseIntOpt(q.imageCountMax),
    duplicateFitment: parseBool(q.duplicateFitment),
    fixedPrice: parseBool(q.fixedPrice),
    gtcDuration: parseBool(q.gtcDuration),
  };
}

function sqlPriceBandPredicate(alias: string, band: string): string | null {
  switch (band) {
    case 'under_100':
      return `${alias}.price IS NOT NULL AND ${alias}.price::numeric < 100`;
    case '100_199':
      return `${alias}.price IS NOT NULL AND ${alias}.price::numeric >= 100 AND ${alias}.price::numeric < 200`;
    case '200_499':
      return `${alias}.price IS NOT NULL AND ${alias}.price::numeric >= 200 AND ${alias}.price::numeric < 500`;
    case '500_999':
      return `${alias}.price IS NOT NULL AND ${alias}.price::numeric >= 500 AND ${alias}.price::numeric < 1000`;
    case '1000_plus':
      return `${alias}.price IS NOT NULL AND ${alias}.price::numeric >= 1000`;
    default:
      return null;
  }
}

/** Ready = strict listing gates (ops spec). Uses DB column names. */
function sqlReadyPredicate(alias: string): string {
  return `(
    ${alias}.title IS NOT NULL AND trim(${alias}.title) <> ''
    AND ${alias}.price IS NOT NULL AND ${alias}.price::numeric > 0
    AND ${alias}.quantity IS NOT NULL AND ${alias}.quantity >= 1
    AND ${alias}.brand IS NOT NULL AND trim(${alias}.brand) <> ''
    AND ${alias}.part_type IS NOT NULL AND trim(${alias}.part_type) <> ''
    AND ${alias}.mpn IS NOT NULL AND trim(${alias}.mpn) <> ''
    AND ${alias}.description IS NOT NULL AND trim(${alias}.description) <> ''
    AND COALESCE(array_length(${alias}.image_urls, 1), 0) >= 1
    AND ${alias}.fitment_data IS NOT NULL
    AND jsonb_typeof(${alias}.fitment_data) = 'array'
    AND jsonb_array_length(${alias}.fitment_data) >= 1
    AND ${alias}.shipping_profile IS NOT NULL AND trim(${alias}.shipping_profile) <> ''
    AND ${alias}.return_profile IS NOT NULL AND trim(${alias}.return_profile) <> ''
    AND ${alias}.payment_profile IS NOT NULL AND trim(${alias}.payment_profile) <> ''
  )`;
}

export function applyCatalogProductListFilters(
  qb: SelectQueryBuilder<CatalogProduct>,
  p: CatalogProductListParams,
): void {
  const a = 'p';

  if (p.pipelineJobId) {
    qb.andWhere(`${a}.pipeline_job_id = :pipelineJobId`, {
      pipelineJobId: p.pipelineJobId,
    });
  }
  if (p.importId) {
    qb.andWhere(`${a}.import_id = :importId`, { importId: p.importId });
  }
  if (p.search) {
    qb.andWhere(
      `(${a}.title ILIKE :q OR ${a}.sku ILIKE :q OR ${a}.brand ILIKE :q OR ${a}.mpn ILIKE :q OR ${a}.oem_part_number ILIKE :q)`,
      { q: `%${p.search}%` },
    );
  }
  if (p.sku) {
    qb.andWhere(`${a}.sku ILIKE :sku`, { sku: `%${p.sku}%` });
  }
  if (p.priceMin != null) {
    qb.andWhere(`${a}.price IS NOT NULL AND ${a}.price >= :priceMin`, {
      priceMin: p.priceMin,
    });
  }
  if (p.priceMax != null) {
    qb.andWhere(`${a}.price IS NOT NULL AND ${a}.price <= :priceMax`, {
      priceMax: p.priceMax,
    });
  }
  if (p.priceBands?.length) {
    const parts: string[] = [];
    for (const band of p.priceBands) {
      const frag = sqlPriceBandPredicate(a, band);
      if (frag) parts.push(`(${frag})`);
    }
    if (parts.length) {
      qb.andWhere(`(${parts.join(' OR ')})`);
    }
  }
  if (p.quantityMin != null) {
    qb.andWhere(`${a}.quantity IS NOT NULL AND ${a}.quantity >= :qmin`, {
      qmin: p.quantityMin,
    });
  }
  if (p.quantityMax != null) {
    qb.andWhere(`${a}.quantity IS NOT NULL AND ${a}.quantity <= :qmax`, {
      qmax: p.quantityMax,
    });
  }
  if (p.singleQty === true) {
    qb.andWhere(`${a}.quantity = 1`);
  }
  if (p.multiQty === true) {
    qb.andWhere(`${a}.quantity IS NOT NULL AND ${a}.quantity > 1`);
  }
  if (p.inStock === true) {
    qb.andWhere(`${a}.quantity IS NOT NULL AND ${a}.quantity >= 1`);
  }

  if (p.readinessStatus === 'ready') {
    qb.andWhere(sqlReadyPredicate(a));
  } else if (p.readinessStatus === 'needs_review') {
    qb.andWhere(`NOT (${sqlReadyPredicate(a)})`);
  }

  if (p.missingImages === true) {
    qb.andWhere(`(COALESCE(array_length(${a}.image_urls, 1), 0) < 1)`);
  }
  if (p.hasImages === true) {
    qb.andWhere(`COALESCE(array_length(${a}.image_urls, 1), 0) >= 1`);
  }
  if (p.missingOem === true) {
    qb.andWhere(
      `(${a}.oem_part_number IS NULL OR trim(${a}.oem_part_number) = '')`,
    );
  }
  if (p.missingPlacement === true) {
    qb.andWhere(`(${a}.placement IS NULL OR trim(${a}.placement) = '')`);
  }
  if (p.missingPlacementWhenRequired === true) {
    const orPart = [
      'headlight',
      'tail',
      'lamp',
      'fog',
      'bumper',
      'fender',
      'hood',
      'mirror',
      'door',
      'trunk',
      'deck',
      'tailgate',
      'quarter',
    ]
      .map((t) => `lower(coalesce(${a}.part_type,'')) LIKE '%${t}%'`)
      .join(' OR ');
    qb.andWhere(
      `((${orPart}) AND (${a}.placement IS NULL OR trim(${a}.placement) = ''))`,
    );
  }
  if (p.missingMaterial === true) {
    qb.andWhere(`(${a}.material IS NULL OR trim(${a}.material) = '')`);
  }
  if (p.missingFeatures === true) {
    qb.andWhere(`(${a}.features IS NULL OR trim(${a}.features) = '')`);
  }
  if (p.missingCountry === true) {
    qb.andWhere(
      `(${a}.country_of_origin IS NULL OR trim(${a}.country_of_origin) = '')`,
    );
  }
  if (p.missingFitment === true) {
    qb.andWhere(
      `(${a}.fitment_data IS NULL OR jsonb_typeof(${a}.fitment_data) <> 'array' OR jsonb_array_length(${a}.fitment_data) < 1)`,
    );
  }
  if (p.hasFitment === true) {
    qb.andWhere(
      `(${a}.fitment_data IS NOT NULL AND jsonb_typeof(${a}.fitment_data) = 'array' AND jsonb_array_length(${a}.fitment_data) >= 1)`,
    );
  }
  if (p.missingDescription === true) {
    qb.andWhere(`(${a}.description IS NULL OR trim(${a}.description) = '')`);
  }

  if (p.categoryIds?.length) {
    qb.andWhere(`${a}.category_id IN (:...catIds)`, { catIds: p.categoryIds });
  }
  if (p.categoryBucket && MOTORS_CATEGORY_BUCKETS[p.categoryBucket]?.length) {
    qb.andWhere(`${a}.category_id IN (:...bucketCatIds)`, {
      bucketCatIds: [...MOTORS_CATEGORY_BUCKETS[p.categoryBucket]],
    });
  }

  if (p.brands?.length) {
    const clauses = p.brands.map(
      (_, i) =>
        `(${a}.brand_normalized ILIKE :brand${i} OR ${a}.brand ILIKE :brand${i})`,
    );
    qb.andWhere(
      `(${clauses.join(' OR ')})`,
      Object.fromEntries(p.brands.map((b, i) => [`brand${i}`, `%${b}%`])),
    );
  }
  if (p.partTypes?.length) {
    const clauses = p.partTypes.map((_, i) => `${a}.part_type ILIKE :pt${i}`);
    qb.andWhere(
      `(${clauses.join(' OR ')})`,
      Object.fromEntries(p.partTypes.map((b, i) => [`pt${i}`, `%${b}%`])),
    );
  }
  if (p.conditionIds?.length) {
    qb.andWhere(`${a}.condition_id IN (:...condIds)`, {
      condIds: p.conditionIds,
    });
  }

  if (p.shippingProfile) {
    qb.andWhere(`${a}.shipping_profile ILIKE :ship`, {
      ship: `%${p.shippingProfile}%`,
    });
  }
  if (p.returnProfile) {
    qb.andWhere(`${a}.return_profile ILIKE :ret`, {
      ret: `%${p.returnProfile}%`,
    });
  }
  if (p.paymentProfile) {
    qb.andWhere(`${a}.payment_profile ILIKE :pay`, {
      pay: `%${p.paymentProfile}%`,
    });
  }
  if (p.location) {
    qb.andWhere(`${a}.location ILIKE :loc`, { loc: `%${p.location}%` });
  }
  if (p.fixedPrice === true) {
    qb.andWhere(`lower(trim(coalesce(${a}.format,''))) = 'fixedprice'`);
  }
  if (p.gtcDuration === true) {
    qb.andWhere(`upper(trim(coalesce(${a}.duration,''))) = 'GTC'`);
  }

  if (p.fitmentMake) {
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE coalesce(elem->>'Make', elem->>'make', '') ILIKE :fitMake
      )`,
      { fitMake: `%${p.fitmentMake}%` },
    );
  }
  if (p.fitmentModel) {
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE coalesce(elem->>'Model', elem->>'model', '') ILIKE :fitModel
      )`,
      { fitModel: `%${p.fitmentModel}%` },
    );
  }
  if (p.yearMin != null) {
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE (nullif(trim(coalesce(elem->>'Year', elem->>'year','')), ''))::int >= :yMin
      )`,
      { yMin: p.yearMin },
    );
  }
  if (p.yearMax != null) {
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE (nullif(trim(coalesce(elem->>'Year', elem->>'year','')), ''))::int <= :yMax
      )`,
      { yMax: p.yearMax },
    );
  }

  if (p.multiMake === true) {
    qb.andWhere(
      `(SELECT COUNT(DISTINCT lower(trim(coalesce(elem->>'Make', elem->>'make',''))))
        FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE trim(coalesce(elem->>'Make', elem->>'make','')) <> '') > 1`,
    );
  }
  if (p.singleMake === true) {
    qb.andWhere(
      `(SELECT COUNT(DISTINCT lower(trim(coalesce(elem->>'Make', elem->>'make',''))))
        FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
        WHERE trim(coalesce(elem->>'Make', elem->>'make','')) <> '') = 1`,
    );
  }

  if (p.fitmentCountMin != null) {
    qb.andWhere(
      `COALESCE(jsonb_array_length(${a}.fitment_data), 0) >= :fcmin`,
      {
        fcmin: p.fitmentCountMin,
      },
    );
  }
  if (p.fitmentCountMax != null) {
    qb.andWhere(
      `COALESCE(jsonb_array_length(${a}.fitment_data), 0) <= :fcmax`,
      {
        fcmax: p.fitmentCountMax,
      },
    );
  }

  if (p.titleLenMin != null) {
    qb.andWhere(`char_length(${a}.title) >= :tmin`, { tmin: p.titleLenMin });
  }
  if (p.titleLenMax != null) {
    qb.andWhere(`char_length(${a}.title) <= :tmax`, { tmax: p.titleLenMax });
  }
  if (p.imageCountMin != null) {
    qb.andWhere(`COALESCE(array_length(${a}.image_urls, 1), 0) >= :icmin`, {
      icmin: p.imageCountMin,
    });
  }
  if (p.imageCountMax != null) {
    qb.andWhere(`COALESCE(array_length(${a}.image_urls, 1), 0) <= :icmax`, {
      icmax: p.imageCountMax,
    });
  }

  if (p.duplicateFitment === true) {
    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM (
          SELECT count(*) AS c FROM jsonb_array_elements(COALESCE(${a}.fitment_data, '[]'::jsonb)) elem
          GROUP BY
            lower(trim(coalesce(elem->>'Make', elem->>'make',''))),
            lower(trim(coalesce(elem->>'Model', elem->>'model',''))),
            trim(coalesce(elem->>'Year', elem->>'year',''))
          HAVING count(*) > 1
        ) dup
      )`,
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SearchQueryDto } from './dto/search-query.dto';
import { ListingRecord } from './listing-record.entity';

/* ── Types ────────────────────────────────────────────────── */

export interface SearchResult {
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
  /** FTS relevance score (0-1+), null if no search query */
  relevanceScore: number | null;
  /** Headline with <mark> tags around matched terms */
  titleHighlight: string | null;
}

export interface SuggestionResult {
  suggestions: Suggestion[];
  queryTimeMs: number;
}

export interface Suggestion {
  type: 'sku' | 'title' | 'brand' | 'category' | 'mpn';
  value: string;
  label: string;
  /** How many listings match */
  count?: number;
  /** match score */
  score: number;
}

export interface DynamicFacets {
  brands: FacetBucket[];
  categories: CategoryFacetBucket[];
  conditions: FacetBucket[];
  types: FacetBucket[];
  sourceFiles: FacetBucket[];
  formats: FacetBucket[];
  locations: FacetBucket[];
  mpns: FacetBucket[];
  priceRange: { min: number | null; max: number | null };
  totalFiltered: number;
  queryTimeMs: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface CategoryFacetBucket extends FacetBucket {
  id: string;
}

/* ── Helper: split comma-separated filter into trimmed array ── */
function splitFilter(val: string | undefined): string[] {
  if (!val?.trim()) return [];
  return val.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Safely cast startPrice to numeric, handling European comma format ("139,99" → 139.99) */
const SAFE_PRICE = `NULLIF(REPLACE(r."startPrice", ',', '.'), '')::numeric`;

/* ────────────────────────────────────────────────────────────── */

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly repo: Repository<ListingRecord>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * SEARCH — main search endpoint
   * Combines: FTS ranking, exact SKU boost, fuzzy fallback,
   *           multi-select filters, range filters, sorting
   * ──────────────────────────────────────────────────────── */
  async search(dto: SearchQueryDto): Promise<SearchResult> {
    const start = Date.now();
    const limit = Math.min(Number(dto.limit ?? 60), 200);
    const offset = Number(dto.offset ?? 0);
    const q = dto.q?.trim() || '';
    const hasQuery = q.length > 0;

    const qb = this.repo.createQueryBuilder('r');

    /* -- Select columns ---------------------------------------- */
    qb.select([
      'r.id',
      'r.customLabelSku',
      'r.title',
      'r.cBrand',
      'r.cType',
      'r.categoryId',
      'r.categoryName',
      'r.startPrice',
      'r.quantity',
      'r.conditionId',
      'r.itemPhotoUrl',
      'r.cManufacturerPartNumber',
      'r.cOeOemPartNumber',
      'r.location',
      'r.format',
      'r.sourceFileName',
      'r.importedAt',
      'r.description',
      'r.cFeatures',
      'r.pEpid',
      'r.pUpc',
    ]);

    /* -- Full-text search scoring ------------------------------ */
    if (hasQuery) {
      // Build tsquery — websearch_to_tsquery for natural language input
      // Also do prefix matching for search-as-you-type
      const prefixTerms = q
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `${t}:*`)
        .join(' & ');

      // Combined FTS: websearch OR prefix query
      qb.addSelect(
        `GREATEST(
          ts_rank_cd(r."searchVector", websearch_to_tsquery('english', :q), 32),
          ts_rank_cd(r."searchVector", to_tsquery('english', :prefixQ), 32)
        )`,
        'relevanceScore',
      );

      // Headline for title highlighting
      qb.addSelect(
        `ts_headline('english', COALESCE(r.title, ''),
          websearch_to_tsquery('english', :q),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=60, MinWords=20, MaxFragments=1')`,
        'titleHighlight',
      );

      // Exact SKU boost: if the query matches the SKU exactly, push it up
      qb.addSelect(
        `CASE WHEN LOWER(r."customLabelSku") = LOWER(:q) THEN 100
              WHEN LOWER(r."customLabelSku") LIKE LOWER(:qPrefix) THEN 50
              ELSE 0
         END`,
        'skuBoost',
      );

      // FTS filter with fuzzy fallback
      qb.where(
        `(
          r."searchVector" @@ websearch_to_tsquery('english', :q)
          OR r."searchVector" @@ to_tsquery('english', :prefixQ)
          OR LOWER(r."customLabelSku") = LOWER(:q)
          OR LOWER(r."customLabelSku") LIKE LOWER(:qPrefix)
          OR similarity(r.title, :q) > 0.15
          OR similarity(r."customLabelSku", :q) > 0.3
        )`,
      );

      qb.setParameters({
        q,
        prefixQ: prefixTerms || q,
        qPrefix: `${q}%`,
      });
    }

    /* -- Exact SKU match (highest priority) -------------------- */
    if (dto.exactSku?.trim()) {
      qb.andWhere('LOWER(r."customLabelSku") = LOWER(:exactSku)', {
        exactSku: dto.exactSku.trim(),
      });
    }

    /* -- Multi-select filters ---------------------------------- */
    this.applyMultiFilters(qb, dto);

    /* -- Range filters ----------------------------------------- */
    if (dto.minPrice != null) {
      qb.andWhere(
        `${SAFE_PRICE} >= :minPrice`,
        { minPrice: dto.minPrice },
      );
    }
    if (dto.maxPrice != null) {
      qb.andWhere(
        `${SAFE_PRICE} <= :maxPrice`,
        { maxPrice: dto.maxPrice },
      );
    }

    /* -- Boolean filters --------------------------------------- */
    if (dto.hasImage === '1') {
      qb.andWhere(`r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != ''`);
    }
    if (dto.hasPrice === '1') {
      qb.andWhere(`r."startPrice" IS NOT NULL AND r."startPrice" != ''`);
    }

    /* -- Sorting ----------------------------------------------- */
    const sort = dto.sort ?? (hasQuery ? 'relevance' : 'newest');
    switch (sort) {
      case 'relevance':
        if (hasQuery) {
          qb.orderBy('"skuBoost"', 'DESC');
          qb.addOrderBy('"relevanceScore"', 'DESC');
          qb.addOrderBy(
            `similarity(r.title, :q)`,
            'DESC',
          );
        } else {
          qb.orderBy('r.importedAt', 'DESC');
        }
        break;
      case 'price_asc':
        qb.orderBy(SAFE_PRICE, 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy(SAFE_PRICE, 'DESC', 'NULLS LAST');
        break;
      case 'newest':
        qb.orderBy('r.importedAt', 'DESC');
        break;
      case 'title_asc':
        qb.orderBy('r.title', 'ASC', 'NULLS LAST');
        break;
      case 'title_desc':
        qb.orderBy('r.title', 'DESC', 'NULLS LAST');
        break;
      case 'sku_asc':
        qb.orderBy('r."customLabelSku"', 'ASC', 'NULLS LAST');
        break;
    }
    qb.addOrderBy('r.id', 'ASC'); // stable tie-breaker

    /* -- Pagination -------------------------------------------- */
    qb.offset(offset).limit(limit);

    /* -- Execute ----------------------------------------------- */
    const { raw, entities } = await qb.getRawAndEntities();

    // Merge raw scores into entity-like objects
    const items: SearchItem[] = entities.map((e, i) => ({
      id: e.id,
      customLabelSku: e.customLabelSku,
      title: e.title,
      cBrand: e.cBrand,
      cType: e.cType,
      categoryId: e.categoryId,
      categoryName: e.categoryName,
      startPrice: e.startPrice,
      quantity: e.quantity,
      conditionId: e.conditionId,
      itemPhotoUrl: e.itemPhotoUrl,
      cManufacturerPartNumber: e.cManufacturerPartNumber,
      cOeOemPartNumber: e.cOeOemPartNumber,
      location: e.location,
      format: e.format,
      sourceFileName: e.sourceFileName,
      importedAt: String(e.importedAt),
      description: e.description,
      cFeatures: e.cFeatures,
      pEpid: e.pEpid,
      pUpc: e.pUpc,
      relevanceScore: hasQuery
        ? parseFloat(raw[i]?.relevanceScore ?? '0')
        : null,
      titleHighlight: hasQuery ? (raw[i]?.titleHighlight ?? null) : null,
    }));

    // Get total count (separate lightweight query)
    const countQb = this.repo.createQueryBuilder('r');
    if (hasQuery) {
      const prefixTerms = q
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `${t}:*`)
        .join(' & ');

      countQb.where(
        `(
          r."searchVector" @@ websearch_to_tsquery('english', :q)
          OR r."searchVector" @@ to_tsquery('english', :prefixQ)
          OR LOWER(r."customLabelSku") = LOWER(:q)
          OR LOWER(r."customLabelSku") LIKE LOWER(:qPrefix)
          OR similarity(r.title, :q) > 0.15
          OR similarity(r."customLabelSku", :q) > 0.3
        )`,
      );
      countQb.setParameters({ q, prefixQ: prefixTerms || q, qPrefix: `${q}%` });
    }
    if (dto.exactSku?.trim()) {
      countQb.andWhere('LOWER(r."customLabelSku") = LOWER(:exactSku)', {
        exactSku: dto.exactSku.trim(),
      });
    }
    this.applyMultiFilters(countQb, dto);
    if (dto.minPrice != null) {
      countQb.andWhere(`${SAFE_PRICE} >= :minPrice`, { minPrice: dto.minPrice });
    }
    if (dto.maxPrice != null) {
      countQb.andWhere(`${SAFE_PRICE} <= :maxPrice`, { maxPrice: dto.maxPrice });
    }
    if (dto.hasImage === '1') {
      countQb.andWhere(`r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != ''`);
    }
    if (dto.hasPrice === '1') {
      countQb.andWhere(`r."startPrice" IS NOT NULL AND r."startPrice" != ''`);
    }
    const total = await countQb.getCount();

    // Next cursor for infinite scroll
    const nextCursor = items.length === limit
      ? String(offset + limit)
      : null;

    return {
      total,
      limit,
      offset,
      nextCursor,
      queryTimeMs: Date.now() - start,
      items,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * SUGGEST — auto-complete / search suggestions
   * Returns ranked suggestions from SKUs, titles, brands,
   * categories, and MPNs.
   * ──────────────────────────────────────────────────────── */
  async suggest(q: string, limitNum = 10): Promise<SuggestionResult> {
    const start = Date.now();
    const term = q.trim();
    if (!term) return { suggestions: [], queryTimeMs: 0 };

    const maxPerType = Math.ceil(limitNum / 3);

    // Run all suggestion queries in parallel
    const [skus, titles, brands, categories, mpns] = await Promise.all([
      // Exact / prefix SKU matches (highest priority)
      this.repo
        .createQueryBuilder('r')
        .select('r."customLabelSku"', 'value')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`similarity(r."customLabelSku", :q)`, 'score')
        .where(`(
          LOWER(r."customLabelSku") = LOWER(:q)
          OR LOWER(r."customLabelSku") LIKE LOWER(:prefix)
          OR similarity(r."customLabelSku", :q) > 0.25
        )`)
        .andWhere(`r."customLabelSku" IS NOT NULL AND r."customLabelSku" != ''`)
        .groupBy('r."customLabelSku"')
        .orderBy('score', 'DESC')
        .limit(maxPerType)
        .setParameters({ q: term, prefix: `${term}%` })
        .getRawMany<{ value: string; count: string; score: string }>(),

      // Title matches via FTS
      this.repo
        .createQueryBuilder('r')
        .select('r.title', 'value')
        .addSelect('COUNT(*)', 'count')
        .addSelect(
          `MAX(ts_rank_cd(r."searchVector", websearch_to_tsquery('english', :q), 32))`,
          'score',
        )
        .where(`r."searchVector" @@ websearch_to_tsquery('english', :q)`)
        .andWhere(`r.title IS NOT NULL AND r.title != ''`)
        .groupBy('r.title')
        .orderBy('score', 'DESC')
        .limit(maxPerType)
        .setParameters({ q: term })
        .getRawMany<{ value: string; count: string; score: string }>(),

      // Brand matches (trigram)
      this.repo
        .createQueryBuilder('r')
        .select('r."cBrand"', 'value')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`similarity(r."cBrand", :q)`, 'score')
        .where(`(
          LOWER(r."cBrand") LIKE LOWER(:prefix)
          OR similarity(r."cBrand", :q) > 0.2
        )`)
        .andWhere(`r."cBrand" IS NOT NULL AND r."cBrand" != ''`)
        .groupBy('r."cBrand"')
        .orderBy('score', 'DESC')
        .limit(maxPerType)
        .setParameters({ q: term, prefix: `${term}%` })
        .getRawMany<{ value: string; count: string; score: string }>(),

      // Category name matches
      this.repo
        .createQueryBuilder('r')
        .select('r."categoryName"', 'value')
        .addSelect('r."categoryId"', 'id')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`similarity(r."categoryName", :q)`, 'score')
        .where(`(
          LOWER(r."categoryName") LIKE LOWER(:anywhere)
          OR similarity(r."categoryName", :q) > 0.15
        )`)
        .andWhere(`r."categoryName" IS NOT NULL AND r."categoryName" != ''`)
        .groupBy('r."categoryName"')
        .addGroupBy('r."categoryId"')
        .orderBy('score', 'DESC')
        .limit(maxPerType)
        .setParameters({ q: term, anywhere: `%${term}%` })
        .getRawMany<{ value: string; id: string; count: string; score: string }>(),

      // MPN matches
      this.repo
        .createQueryBuilder('r')
        .select('r."cManufacturerPartNumber"', 'value')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`similarity(r."cManufacturerPartNumber", :q)`, 'score')
        .where(`(
          LOWER(r."cManufacturerPartNumber") LIKE LOWER(:prefix)
          OR similarity(r."cManufacturerPartNumber", :q) > 0.3
        )`)
        .andWhere(`r."cManufacturerPartNumber" IS NOT NULL AND r."cManufacturerPartNumber" != ''`)
        .groupBy('r."cManufacturerPartNumber"')
        .orderBy('score', 'DESC')
        .limit(maxPerType)
        .setParameters({ q: term, prefix: `${term}%` })
        .getRawMany<{ value: string; count: string; score: string }>(),
    ]);

    const suggestions: Suggestion[] = [
      ...skus.map((r) => ({
        type: 'sku' as const,
        value: r.value,
        label: `SKU: ${r.value}`,
        count: Number(r.count),
        score: parseFloat(r.score) + 10, // SKU boost
      })),
      ...brands.map((r) => ({
        type: 'brand' as const,
        value: r.value,
        label: `Brand: ${r.value}`,
        count: Number(r.count),
        score: parseFloat(r.score) + 5,
      })),
      ...categories.map((r) => ({
        type: 'category' as const,
        value: r.value,
        label: `Category: ${r.value}`,
        count: Number(r.count),
        score: parseFloat(r.score) + 3,
      })),
      ...mpns.map((r) => ({
        type: 'mpn' as const,
        value: r.value,
        label: `MPN: ${r.value}`,
        count: Number(r.count),
        score: parseFloat(r.score) + 2,
      })),
      ...titles.map((r) => ({
        type: 'title' as const,
        value: r.value,
        label: r.value,
        count: Number(r.count),
        score: parseFloat(r.score),
      })),
    ];

    // Sort by score descending, take top `limitNum`
    suggestions.sort((a, b) => b.score - a.score);

    return {
      suggestions: suggestions.slice(0, limitNum),
      queryTimeMs: Date.now() - start,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * DYNAMIC FACETS — counts that reflect current filters/query
   * ──────────────────────────────────────────────────────── */
  async dynamicFacets(dto: SearchQueryDto): Promise<DynamicFacets> {
    const start = Date.now();
    const q = dto.q?.trim() || '';
    const hasQuery = q.length > 0;

    // Build base WHERE clause (same as search, minus the facet being computed)
    const buildBaseQb = () => {
      const base = this.repo.createQueryBuilder('r');
      if (hasQuery) {
        const prefixTerms = q
          .replace(/[^\w\s-]/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => `${t}:*`)
          .join(' & ');

        base.where(
          `(
            r."searchVector" @@ websearch_to_tsquery('english', :q)
            OR r."searchVector" @@ to_tsquery('english', :prefixQ)
            OR LOWER(r."customLabelSku") = LOWER(:q)
            OR LOWER(r."customLabelSku") LIKE LOWER(:qPrefix)
            OR similarity(r.title, :q) > 0.15
            OR similarity(r."customLabelSku", :q) > 0.3
          )`,
        );
        base.setParameters({ q, prefixQ: prefixTerms || q, qPrefix: `${q}%` });
      }
      if (dto.hasImage === '1') {
        base.andWhere(`r."itemPhotoUrl" IS NOT NULL AND r."itemPhotoUrl" != ''`);
      }
      if (dto.hasPrice === '1') {
        base.andWhere(`r."startPrice" IS NOT NULL AND r."startPrice" != ''`);
      }
      if (dto.minPrice != null) {
        base.andWhere(`${SAFE_PRICE} >= :minPrice`, { minPrice: dto.minPrice });
      }
      if (dto.maxPrice != null) {
        base.andWhere(`${SAFE_PRICE} <= :maxPrice`, { maxPrice: dto.maxPrice });
      }
      return base;
    };

    // Each facet query applies ALL OTHER filters except its own dimension
    const buildFacetQb = (excludeDimension: string) => {
      const fb = buildBaseQb();
      const brandArr = splitFilter(dto.brands);
      const catArr = splitFilter(dto.categories);
      const condArr = splitFilter(dto.conditions);
      const typeArr = splitFilter(dto.types);
      const srcArr = splitFilter(dto.sourceFiles);

      if (excludeDimension !== 'brand' && brandArr.length) {
        fb.andWhere(`r."cBrand" IN (:...facetBrands)`, { facetBrands: brandArr });
      }
      if (excludeDimension !== 'category' && catArr.length) {
        fb.andWhere(`r."categoryId" IN (:...facetCats)`, { facetCats: catArr });
      }
      if (excludeDimension !== 'condition' && condArr.length) {
        fb.andWhere(`r."conditionId" IN (:...facetConds)`, { facetConds: condArr });
      }
      if (excludeDimension !== 'type' && typeArr.length) {
        fb.andWhere(`r."cType" IN (:...facetTypes)`, { facetTypes: typeArr });
      }
      if (excludeDimension !== 'sourceFile' && srcArr.length) {
        fb.andWhere(`r."sourceFileName" IN (:...facetSrc)`, { facetSrc: srcArr });
      }
      const fmtArr = splitFilter(dto.formats);
      if (excludeDimension !== 'format' && fmtArr.length) {
        fb.andWhere(`r.format IN (:...facetFmts)`, { facetFmts: fmtArr });
      }
      const locArr = splitFilter(dto.locations);
      if (excludeDimension !== 'location' && locArr.length) {
        fb.andWhere(`r.location IN (:...facetLocs)`, { facetLocs: locArr });
      }
      const mpnArr = splitFilter(dto.mpns);
      if (excludeDimension !== 'mpn' && mpnArr.length) {
        fb.andWhere(`r."cManufacturerPartNumber" IN (:...facetMpns)`, { facetMpns: mpnArr });
      }
      return fb;
    };

    // Run all facet queries in parallel
    const [
      brandsRaw, catsRaw, condsRaw, typesRaw, srcRaw,
      formatsRaw, locationsRaw, mpnsRaw,
      priceRaw, totalFiltered,
    ] = await Promise.all([
        // Brands facet
        buildFacetQb('brand')
          .select('r."cBrand"', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r."cBrand" IS NOT NULL AND r."cBrand" != ''`)
          .groupBy('r."cBrand"')
          .orderBy('count', 'DESC')
          .limit(100)
          .getRawMany<{ value: string; count: string }>(),

        // Categories facet
        buildFacetQb('category')
          .select('r."categoryName"', 'value')
          .addSelect('r."categoryId"', 'id')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r."categoryName" IS NOT NULL AND r."categoryName" != ''`)
          .groupBy('r."categoryName"')
          .addGroupBy('r."categoryId"')
          .orderBy('count', 'DESC')
          .limit(100)
          .getRawMany<{ value: string; id: string; count: string }>(),

        // Conditions facet
        buildFacetQb('condition')
          .select('r."conditionId"', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r."conditionId" IS NOT NULL AND r."conditionId" != ''`)
          .groupBy('r."conditionId"')
          .orderBy('count', 'DESC')
          .getRawMany<{ value: string; count: string }>(),

        // Types facet
        buildFacetQb('type')
          .select('r."cType"', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r."cType" IS NOT NULL AND r."cType" != ''`)
          .groupBy('r."cType"')
          .orderBy('count', 'DESC')
          .limit(100)
          .getRawMany<{ value: string; count: string }>(),

        // Source files facet
        buildFacetQb('sourceFile')
          .select('r."sourceFileName"', 'value')
          .addSelect('COUNT(*)', 'count')
          .groupBy('r."sourceFileName"')
          .orderBy('count', 'DESC')
          .getRawMany<{ value: string; count: string }>(),

        // Formats facet
        buildFacetQb('format')
          .select('r.format', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r.format IS NOT NULL AND r.format != ''`)
          .groupBy('r.format')
          .orderBy('count', 'DESC')
          .getRawMany<{ value: string; count: string }>(),

        // Locations facet
        buildFacetQb('location')
          .select('r.location', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r.location IS NOT NULL AND r.location != ''`)
          .groupBy('r.location')
          .orderBy('count', 'DESC')
          .limit(50)
          .getRawMany<{ value: string; count: string }>(),

        // MPN facet (top values only, typically searched)
        buildFacetQb('mpn')
          .select('r."cManufacturerPartNumber"', 'value')
          .addSelect('COUNT(*)', 'count')
          .andWhere(`r."cManufacturerPartNumber" IS NOT NULL AND r."cManufacturerPartNumber" != ''`)
          .groupBy('r."cManufacturerPartNumber"')
          .orderBy('count', 'DESC')
          .limit(50)
          .getRawMany<{ value: string; count: string }>(),

        // Price range (within filtered set)
        (() => {
          const pqb = buildBaseQb();
          this.applyMultiFilters(pqb, dto);
          return pqb
            .select(`MIN(${SAFE_PRICE})`, 'min')
            .addSelect(`MAX(${SAFE_PRICE})`, 'max')
            .getRawOne<{ min: string | null; max: string | null }>();
        })(),

        // Total count for filtered set
        (() => {
          const cqb = buildBaseQb();
          this.applyMultiFilters(cqb, dto);
          return cqb.getCount();
        })(),
      ]);

    return {
      brands: brandsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      categories: catsRaw.map((r) => ({ value: r.value, id: r.id, count: Number(r.count) })),
      conditions: condsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      types: typesRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      sourceFiles: srcRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      formats: formatsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      locations: locationsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      mpns: mpnsRaw.map((r) => ({ value: r.value, count: Number(r.count) })),
      priceRange: {
        min: priceRaw?.min != null ? parseFloat(priceRaw.min) : null,
        max: priceRaw?.max != null ? parseFloat(priceRaw.max) : null,
      },
      totalFiltered,
      queryTimeMs: Date.now() - start,
    };
  }

  /* ── Private: apply multi-select filters to any QueryBuilder ── */
  private applyMultiFilters(
    qb: SelectQueryBuilder<ListingRecord>,
    dto: SearchQueryDto,
  ) {
    const brandArr = splitFilter(dto.brands);
    const catArr = splitFilter(dto.categories);
    const condArr = splitFilter(dto.conditions);
    const typeArr = splitFilter(dto.types);
    const srcArr = splitFilter(dto.sourceFiles);
    const catNameArr = splitFilter(dto.categoryNames);
    const fmtArr = splitFilter(dto.formats);
    const locArr = splitFilter(dto.locations);
    const mpnArr = splitFilter(dto.mpns);

    if (brandArr.length) {
      qb.andWhere(`r."cBrand" IN (:...brands)`, { brands: brandArr });
    }
    if (catArr.length) {
      qb.andWhere(`r."categoryId" IN (:...cats)`, { cats: catArr });
    }
    if (catNameArr.length) {
      qb.andWhere(`r."categoryName" IN (:...catNames)`, { catNames: catNameArr });
    }
    if (condArr.length) {
      qb.andWhere(`r."conditionId" IN (:...conds)`, { conds: condArr });
    }
    if (typeArr.length) {
      qb.andWhere(`r."cType" IN (:...types)`, { types: typeArr });
    }
    if (srcArr.length) {
      qb.andWhere(`r."sourceFileName" IN (:...srcs)`, { srcs: srcArr });
    }
    if (fmtArr.length) {
      qb.andWhere(`r.format IN (:...fmts)`, { fmts: fmtArr });
    }
    if (locArr.length) {
      qb.andWhere(`r.location IN (:...locs)`, { locs: locArr });
    }
    if (mpnArr.length) {
      qb.andWhere(`r."cManufacturerPartNumber" IN (:...mpns)`, { mpns: mpnArr });
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
import { EbayPublishedListing } from '../published-listings/entities/ebay-published-listing.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { TeamsService } from '../teams/teams.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { FashionReview } from '../verticals/entities/fashion-review.entity.js';
import { BusinessIndustrialReview } from '../verticals/entities/business-industrial-review.entity.js';
import { FashionListingsService } from '../verticals/fashion-listings.service.js';
import { BusinessIndustrialService } from '../verticals/business-industrial.service.js';
import type { ProductVertical } from '../verticals/vertical.types.js';
import {
  CatalogBulkIdsDto,
  CatalogBulkPoliciesDto,
  CatalogBulkTeamDto,
  CatalogProductPatchDto,
  CatalogQueryDto,
  CatalogSort,
} from './catalog-workspace.dto.js';

type Scope = {
  organizationId: string;
  teamIds: string[];
  manageAllTeams: boolean;
  accessibleStoreIds: string[] | undefined;
};

type FacetBucket = { value: string; label?: string; count: number };

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
  publications: PublicationSummary[];
  createdAt: Date;
  updatedAt: Date;
};

export type PublicationSummary = {
  id: string;
  storeName: string;
  marketplaceId: string;
  listingStatus: string;
  listingUrl: string | null;
  offerId: string | null;
  listingId: string | null;
  lastErrorMessage: string | null;
  updatedAt: Date;
};

export type CatalogSearchResponse = {
  vertical: ProductVertical;
  total: number;
  limit: number;
  offset: number;
  nextCursor: string | null;
  queryTimeMs: number;
  items: CatalogItem[];
};

export type CatalogFacetsResponse = {
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

const SEARCH_SOURCE = `concat_ws(' ', p.sku, p.title, p.brand, p.mpn, p.category_id, p.category_name, p.description, p.part_type, p.source_file, p.location, cast(p.vertical_attributes as text))`;
const SAFE_PRICE = `p.price`;
const SAFE_QTY = `coalesce(p.quantity, 0)`;
const LIVE_PUBLICATION_STATUSES = new Set(['published', 'active', 'out_of_stock']);

export function isLivePublicationStatus(status: string | null | undefined) {
  return LIVE_PUBLICATION_STATUSES.has(String(status ?? '').trim().toLowerCase());
}

export function resolvePublicationStatus(input: {
  verticalValidationStatus: string;
  manualReview: boolean;
  ebayItemId?: string | null;
  publications: Array<{ listingStatus: string }>;
}): CatalogItem['publicationStatus'] {
  if (
    input.verticalValidationStatus === 'quarantined' ||
    input.manualReview
  )
    return 'blocked';
  if (
    input.publications.some((publication) =>
      isLivePublicationStatus(publication.listingStatus),
    ) ||
    input.verticalValidationStatus === 'published' ||
    Boolean(input.ebayItemId?.trim())
  )
    return 'published';
  return 'unpublished';
}

const ATTRIBUTE_KEYS: Record<ProductVertical, string[]> = {
  automotive: ['make', 'model', 'partType', 'placement', 'oemPartNumber'],
  business_industrial: [
    'categoryFamily',
    'manufacturer',
    'model',
    'mpn',
    'inventoryMode',
    'shippingMode',
    'inputVoltage',
    'inputFrequency',
    'mounting',
    'countryOfOrigin',
    'ratedVoltage',
    'ratedCurrent',
    'series',
    'enclosureRating',
  ],
  fashion: [
    'brand',
    'department',
    'productType',
    'itemType',
    'categoryFamily',
    'size',
    'sizeSystem',
    'color',
    'secondaryColor',
    'material',
    'style',
    'pattern',
    'condition',
    'authenticityStatus',
    'variantAvailability',
  ],
};

function split(value?: string): string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);
}

function label(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseAttributes(value?: string): Record<string, string[]> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BadRequestException('attributes must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new BadRequestException('attributes must be a JSON object');
  const result: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key))
      throw new BadRequestException(
        `Invalid vertical attribute filter: ${key}`,
      );
    const values = Array.isArray(raw) ? raw : [raw];
    if (Array.isArray(raw) && !raw.length) continue;
    if (
      !values.length ||
      values.some(
        (item) =>
          typeof item !== 'string' &&
          typeof item !== 'number' &&
          typeof item !== 'boolean',
      )
    )
      throw new BadRequestException(
        `Invalid values for vertical attribute filter: ${key}`,
      );
    result[key] = values.map(String).filter(Boolean).slice(0, 100);
  }
  return result;
}

function csv(value: unknown): string {
  let text = '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    text = String(value);
  else if (value != null) text = JSON.stringify(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

@Injectable()
export class CatalogWorkspaceService {
  private readonly facetCache = new Map<
    string,
    { expiresAt: number; value: CatalogFacetsResponse }
  >();

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(EbayListingChannel)
    private readonly channelRepo: Repository<EbayListingChannel>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(ListingActionLog)
    private readonly auditRepo: Repository<ListingActionLog>,
    @InjectRepository(FashionReview)
    private readonly fashionReviewRepo: Repository<FashionReview>,
    @InjectRepository(BusinessIndustrialReview)
    private readonly businessReviewRepo: Repository<BusinessIndustrialReview>,
    private readonly organizations: UserOrganizationService,
    private readonly storeAccess: StoreAccessService,
    private readonly teams: TeamsService,
    private readonly rbac: RbacService,
    private readonly fashion: FashionListingsService,
    private readonly businessIndustrial: BusinessIndustrialService,
    @InjectRepository(EbayPublishedListing)
    private readonly publishedListingRepo: Repository<EbayPublishedListing>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  async search(
    user: User,
    vertical: ProductVertical,
    dto: CatalogQueryDto,
  ): Promise<CatalogSearchResponse> {
    const started = Date.now();
    const scope = await this.scope(user, dto.organizationId, dto.teamIds);
    const limit = Math.min(dto.limit ?? 25, 500);
    const offset = dto.offset ?? 0;
    const qb = this.baseQuery(vertical, dto, scope);
    this.applySearchAndFilters(qb, vertical, dto, scope);
    this.applySort(qb, dto.sort, Boolean(dto.q?.trim()));
    const [products, total] = await qb
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    const items = await this.hydrateItems(products, scope, vertical);
    return {
      vertical,
      total,
      limit,
      offset,
      nextCursor:
        offset + items.length < total ? String(offset + items.length) : null,
      queryTimeMs: Date.now() - started,
      items,
    };
  }

  async suggest(
    user: User,
    vertical: ProductVertical,
    q: string,
    limit = 10,
    organizationId?: string,
  ) {
    const started = Date.now();
    const scope = await this.scope(user, organizationId);
    const trimmed = q.trim();
    if (!trimmed)
      return { vertical, suggestions: [], queryTimeMs: Date.now() - started };
    const qb = this.baseQuery(vertical, { q: trimmed }, scope);
    const contains = `%${this.escapeLike(trimmed)}%`;
    qb.andWhere(`${SEARCH_SOURCE} ILIKE :suggestContains ESCAPE '\\'`, {
      suggestContains: contains,
    });
    const products = await qb
      .select(['p.sku', 'p.title', 'p.brand', 'p.mpn', 'p.categoryName'])
      .take(Math.min(limit * 12, 100))
      .getMany();
    const values = new Map<
      string,
      {
        type: 'sku' | 'title' | 'brand' | 'category' | 'mpn';
        value: string;
        label: string;
        count: number;
        score: number;
      }
    >();
    for (const product of products) {
      const candidates: Array<
        ['sku' | 'title' | 'brand' | 'category' | 'mpn', string | null]
      > = [
        ['sku', product.sku],
        ['title', product.title],
        ['brand', product.brand],
        ['category', product.categoryName],
        ['mpn', product.mpn],
      ];
      for (const [type, value] of candidates) {
        const normalized = value?.trim();
        if (
          !normalized ||
          !normalized.toLowerCase().includes(trimmed.toLowerCase())
        )
          continue;
        const key = `${type}:${normalized.toLowerCase()}`;
        const existing = values.get(key);
        values.set(key, {
          type,
          value: normalized,
          label: `${label(type)}: ${normalized}`,
          count: (existing?.count ?? 0) + 1,
          score: type === 'sku' ? 100 : type === 'title' ? 80 : 60,
        });
      }
    }
    return {
      vertical,
      suggestions: [...values.values()]
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.count - a.count ||
            a.value.localeCompare(b.value),
        )
        .slice(0, Math.min(limit, 20)),
      queryTimeMs: Date.now() - started,
    };
  }

  async facets(
    user: User,
    vertical: ProductVertical,
    dto: CatalogQueryDto,
  ): Promise<CatalogFacetsResponse> {
    const started = Date.now();
    const scope = await this.scope(user, dto.organizationId, dto.teamIds);
    const cacheKey = `${user.id}:${scope.organizationId}:${vertical}:${JSON.stringify(dto)}`;
    const cached = this.facetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    // Every facet is derived from one filtered pass. The filtered rows are
    // materialized once in a CTE and each facet aggregates that set. The former
    // implementation ran about twenty separate scans of catalog_products, and
    // five of them repeated a correlated publication check per row. On the
    // fashion org that exceeded the pool's 30s statement_timeout and failed the
    // whole facets request.
    const filtered = this.baseQuery(vertical, dto, scope);
    this.applySearchAndFilters(filtered, vertical, dto, scope);
    filtered
      .select('p.id', 'id')
      .addSelect('p.brand', 'brand')
      .addSelect('p.categoryId', 'category_id')
      .addSelect('p.categoryName', 'category_name')
      .addSelect(
        "coalesce(nullif(p.condition_label, ''), nullif(p.condition_id, ''))",
        'condition_value',
      )
      .addSelect('p.partType', 'part_type')
      .addSelect('p.sourceFile', 'source_file')
      .addSelect('p.format', 'format')
      .addSelect('p.location', 'location')
      .addSelect('p.mpn', 'mpn')
      .addSelect('p.teamId', 'team_id')
      .addSelect('p.shippingProfile', 'shipping_profile')
      .addSelect('p.verticalValidationStatus', 'validation_status')
      .addSelect(SAFE_PRICE, 'price')
      .addSelect(SAFE_QTY, 'qty')
      .addSelect('array_length(p.image_urls, 1)', 'image_count')
      .addSelect(`(${this.publishedSql(scope)})`, 'is_published')
      .addSelect(
        "(p.manual_review = true OR p.vertical_validation_status IN ('quarantined', 'blocked', 'rejected'))",
        'is_blocked',
      )
      .addSelect('p.verticalAttributes', 'vertical_attributes')
      .setParameters(this.publishedParameters(scope, vertical));
    const [innerSql, innerParams] = filtered.getQueryAndParameters();
    const params: unknown[] = [...(innerParams as unknown[])];
    const bind = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const attributeKeys = ATTRIBUTE_KEYS[vertical]
      .map((key) => `'${key.replace(/'/g, "''")}'`)
      .join(', ');
    const bucket = (facet: string, column: string) =>
      `(select '${facet}' as facet, null::text as facet_key, ${column} as value, null::text as label, null::text as color, count(*) as count, null::numeric as num from narrow where ${column} is not null and ${column} <> '' group by ${column} order by count desc limit 100)`;
    const scalar = (facet: string, key: string, where: string) =>
      `(select '${facet}' as facet, '${key}' as facet_key, null::text as value, null::text as label, null::text as color, count(*) filter (where ${where}) as count, null::numeric as num from narrow)`;
    const unions = [
      bucket('brands', 'brand'),
      "(select 'categories' as facet, null::text as facet_key, category_id as value, category_name as label, null::text as color, count(*) as count, null::numeric as num from narrow where (category_name is not null and category_name <> '') or (category_id is not null and category_id <> '') group by category_id, category_name order by count desc limit 100)",
      bucket('conditions', 'condition_value'),
      bucket('types', 'part_type'),
      bucket('sourceFiles', 'source_file'),
      bucket('formats', 'format'),
      bucket('locations', 'location'),
      bucket('mpns', 'mpn'),
      "(select 'teams' as facet, null::text as facet_key, f.team_id::text as value, t.name as label, t.color as color, count(*) as count, null::numeric as num from narrow f join teams t on t.id = f.team_id group by f.team_id, t.name, t.color order by count desc limit 100)",
      bucket('shippingProfiles', 'shipping_profile'),
      bucket('validationStatuses', 'validation_status'),
      scalar('stockLevels', 'in_stock', 'qty > 0'),
      scalar('stockLevels', 'low_stock', 'qty > 0 and qty <= 2'),
      scalar('stockLevels', 'out_of_stock', 'qty <= 0'),
      scalar('catalogStatuses', 'published', 'is_published and not is_blocked'),
      scalar(
        'catalogStatuses',
        'unpublished',
        'not is_published and not is_blocked',
      ),
      scalar('catalogStatuses', 'blocked', 'is_blocked'),
      scalar(
        'catalogStatuses',
        'ready_to_publish',
        'not is_published and not is_blocked and image_count > 0',
      ),
      scalar(
        'catalogStatuses',
        'need_images',
        'not is_published and not is_blocked and image_count is null',
      ),
      scalar('total', 'all', 'true'),
      "(select 'price' as facet, 'min' as facet_key, null::text as value, null::text as label, null::text as color, null::bigint as count, min(price) as num from narrow)",
      "(select 'price' as facet, 'max' as facet_key, null::text as value, null::text as label, null::text as color, null::bigint as count, max(price) as num from narrow)",
      `(select 'attribute' as facet, attrs.key as facet_key, attr_values.value as value, null::text as label, null::text as color, count(*) as count, null::numeric as num from filtered cross join lateral jsonb_each(coalesce(filtered.vertical_attributes, '{}'::jsonb)) attrs cross join lateral jsonb_array_elements_text(case when jsonb_typeof(attrs.value) = 'array' then attrs.value else jsonb_build_array(attrs.value #>> '{}') end) attr_values where attrs.key in (${attributeKeys}) group by attrs.key, attr_values.value order by attrs.key, count(*) desc)`,
    ];
    // Marketplace facets join through the caller's accessible stores. A caller
    // with no accessible stores still gets the product facets, just no
    // marketplace buckets.
    if (scope.accessibleStoreIds?.length !== 0) {
      const organizationRef = bind(scope.organizationId);
      const verticalRef = bind(vertical);
      const storeFilter = scope.accessibleStoreIds?.length
        ? ` and facet_account.primary_store_id = any(${bind(scope.accessibleStoreIds)})`
        : '';
      unions.push(
        `(select 'marketplaces' as facet, null::text as facet_key, facet_channel.marketplace_id as value, facet_channel.marketplace_id as label, null::text as color, count(distinct f.id) as count, null::numeric as num from narrow f join ebay_listing_channels facet_channel on facet_channel.catalog_product_id = f.id and facet_channel.organization_id = ${organizationRef} and facet_channel.vertical = ${verticalRef} join connected_ebay_accounts facet_account on facet_account.id = facet_channel.ebay_account_id and facet_account.organization_id = ${organizationRef}${storeFilter} group by facet_channel.marketplace_id order by count desc)`,
      );
    }
    type FacetSqlRow = {
      facet: string;
      facet_key: string | null;
      value: string | null;
      label: string | null;
      color: string | null;
      count: string | number | null;
      num: string | number | null;
    };
    const rows = await this.productRepo.query<FacetSqlRow[]>(
      `with filtered as materialized (${innerSql}), narrow as materialized (select id, brand, category_id, category_name, condition_value, part_type, source_file, format, location, mpn, team_id, shipping_profile, validation_status, price, qty, image_count, is_published, is_blocked from filtered) ${unions.join(' union all ')}`,
      params,
    );
    const rowsFor = (facet: string) =>
      rows.filter((row) => row.facet === facet);
    const countFor = (facet: string, key: string) =>
      Number(
        rows.find((row) => row.facet === facet && row.facet_key === key)?.count,
      ) || 0;
    const bucketsFor = (facet: string): FacetBucket[] =>
      rowsFor(facet)
        .filter((row) => row.value != null && String(row.value).trim())
        .map((row) => ({
          value: String(row.value),
          label: label(String(row.value)),
          count: Number(row.count) || 0,
        }));
    const priceBound = (key: 'min' | 'max') => {
      const raw = rows.find(
        (row) => row.facet === 'price' && row.facet_key === key,
      )?.num;
      return raw == null ? null : Number(raw);
    };
    const attributeFacets: Record<string, FacetBucket[]> = {};
    for (const row of rowsFor('attribute')) {
      (attributeFacets[String(row.facet_key)] ??= []).push({
        value: row.value as string,
        label: row.value as string,
        count: Number(row.count) || 0,
      });
    }
    const categories = rowsFor('categories').map((row) => ({
      // Filter by the stable category ID while keeping the human name visible.
      value: String(row.value || row.label || ''),
      label: String(row.label || row.value || ''),
      count: Number(row.count) || 0,
    }));
    const teams = rowsFor('teams').map((row) => ({
      value: row.value as string,
      label: row.label as string,
      count: Number(row.count) || 0,
      color: row.color as string,
    }));
    const marketplaces = rowsFor('marketplaces').map((row) => ({
      value: String(row.value),
      label: String(row.value),
      count: Number(row.count) || 0,
    }));
    const stockLevels = ['in_stock', 'low_stock', 'out_of_stock'].map(
      (key) => ({
        value: key,
        label: label(key),
        count: countFor('stockLevels', key),
      }),
    );
    const catalogStatuses = [
      'published',
      'unpublished',
      'blocked',
      'ready_to_publish',
      'need_images',
    ].map((key) => ({
      value: key,
      label: label(key),
      count: countFor('catalogStatuses', key),
    }));
    const response: CatalogFacetsResponse = {
      vertical,
      totalFiltered: countFor('total', 'all'),
      queryTimeMs: Date.now() - started,
      brands: bucketsFor('brands'),
      categories,
      conditions: bucketsFor('conditions'),
      types: bucketsFor('types'),
      sourceFiles: bucketsFor('sourceFiles'),
      formats: bucketsFor('formats'),
      locations: bucketsFor('locations'),
      mpns: bucketsFor('mpns'),
      teams,
      marketplaces,
      shippingProfiles: bucketsFor('shippingProfiles'),
      stockLevels,
      catalogStatuses,
      validationStatuses: bucketsFor('validationStatuses'),
      attributeFacets,
      priceRange: { min: priceBound('min'), max: priceBound('max') },
    };
    // Bound the per-process cache: drop expired entries, then the oldest entry
    // once 200 are held (keys include every filter combination, so an
    // unbounded Map grows with each distinct request).
    const now = Date.now();
    for (const [key, entry] of this.facetCache)
      if (entry.expiresAt <= now) this.facetCache.delete(key);
    if (this.facetCache.size >= 200) {
      const oldest = this.facetCache.keys().next().value;
      if (oldest !== undefined) this.facetCache.delete(oldest);
    }
    this.facetCache.set(cacheKey, {
      expiresAt: now + 30_000,
      value: response,
    });
    return response;
  }

  async summary(
    user: User,
    vertical: ProductVertical,
    organizationId?: string,
  ) {
    const scope = await this.scope(user, organizationId);
    // One scan for all three counts. The published count uses the uncorrelated
    // publishedSql, so it no longer re-reads publication tables per row.
    const row = await this.baseQuery(vertical, {}, scope)
      .select('COUNT(*)', 'total')
      .addSelect(
        'COUNT(*) FILTER (WHERE array_length(p.image_urls, 1) > 0)',
        'withImages',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE ${this.publishedSql(scope)})`,
        'published',
      )
      .setParameters(this.publishedParameters(scope, vertical))
      .getRawOne<{ total: string; withImages: string; published: string }>();
    const total = Number(row?.total) || 0;
    const withImages = Number(row?.withImages) || 0;
    return {
      vertical,
      organizationId: scope.organizationId,
      total,
      withImages,
      missingImages: Math.max(0, total - withImages),
      published: Number(row?.published) || 0,
    };
  }

  async detail(
    user: User,
    vertical: ProductVertical,
    id: string,
    organizationId?: string,
  ) {
    const scope = await this.scope(user, organizationId);
    const product = await this.baseQuery(vertical, {}, scope)
      .andWhere('p.id = :productId', { productId: id })
      .getOne();
    if (!product) throw new NotFoundException('Catalog product not found');
    return this.hydrateItems([product], scope, vertical).then(
      (items) => items[0],
    );
  }

  async patch(
    user: User,
    vertical: ProductVertical,
    id: string,
    dto: CatalogProductPatchDto,
    organizationId?: string,
  ) {
    const scope = await this.scope(user, organizationId);
    const product = await this.findScopedProduct(vertical, id, scope);
    if (product.verticalValidationStatus === 'deleted')
      throw new ConflictException(
        'Deleted catalog products must be restored through the catalog lifecycle action',
      );
    if (vertical === 'fashion')
      await this.fashion.update(user, id, dto as never, scope.organizationId);
    else if (vertical === 'business_industrial')
      await this.businessIndustrial.updateListing(
        user,
        id,
        dto as never,
        scope.organizationId,
      );
    else
      throw new BadRequestException(
        'Catalog inline updates are not available for this vertical',
      );
    return this.detail(user, vertical, id, scope.organizationId);
  }

  async bulkTeam(
    user: User,
    vertical: ProductVertical,
    dto: CatalogBulkTeamDto,
  ) {
    const scope = await this.scope(user, dto.organizationId);
    await this.assertTeamTarget(user, dto.teamId ?? null, scope);
    return this.bulkEach(dto.productIds, async (id) => {
      const product = await this.findScopedProduct(vertical, id, scope);
      this.assertNotQuarantined(product);
      const before = { teamId: product.teamId };
      product.teamId = dto.teamId ?? null;
      await this.productRepo.save(product);
      await this.auditRepo.save(
        this.auditRepo.create({
          organizationId: scope.organizationId,
          catalogProductId: id,
          userId: user.id,
          action: `${vertical}.catalog.assign_team`,
          result: 'success',
          beforeSnapshot: before,
          afterSnapshot: { teamId: product.teamId },
        }),
      );
      return { id, teamId: product.teamId };
    });
  }

  async bulkPolicies(
    user: User,
    vertical: ProductVertical,
    dto: CatalogBulkPoliciesDto,
  ) {
    const scope = await this.scope(user, dto.organizationId);
    if (
      dto.shippingProfile === undefined &&
      dto.paymentProfile === undefined &&
      dto.returnProfile === undefined
    )
      throw new BadRequestException('At least one policy field is required');
    return this.bulkEach(dto.productIds, async (id) => {
      const product = await this.findScopedProduct(vertical, id, scope);
      if (!this.allowBusinessIndustrialOperatorBypass(vertical))
        this.assertNotQuarantined(product);
      const before = {
        shippingProfile: product.shippingProfile,
        paymentProfile: product.paymentProfile,
        returnProfile: product.returnProfile,
      };
      if (dto.shippingProfile !== undefined)
        product.shippingProfile = dto.shippingProfile?.trim() || null;
      if (dto.paymentProfile !== undefined)
        product.paymentProfile = dto.paymentProfile?.trim() || null;
      if (dto.returnProfile !== undefined)
        product.returnProfile = dto.returnProfile?.trim() || null;
      await this.productRepo.save(product);
      await this.auditRepo.save(
        this.auditRepo.create({
          organizationId: scope.organizationId,
          catalogProductId: id,
          userId: user.id,
          action: `${vertical}.catalog.manage_policies`,
          result: 'success',
          beforeSnapshot: before,
          afterSnapshot: {
            shippingProfile: product.shippingProfile,
            paymentProfile: product.paymentProfile,
            returnProfile: product.returnProfile,
          },
        }),
      );
      return {
        id,
        shippingProfile: product.shippingProfile,
        paymentProfile: product.paymentProfile,
        returnProfile: product.returnProfile,
      };
    });
  }

  async bulkDelete(
    user: User,
    vertical: ProductVertical,
    dto: CatalogBulkIdsDto,
  ) {
    const scope = await this.scope(user, dto.organizationId);
    return this.bulkEach(dto.productIds, async (id) => {
      const product = await this.findScopedProduct(vertical, id, scope);
      this.assertNotQuarantined(product);
      const published = await this.channelRepo.exists({
        where: [
          {
            organizationId: scope.organizationId,
            catalogProductId: id,
            vertical,
            listingStatus: 'published',
          },
          ...(vertical === 'automotive'
            ? [
                {
                  organizationId: scope.organizationId,
                  catalogProductId: id,
                  vertical: IsNull(),
                  listingStatus: 'published' as const,
                },
              ]
            : []),
        ],
      });
      if (
        published ||
        product.verticalValidationStatus === 'published' ||
        Boolean(product.ebayItemId?.trim())
      )
        throw new ConflictException(
          'Withdraw marketplace publications before deleting this product',
        );
      const beforeStatus = product.verticalValidationStatus;
      product.verticalValidationStatus = 'deleted';
      await this.productRepo.save(product);
      await this.auditRepo.save(
        this.auditRepo.create({
          organizationId: scope.organizationId,
          catalogProductId: id,
          userId: user.id,
          action: `${vertical}.catalog.delete`,
          result: 'success',
          beforeSnapshot: { verticalValidationStatus: beforeStatus },
          afterSnapshot: { verticalValidationStatus: 'deleted' },
        }),
      );
      return { id, deleted: true };
    });
  }

  async exportCsv(
    user: User,
    vertical: ProductVertical,
    dto: { query?: CatalogQueryDto; productIds?: string[] },
  ) {
    const query = dto.query ?? new CatalogQueryDto();
    const scope = await this.scope(user, query.organizationId);
    const qb = this.baseQuery(vertical, query, scope);
    this.applySearchAndFilters(qb, vertical, query, scope);
    if (dto.productIds?.length)
      qb.andWhere('p.id IN (:...exportProductIds)', {
        exportProductIds: [...new Set(dto.productIds)],
      });
    const products = await qb
      .orderBy('p.updatedAt', 'DESC')
      .addOrderBy('p.id', 'ASC')
      .getMany();
    const items = await this.hydrateItems(products, scope, vertical);
    const keys = new Set<string>([
      'id',
      'sku',
      'title',
      'brand',
      'mpn',
      'category',
      'condition',
      'price',
      'quantity',
      'status',
      'reviewStatus',
      'publicationStatus',
      'team',
      'shippingProfile',
      'paymentProfile',
      'returnProfile',
      'sourceFile',
      'createdAt',
      'updatedAt',
    ]);
    for (const item of items)
      for (const key of Object.keys(item.verticalAttributes))
        keys.add(`attribute_${key}`);
    const columns = [...keys];
    const rows = [columns.map(csv).join(',')];
    for (const item of items) {
      const row: Record<string, unknown> = {
        id: item.id,
        sku: item.sku,
        title: item.title,
        brand: item.brand,
        mpn: item.mpn,
        category: item.categoryName ?? item.categoryId,
        condition: item.conditionLabel ?? item.conditionId,
        price: item.price,
        quantity: item.quantity,
        status: item.verticalValidationStatus,
        reviewStatus: item.reviewStatus,
        publicationStatus: item.publicationStatus,
        team: item.teamName,
        shippingProfile: item.shippingProfile,
        paymentProfile: item.paymentProfile,
        returnProfile: item.returnProfile,
        sourceFile: item.sourceFile,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
      for (const [key, value] of Object.entries(item.verticalAttributes))
        row[`attribute_${key}`] = Array.isArray(value)
          ? value.join(' | ')
          : value;
      rows.push(columns.map((column) => csv(row[column])).join(','));
    }
    return rows.join('\n');
  }

  private baseQuery(
    vertical: ProductVertical,
    dto: Partial<CatalogQueryDto>,
    scope: Scope,
  ) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.organizationId = :organizationId', {
        organizationId: scope.organizationId,
      })
      .andWhere('p.vertical = :vertical', { vertical })
      .andWhere("p.verticalValidationStatus <> 'deleted'");
    // Capture rows remain in intake until an operator explicitly adds them to Catalog.
    // Rows created by earlier versions without this flag stay visible.
    if (vertical === 'fashion')
      qb.andWhere(
        "(COALESCE(p.vertical_attributes->>'_intakeSource', '') <> 'capture' " +
        "OR COALESCE(p.vertical_attributes->>'_catalogAdded', 'true') = 'true')",
      );
    if (!scope.manageAllTeams) {
      if (scope.teamIds.length)
        qb.andWhere('(p.teamId IS NULL OR p.teamId IN (:...visibleTeamIds))', {
          visibleTeamIds: scope.teamIds,
        });
      else qb.andWhere('p.teamId IS NULL');
    }
    return qb;
  }

  private applySearchAndFilters(
    qb: SelectQueryBuilder<CatalogProduct>,
    vertical: ProductVertical,
    dto: Partial<CatalogQueryDto>,
    scope: Scope,
  ) {
    const q = dto.q?.trim();
    if (q) {
      const contains = `%${this.escapeLike(q)}%`;
      qb.andWhere(
        `(${SEARCH_SOURCE} ILIKE :catalogContains ESCAPE '\\' OR similarity(${SEARCH_SOURCE}, :catalogSearch) > 0.15)`,
        { catalogContains: contains, catalogSearch: q },
      );
      qb.addSelect(
        `CASE WHEN lower(coalesce(p.sku, '')) = lower(:catalogExact) THEN 100 ELSE similarity(${SEARCH_SOURCE}, :catalogSearch) END`,
        'catalogRelevance',
      ).setParameter('catalogExact', q);
    }
    this.inFilter(qb, 'p.brand', dto.brands, 'catalogBrands');
    const categories = split(dto.categories);
    if (categories.length)
      qb.andWhere(
        '(p.categoryId IN (:...catalogCategories) OR p.categoryName IN (:...catalogCategories))',
        { catalogCategories: categories },
      );
    const conditions = split(dto.conditions);
    if (conditions.length)
      qb.andWhere(
        '(p.conditionId IN (:...catalogConditions) OR p.conditionLabel IN (:...catalogConditions))',
        { catalogConditions: conditions },
      );
    this.inFilter(qb, 'p.partType', dto.types, 'catalogTypes');
    this.inFilter(qb, 'p.sourceFile', dto.sourceFiles, 'catalogSourceFiles');
    this.inFilter(qb, 'p.format', dto.formats, 'catalogFormats');
    this.inFilter(qb, 'p.location', dto.locations, 'catalogLocations');
    this.inFilter(qb, 'p.mpn', dto.mpns, 'catalogMpns');
    this.inFilter(
      qb,
      'p.shippingProfile',
      dto.shippingProfiles,
      'catalogShippingProfiles',
    );
    if (
      dto.minPrice != null &&
      dto.maxPrice != null &&
      dto.minPrice > dto.maxPrice
    )
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    if (dto.minPrice != null)
      qb.andWhere(`${SAFE_PRICE} >= :catalogMinPrice`, {
        catalogMinPrice: dto.minPrice,
      });
    if (dto.maxPrice != null)
      qb.andWhere(`${SAFE_PRICE} <= :catalogMaxPrice`, {
        catalogMaxPrice: dto.maxPrice,
      });
    if (dto.hasImage === '1') qb.andWhere('array_length(p.imageUrls, 1) > 0');
    if (dto.hasPrice === '1') qb.andWhere('p.price IS NOT NULL');
    const stock = split(dto.stockLevel);
    if (stock.length) {
      const parts: string[] = [];
      if (stock.includes('in_stock')) parts.push(`${SAFE_QTY} > 0`);
      if (stock.includes('low_stock'))
        parts.push(`(${SAFE_QTY} > 0 AND ${SAFE_QTY} <= 2)`);
      if (stock.includes('out_of_stock')) parts.push(`${SAFE_QTY} <= 0`);
      if (parts.length) qb.andWhere(`(${parts.join(' OR ')})`);
    }
    const status = split(dto.catalogStatus);
    if (status.length) {
      const publishedSql = this.publishedSql(scope);
      const blockedSql =
        "(p.manual_review = true OR p.vertical_validation_status IN ('quarantined', 'blocked', 'rejected'))";
      const parts: string[] = [];
      if (status.includes('published'))
        parts.push(`(${publishedSql} AND NOT ${blockedSql})`);
      if (status.includes('unpublished'))
        parts.push(`(NOT ${publishedSql} AND NOT ${blockedSql})`);
      if (status.includes('blocked')) parts.push(blockedSql);
      if (status.includes('need_images'))
        parts.push(
          '(NOT ' +
            publishedSql +
            ' AND NOT ' +
            blockedSql +
            ' AND array_length(p.imageUrls, 1) IS NULL)',
        );
      if (status.includes('ready_to_publish'))
        parts.push(
          '(NOT ' +
            publishedSql +
            ' AND NOT ' +
            blockedSql +
            ' AND array_length(p.imageUrls, 1) > 0)',
        );
      if (parts.length)
        qb.andWhere('(' + parts.join(' OR ') + ')').setParameters(
          this.publishedParameters(scope, vertical),
        );
    }
    this.inFilter(
      qb,
      'p.verticalValidationStatus',
      dto.validationStatuses,
      'catalogValidationStatuses',
    );
    if (dto.importedFrom)
      qb.andWhere('p.createdAt >= :catalogImportedFrom', {
        catalogImportedFrom: dto.importedFrom,
      });
    if (dto.importedTo)
      qb.andWhere('p.createdAt < :catalogImportedTo', {
        catalogImportedTo: dto.importedTo,
      });
    const marketplaces = split(dto.marketplaces);
    if (marketplaces.length) {
      if (scope.accessibleStoreIds?.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        const channelSql = this.accessibleChannelSql(scope);
        qb.andWhere(
          'exists (select 1 from ebay_listing_channels filteredChannel ' +
            channelSql.join(' ') +
            ' where filteredChannel.catalog_product_id = p.id and filteredChannel.marketplace_id in (:...catalogMarketplaces))',
          { catalogMarketplaces: marketplaces },
        ).setParameter('catalogAccessibleStores', scope.accessibleStoreIds);
      }
    }
    const attrs = parseAttributes(dto.attributes);
    for (const [key, values] of Object.entries(attrs)) {
      const paramKey = `catalogAttr_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
      qb.andWhere(
        `exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p.vertical_attributes -> :${paramKey}) = 'array' then p.vertical_attributes -> :${paramKey} else jsonb_build_array(p.vertical_attributes ->> :${paramKey}) end) attrValue where attrValue in (:...${paramKey}_values))`,
        { [paramKey]: key, [`${paramKey}_values`]: values },
      );
    }
    void vertical;
  }

  private applySort(
    qb: SelectQueryBuilder<CatalogProduct>,
    sort: CatalogSort | undefined,
    hasQuery: boolean,
  ) {
    const resolved = sort ?? (hasQuery ? 'relevance' : 'newest');
    if (resolved === 'relevance' && hasQuery)
      qb.orderBy('"catalogRelevance"', 'DESC');
    else if (resolved === 'title_asc')
      qb.orderBy('p.title', 'ASC', 'NULLS LAST');
    else if (resolved === 'title_desc')
      qb.orderBy('p.title', 'DESC', 'NULLS LAST');
    else if (resolved === 'sku_asc') qb.orderBy('p.sku', 'ASC', 'NULLS LAST');
    else if (resolved === 'price_asc')
      qb.orderBy('p.price', 'ASC', 'NULLS LAST');
    else if (resolved === 'price_desc')
      qb.orderBy('p.price', 'DESC', 'NULLS LAST');
    // "Newest" / "Date added" means creation order; it used to fall through to updatedAt.
    else if (resolved === 'newest') qb.orderBy('p.createdAt', 'DESC');
    else qb.orderBy('p.updatedAt', 'DESC');
    qb.addOrderBy('p.id', 'ASC');
  }

  private inFilter(
    qb: SelectQueryBuilder<CatalogProduct>,
    column: string,
    raw: string | undefined,
    parameter: string,
  ) {
    const values = split(raw);
    if (values.length)
      qb.andWhere(`${column} IN (:...${parameter})`, { [parameter]: values });
  }

  private async scope(
    user: User,
    organizationId?: string,
    requestedTeams?: string,
  ): Promise<Scope> {
    const org = await this.organizations.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const manageAllTeams = await this.rbac.userHasPermission(
      user.id,
      'teams.manage',
    );
    const teamIds = await this.teams.getUserTeamIds(user.id);
    const requested = split(requestedTeams);
    if (
      requested.length &&
      !manageAllTeams &&
      requested.some((id) => !teamIds.includes(id))
    )
      throw new ForbiddenException(
        'You do not have access to one or more selected teams',
      );
    const accessibleStoreIds = await this.storeAccess.resolveStoreFilter(user);
    return {
      organizationId: org.organizationId,
      teamIds: requested.length ? requested : teamIds,
      manageAllTeams,
      accessibleStoreIds,
    };
  }

  private async findScopedProduct(
    vertical: ProductVertical,
    id: string,
    scope: Scope,
  ) {
    const qb = this.baseQuery(vertical, {}, scope).andWhere(
      'p.id = :productId',
      { productId: id },
    );
    const product = await qb.getOne();
    if (!product)
      throw new NotFoundException(
        'Catalog product not found or not authorized',
      );
    return product;
  }

  private async hydrateItems(
    products: CatalogProduct[],
    scope: Scope,
    vertical: ProductVertical,
  ): Promise<CatalogItem[]> {
    if (!products.length) return [];
    const ids = products.map((product) => product.id);
    const teams = await this.teamRepo.find({
      where: {
        id: In(
          products
            .map((product) => product.teamId)
            .filter((id): id is string => Boolean(id)),
        ),
      },
    });
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const reviews =
      vertical === 'fashion'
        ? await this.fashionReviewRepo.find({
            where: {
              organizationId: scope.organizationId,
              catalogProductId: In(ids),
            },
          })
        : vertical === 'business_industrial'
          ? await this.businessReviewRepo.find({
              where: {
                organizationId: scope.organizationId,
                catalogProductId: In(ids),
              },
            })
          : [];
    const reviewMap = new Map<
      string,
      FashionReview | BusinessIndustrialReview
    >();
    for (const review of reviews)
      reviewMap.set(review.catalogProductId, review);
    const publications = await this.publications(products, scope, vertical);
    return products.map((product) => {
      const productPublications = publications.get(product.id) ?? [];
      const review = reviewMap.get(product.id);
      const status = resolvePublicationStatus({
        verticalValidationStatus: product.verticalValidationStatus,
        manualReview: product.manualReview,
        ebayItemId: product.ebayItemId,
        publications: productPublications,
      });
      if (
        status === 'published' &&
        product.ebayItemId &&
        !productPublications.some((publication) =>
          isLivePublicationStatus(publication.listingStatus),
        )
      ) {
        productPublications.push({
          id: product.id,
          storeName: 'eBay',
          marketplaceId: 'EBAY_US',
          listingStatus: 'published',
          listingUrl: `https://www.ebay.com/itm/${product.ebayItemId}`,
          offerId: null,
          listingId: product.ebayItemId,
          lastErrorMessage: null,
          updatedAt: product.updatedAt,
        });
      }
      return {
        id: product.id,
        vertical: product.vertical,
        sku: product.sku,
        title: product.title,
        description: product.description,
        brand: product.brand,
        mpn: product.mpn,
        conditionId: product.conditionId,
        conditionLabel: product.conditionLabel,
        price: product.price,
        quantity: product.quantity,
        imageUrls: (product.imageUrls ?? [])
          .map((url) => String(url || '').trim())
          .filter((url) => Boolean(url) && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api/'))),
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        partType: product.partType,
        location: product.location,
        format: product.format,
        shippingProfile: product.shippingProfile,
        paymentProfile: product.paymentProfile,
        returnProfile: product.returnProfile,
        sourceFile: product.sourceFile,
        sourceRow: product.sourceRow,
        importId: product.importId,
        pipelineJobId: product.pipelineJobId,
        teamId: product.teamId,
        teamName: teamMap.get(product.teamId ?? '')?.name ?? null,
        teamColor: teamMap.get(product.teamId ?? '')?.color ?? null,
        verticalAttributes: product.verticalAttributes ?? {},
        verticalValidationStatus: product.verticalValidationStatus,
        manualReview: product.manualReview,
        readinessScore:
          product.readinessScore == null
            ? null
            : Number(product.readinessScore) * 100,
        seoScore:
          product.seoScore == null ? null : Number(product.seoScore) * 100,
        reviewStatus: review?.status ?? null,
        publicationStatus: status,
        publications: productPublications,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });
  }

  private async publications(
    products: CatalogProduct[],
    scope: Scope,
    vertical: ProductVertical,
  ) {
    const ids = products.map((product) => product.id);
    const skus = [
      ...new Set(
        products
          .map((product) => product.sku?.trim())
          .filter((sku): sku is string => Boolean(sku)),
      ),
    ];
    const ebayItemIds = [
      ...new Set(
        products
          .map((product) => product.ebayItemId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const rows = ids.length
      ? await this.channelRepo.find({
          where: [
            {
              organizationId: scope.organizationId,
              catalogProductId: In(ids),
              vertical,
            },
            ...(vertical === 'automotive'
              ? [
                  {
                    organizationId: scope.organizationId,
                    catalogProductId: In(ids),
                    vertical: IsNull(),
                  },
                ]
              : []),
          ],
          order: { updatedAt: 'DESC' },
        })
      : [];
    // Some older publishers and the listings sync write to
    // ebay_published_listings instead of ebay_listing_channels. Include both
    // projections so an item that is live on eBay cannot appear unpublished in
    // the catalog merely because the newer channel row was not backfilled.
    const legacyRows = ids.length
      ? await this.publishedListingRepo.find({
          where: [
            {
              organizationId: scope.organizationId,
              catalogProductId: In(ids),
            },
            ...(ebayItemIds.length
              ? [
                  {
                    organizationId: scope.organizationId,
                    ebayItemId: In(ebayItemIds),
                  },
                ]
              : []),
          ],
          order: { updatedAt: 'DESC' },
        })
      : [];
    const listingRows = skus.length
      ? await this.listingRepo.find({
          where: [
            {
              organizationId: scope.organizationId,
              customLabelSku: In(skus),
              vertical,
            },
            ...(vertical === 'automotive'
              ? [
                  {
                    organizationId: scope.organizationId,
                    customLabelSku: In(skus),
                    vertical: IsNull(),
                  },
                ]
              : []),
          ],
          order: { updatedAt: 'DESC' },
        })
      : [];
    const skuToProductId = new Map<string, string>();
    const ebayItemToProductId = new Map<string, string>();
    for (const product of products) {
      if (product.sku?.trim()) skuToProductId.set(product.sku.trim(), product.id);
      if (product.ebayItemId?.trim())
        ebayItemToProductId.set(product.ebayItemId.trim(), product.id);
    }
    const accountIds = [
      ...new Set([
        ...rows.map((row) => row.ebayAccountId),
        ...legacyRows.map((row) => row.ebayAccountId),
      ]),
    ];
    const accounts = accountIds.length
      ? await this.accountRepo.find({
          where: { organizationId: scope.organizationId, id: In(accountIds) },
          relations: ['primaryStore'],
        })
      : [];
    const accountMap = new Map(
      accounts.map((account) => [account.id, account]),
    );
    const byKey = new Map<string, PublicationSummary>();
    const add = (
      productId: string,
      accountId: string,
      summary: PublicationSummary,
    ) => {
      const key = `${productId}:${accountId}:${summary.marketplaceId}`;
      const existing = byKey.get(key);
      if (
        !existing ||
        (!isLivePublicationStatus(existing.listingStatus) &&
          isLivePublicationStatus(summary.listingStatus)) ||
        (!existing.listingUrl && summary.listingUrl)
      ) {
        byKey.set(key, summary);
      }
    };
    const storeAllowed = (storeId: string | null | undefined) =>
      !scope.accessibleStoreIds?.length ||
      (Boolean(storeId) && scope.accessibleStoreIds.includes(storeId!));
    for (const row of rows) {
      const account = accountMap.get(row.ebayAccountId);
      if (!storeAllowed(account?.primaryStoreId)) continue;
      add(row.catalogProductId, row.ebayAccountId, {
        id: row.id,
        storeName:
          account?.primaryStore?.storeName ??
          account?.accountDisplayName ??
          'eBay',
        marketplaceId: row.marketplaceId,
        listingStatus: row.listingStatus,
        listingUrl:
          row.listingUrl ||
          (row.listingId ? `https://www.ebay.com/itm/${row.listingId}` : null),
        offerId: row.offerId,
        listingId: row.listingId,
        lastErrorMessage: row.lastErrorMessage,
        updatedAt: row.updatedAt,
      });
    }
    for (const row of legacyRows) {
      const productId =
        row.catalogProductId ||
        (row.ebayItemId ? ebayItemToProductId.get(row.ebayItemId) : undefined);
      if (!productId) continue;
      const account = accountMap.get(row.ebayAccountId);
      if (!storeAllowed(account?.primaryStoreId ?? row.storeId)) continue;
      add(productId, row.ebayAccountId, {
        id: row.id,
        storeName:
          account?.primaryStore?.storeName ??
          account?.accountDisplayName ??
          'eBay',
        marketplaceId: row.marketplaceId,
        listingStatus: row.listingStatus,
        listingUrl:
          row.listingUrl ||
          (row.ebayItemId
            ? `https://www.ebay.com/itm/${row.ebayItemId}`
            : null),
        offerId: row.offerId,
        listingId: row.ebayItemId,
        lastErrorMessage: null,
        updatedAt: row.updatedAt,
      });
    }
    for (const row of listingRows) {
      const sku = row.customLabelSku?.trim();
      const productId = sku ? skuToProductId.get(sku) : undefined;
      const listingId = row.ebayListingId?.trim();
      if (!productId || !listingId) continue;
      if (row.status === 'delisted' || row.status === 'archived') continue;
      add(productId, `listing:${row.id}`, {
        id: row.id,
        storeName: 'eBay',
        marketplaceId: row.marketplace ?? 'EBAY_US',
        listingStatus:
          row.status === 'published' || listingId ? 'published' : row.status,
        listingUrl: `https://www.ebay.com/itm/${listingId}`,
        offerId: null,
        listingId,
        lastErrorMessage: null,
        updatedAt: row.updatedAt,
      });
    }
    const output = new Map<string, PublicationSummary[]>();
    for (const [key, summary] of byKey) {
      const productId = key.split(':', 1)[0];
      const list = output.get(productId) ?? [];
      list.push(summary);
      output.set(productId, list);
    }
    return output;
  }

  private accessibleChannelSql(scope: Scope): string[] {
    const sql = [
      'join connected_ebay_accounts filteredAccount on filteredAccount.id = filteredChannel.ebay_account_id and filteredAccount.organization_id = filteredChannel.organization_id',
      'join stores filteredStore on filteredStore.id = filteredAccount.primary_store_id',
    ];
    if (scope.accessibleStoreIds)
      sql.push('and filteredStore.id in (:...catalogAccessibleStores)');
    sql.push(
      'and filteredChannel.organization_id = :organizationId',
      'and filteredChannel.vertical = :vertical',
    );
    return sql;
  }

  private publishedSql(scope: Scope) {
    const storePredicate = scope.accessibleStoreIds?.length
      ? ' and pubAccount.primary_store_id in (:...publishedStoreIds)'
      : '';
    const legacyStorePredicate = scope.accessibleStoreIds?.length
      ? ' and legacy.store_id in (:...publishedStoreIds)'
      : '';
    // Uncorrelated IN-subqueries. PostgreSQL evaluates each one once per
    // statement as a hash lookup. The former correlated EXISTS form re-read
    // ebay_published_listings for every catalog row, which ran past 120s for a
    // single fashion org on 2026-11-22. The ebay_item_id branch is covered by
    // `p.ebay_item_id IS NOT NULL`, so it is not repeated. Each subquery filters
    // out NULL keys so the predicate can never evaluate to NULL.
    return (
      "(p.vertical_validation_status = 'published' OR p.ebay_item_id IS NOT NULL" +
      " OR p.id IN (select pub.catalog_product_id from ebay_listing_channels pub join connected_ebay_accounts pubAccount on pubAccount.id = pub.ebay_account_id and pubAccount.organization_id = pub.organization_id where pub.organization_id = :publishedOrganizationId and (pub.vertical = :publishedVertical or (:includeLegacyNullVertical = true and pub.vertical is null)) and pub.catalog_product_id is not null and lower(pub.listing_status) in ('published', 'active', 'out_of_stock')" +
      storePredicate +
      ')' +
      " OR p.id IN (select legacy.catalog_product_id from ebay_published_listings legacy where legacy.organization_id = :publishedOrganizationId and legacy.catalog_product_id is not null and lower(legacy.listing_status) in ('active', 'out_of_stock', 'published')" +
      legacyStorePredicate +
      ')' +
      ' OR (p.sku IS NOT NULL AND p.sku IN (select lr."customLabelSku" from listing_records lr where (lr.organization_id = :publishedOrganizationId or (:includeLegacyNullVertical = true and lr.organization_id is null)) and (lr.vertical = :publishedVertical or (:includeLegacyNullVertical = true and lr.vertical is null)) and lr."customLabelSku" is not null and lr."ebayListingId" is not null and lr.status not in (\'delisted\', \'archived\'))))'
    );
  }

  private publishedParameters(scope: Scope, vertical: ProductVertical) {
    return {
      publishedOrganizationId: scope.organizationId,
      publishedVertical: vertical,
      includeLegacyNullVertical: vertical === 'automotive',
      ...(scope.accessibleStoreIds?.length
        ? { publishedStoreIds: scope.accessibleStoreIds }
        : {}),
    };
  }

  private async assertTeamTarget(
    user: User,
    teamId: string | null,
    scope: Scope,
  ) {
    if (!teamId) return;
    const team = await this.teamRepo.findOne({
      where: { id: teamId, active: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (!scope.manageAllTeams)
      await this.teams.assertUserCanAccessTeam(user.id, teamId, false);
  }

  private assertNotQuarantined(product: CatalogProduct) {
    if (
      product.manualReview ||
      product.verticalValidationStatus === 'quarantined'
    )
      throw new ForbiddenException(
        'Quarantined products require the vertical incident workflow',
      );
  }

  private allowBusinessIndustrialOperatorBypass(vertical: ProductVertical) {
    return (
      vertical === 'business_industrial' &&
      process.env.BUSINESS_INDUSTRIAL_ALLOW_UNAPPROVED_PUBLISH === 'true'
    );
  }

  private async bulkEach(
    ids: string[],
    action: (id: string) => Promise<Record<string, unknown>>,
  ) {
    const results: Array<Record<string, unknown>> = [];
    for (const id of [...new Set(ids)]) {
      try {
        results.push({ ...(await action(id)), success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Operation failed',
        });
      }
    }
    return {
      results,
      succeeded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
    };
  }

  private escapeLike(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  private auditLog() {
    return this.auditRepo;
  }
}

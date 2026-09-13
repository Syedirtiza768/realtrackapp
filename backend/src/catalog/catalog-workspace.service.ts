import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayListingChannel } from '../integrations/ebay/entities/ebay-listing-channel.entity.js';
import { ListingActionLog } from '../integrations/ebay/entities/listing-action-log.entity.js';
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
    'size',
    'color',
    'material',
    'style',
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
    const base = this.baseQuery(vertical, dto, scope);
    this.applySearchAndFilters(base, vertical, dto, scope);
    const run = async (column: string, extra = ''): Promise<FacetBucket[]> => {
      const facet = base
        .clone()
        .select(column, 'value')
        .addSelect('COUNT(*)', 'count')
        .andWhere(extra || `${column} IS NOT NULL AND ${column} != ''`)
        .groupBy(column)
        .orderBy('count', 'DESC')
        .limit(100);
      const rows = await facet.getRawMany<{ value: string; count: string }>();
      return rows
        .filter((row) => row.value != null && String(row.value).trim())
        .map((row) => ({
          value: String(row.value),
          label: label(String(row.value)),
          count: Number(row.count) || 0,
        }));
    };
    const [
      brands,
      categoriesRaw,
      conditions,
      types,
      sourceFiles,
      formats,
      locations,
      mpns,
      teams,
      shippingProfiles,
      stockLevels,
      catalogStatuses,
      validationStatuses,
      priceRaw,
      totalFiltered,
    ] = await Promise.all([
      run('p.brand'),
      base
        .clone()
        .select('p.categoryId', 'id')
        .addSelect('p.categoryName', 'value')
        .addSelect('COUNT(*)', 'count')
        .andWhere(
          "(p.categoryName IS NOT NULL AND p.categoryName != '') OR (p.categoryId IS NOT NULL AND p.categoryId != '')",
        )
        .groupBy('p.categoryId')
        .addGroupBy('p.categoryName')
        .orderBy('count', 'DESC')
        .limit(100)
        .getRawMany<{ id: string; value: string; count: string }>(),
      // B&I (and some imports) store human labels with null condition IDs.
      // Facet on the coalesced display value so filters stay populated.
      base
        .clone()
        .select(
          "coalesce(nullif(p.condition_label, ''), nullif(p.condition_id, ''))",
          'value',
        )
        .addSelect('COUNT(*)', 'count')
        .andWhere(
          "(p.condition_label IS NOT NULL AND p.condition_label != '') OR (p.condition_id IS NOT NULL AND p.condition_id != '')",
        )
        .groupBy(
          "coalesce(nullif(p.condition_label, ''), nullif(p.condition_id, ''))",
        )
        .orderBy('count', 'DESC')
        .limit(100)
        .getRawMany<{ value: string; count: string }>()
        .then((rows) =>
          rows
            .filter((row) => row.value != null && String(row.value).trim())
            .map((row) => ({
              value: String(row.value),
              label: label(String(row.value)),
              count: Number(row.count) || 0,
            })),
        ),
      run('p.partType'),
      run('p.sourceFile'),
      run('p.format'),
      run('p.location'),
      run('p.mpn'),
      base
        .clone()
        .innerJoin(Team, 'facetTeam', 'facetTeam.id = p.teamId')
        .select('p.teamId', 'value')
        .addSelect('facetTeam.name', 'label')
        .addSelect('facetTeam.color', 'color')
        .addSelect('COUNT(*)', 'count')
        .groupBy('p.teamId')
        .addGroupBy('facetTeam.name')
        .addGroupBy('facetTeam.color')
        .orderBy('count', 'DESC')
        .limit(100)
        .getRawMany<{
          value: string;
          label: string;
          color: string;
          count: string;
        }>()
        .then((rows) =>
          rows.map((row) => ({
            value: row.value,
            label: row.label,
            count: Number(row.count) || 0,
            color: row.color,
          })),
        ),
      run('p.shippingProfile'),
      Promise.resolve(
        ['in_stock', 'low_stock', 'out_of_stock'].map((value) => ({
          value,
          label: label(value),
          count: 0,
        })),
      ),
      Promise.resolve(
        ['published', 'ready_to_publish', 'need_images'].map((value) => ({
          value,
          label: label(value),
          count: 0,
        })),
      ),
      run('p.verticalValidationStatus'),
      base
        .clone()
        .select(`MIN(${SAFE_PRICE})`, 'min')
        .addSelect(`MAX(${SAFE_PRICE})`, 'max')
        .getRawOne<{ min: string | null; max: string | null }>(),
      base.clone().getCount(),
    ]);
    const [stockCounts, statusCounts, attributeFacets] = await Promise.all([
      this.countStockLevels(base),
      this.countCatalogStatuses(base, vertical, scope),
      this.attributeFacets(base, vertical),
    ]);
    const safeStockCounts = stockCounts as Record<string, number>;
    const safeStatusCounts = statusCounts as Record<string, number>;
    const value: CatalogFacetsResponse = {
      vertical,
      totalFiltered,
      queryTimeMs: Date.now() - started,
      brands,
      categories: categoriesRaw.map((row) => ({
        // Filter by the stable category ID while keeping the human name visible.
        value: row.id || row.value,
        label: row.value || row.id,
        count: Number(row.count) || 0,
      })),
      conditions,
      types,
      sourceFiles,
      formats,
      locations,
      mpns,
      teams,
      marketplaces: await this.marketplaceFacets(base, scope, vertical),
      shippingProfiles,
      stockLevels: stockLevels.map((entry) => ({
        ...entry,
        count: safeStockCounts[entry.value] ?? 0,
      })),
      catalogStatuses: catalogStatuses.map((entry) => ({
        ...entry,
        count: safeStatusCounts[entry.value] ?? 0,
      })),
      validationStatuses,
      attributeFacets,
      priceRange: {
        min: priceRaw?.min == null ? null : Number(priceRaw.min),
        max: priceRaw?.max == null ? null : Number(priceRaw.max),
      },
    };
    this.facetCache.set(cacheKey, { expiresAt: Date.now() + 30_000, value });
    return value;
  }

  async summary(
    user: User,
    vertical: ProductVertical,
    organizationId?: string,
  ) {
    const scope = await this.scope(user, organizationId);
    const qb = this.baseQuery(vertical, {}, scope);
    const [total, withImages, published] = await Promise.all([
      qb.clone().getCount(),
      qb.clone().andWhere('array_length(p.imageUrls, 1) > 0').getCount(),
      qb
        .clone()
        .andWhere(this.publishedSql(scope))
        .setParameters(this.publishedParameters(scope, vertical))
        .getCount(),
    ]);
    return {
      vertical,
      organizationId: scope.organizationId,
      total,
      withImages,
      missingImages: Math.max(0, total - withImages),
      published,
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
        where: {
          organizationId: scope.organizationId,
          catalogProductId: id,
          vertical,
          listingStatus: 'published',
        },
      });
      if (published || product.verticalValidationStatus === 'published')
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
      const parts: string[] = [];
      if (status.includes('published')) parts.push(publishedSql);
      if (status.includes('need_images'))
        parts.push(
          '(NOT ' + publishedSql + ' AND array_length(p.imageUrls, 1) IS NULL)',
        );
      if (status.includes('ready_to_publish'))
        parts.push(
          '(NOT ' + publishedSql + ' AND array_length(p.imageUrls, 1) > 0)',
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
    const publications = await this.publications(ids, scope, vertical);
    return products.map((product) => {
      const productPublications = publications.get(product.id) ?? [];
      const review = reviewMap.get(product.id);
      const status =
        product.verticalValidationStatus === 'quarantined' ||
        product.manualReview
          ? 'blocked'
          : productPublications.some(
                (publication) => publication.listingStatus === 'published',
              ) || product.verticalValidationStatus === 'published'
            ? 'published'
            : 'unpublished';
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
    ids: string[],
    scope: Scope,
    vertical: ProductVertical,
  ) {
    const rows = await this.channelRepo.find({
      where: {
        organizationId: scope.organizationId,
        catalogProductId: In(ids),
        vertical,
      },
      order: { updatedAt: 'DESC' },
    });
    const accountIds = [...new Set(rows.map((row) => row.ebayAccountId))];
    const accounts = accountIds.length
      ? await this.accountRepo.find({
          where: { organizationId: scope.organizationId, id: In(accountIds) },
          relations: ['primaryStore'],
        })
      : [];
    const accountMap = new Map(
      accounts.map((account) => [account.id, account]),
    );
    const output = new Map<string, PublicationSummary[]>();
    for (const row of rows) {
      const account = accountMap.get(row.ebayAccountId);
      if (!account?.primaryStore) continue;
      if (
        scope.accessibleStoreIds &&
        !scope.accessibleStoreIds.includes(account.primaryStoreId)
      )
        continue;
      const list = output.get(row.catalogProductId) ?? [];
      list.push({
        id: row.id,
        storeName: account.primaryStore.storeName,
        marketplaceId: row.marketplaceId,
        listingStatus: row.listingStatus,
        listingUrl: row.listingUrl,
        offerId: row.offerId,
        listingId: row.listingId,
        lastErrorMessage: row.lastErrorMessage,
        updatedAt: row.updatedAt,
      });
      output.set(row.catalogProductId, list);
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

  private async marketplaceFacets(
    base: SelectQueryBuilder<CatalogProduct>,
    scope: Scope,
    vertical: ProductVertical,
  ): Promise<FacetBucket[]> {
    // TypeORM expands `:...values` to an empty `IN ()` clause when the
    // caller has no accessible stores. A user with no publication-store
    // access should still receive the catalog's product/vertical facets;
    // marketplace facets are simply empty in that scope.
    if (scope.accessibleStoreIds?.length === 0) return [];
    const qb = base
      .clone()
      .innerJoin(
        EbayListingChannel,
        'facetChannel',
        'facetChannel.catalogProductId = p.id AND facetChannel.organizationId = :facetOrg AND facetChannel.vertical = :facetVertical',
      )
      .innerJoin(
        ConnectedEbayAccount,
        'facetAccount',
        'facetAccount.id = facetChannel.ebayAccountId AND facetAccount.organizationId = :facetOrg',
      )
      .select('facetChannel.marketplaceId', 'value')
      .addSelect('COUNT(DISTINCT p.id)', 'count')
      .groupBy('facetChannel.marketplaceId')
      .orderBy('count', 'DESC')
      .setParameters({
        facetOrg: scope.organizationId,
        facetVertical: vertical,
      });
    if (scope.accessibleStoreIds)
      qb.andWhere('facetAccount.primaryStoreId IN (:...facetStores)', {
        facetStores: scope.accessibleStoreIds,
      });
    const rows = await qb.getRawMany<{ value: string; count: string }>();
    return rows.map((row) => ({
      value: row.value,
      label: row.value,
      count: Number(row.count) || 0,
    }));
  }

  private async attributeFacets(
    base: SelectQueryBuilder<CatalogProduct>,
    vertical: ProductVertical,
  ): Promise<Record<string, FacetBucket[]>> {
    const keys = ATTRIBUTE_KEYS[vertical]
      .map((key) => `'${key.replace(/'/g, "''")}'`)
      .join(', ');
    // Select the JSON column explicitly so the derived table has a stable alias.
    // Selecting the full entity gives TypeORM a generated p_vertical_attributes alias.
    const [sql, params] = base
      .clone()
      .select('p.verticalAttributes', 'vertical_attributes')
      .getQueryAndParameters();
    const rawRows: unknown = await this.productRepo.query(
      `select attrs.key as "key", values.value as "value", count(*)::int as "count" from (${sql}) filtered cross join lateral jsonb_each(coalesce(filtered.vertical_attributes, '{}'::jsonb)) attrs cross join lateral jsonb_array_elements_text(case when jsonb_typeof(attrs.value) = 'array' then attrs.value else jsonb_build_array(attrs.value #>> '{}') end) values where attrs.key in (${keys}) group by attrs.key, values.value order by attrs.key, count(*) desc`,
      params,
    );
    const rows = (Array.isArray(rawRows) ? rawRows : []) as Array<{
      key: string;
      value: string;
      count: number | string;
    }>;
    const result: Record<string, FacetBucket[]> = {};
    for (const row of rows as Array<{
      key: string;
      value: string;
      count: number | string;
    }>) {
      (result[row.key] ??= []).push({
        value: row.value,
        label: row.value,
        count: Number(row.count) || 0,
      });
    }
    return result;
  }

  private async countStockLevels(base: SelectQueryBuilder<CatalogProduct>) {
    const rows = await Promise.all([
      base.clone().andWhere(`${SAFE_QTY} > 0`).getCount(),
      base.clone().andWhere(`${SAFE_QTY} > 0 AND ${SAFE_QTY} <= 2`).getCount(),
      base.clone().andWhere(`${SAFE_QTY} <= 0`).getCount(),
    ]);
    return { in_stock: rows[0], low_stock: rows[1], out_of_stock: rows[2] };
  }

  private async countCatalogStatuses(
    base: SelectQueryBuilder<CatalogProduct>,
    vertical: ProductVertical,
    scope: Scope,
  ) {
    const publishedSql = this.publishedSql(scope);
    const published = base
      .clone()
      .andWhere(publishedSql)
      .setParameters(this.publishedParameters(scope, vertical))
      .getCount();
    const notPublished = base
      .clone()
      .andWhere('NOT ' + publishedSql)
      .setParameters(this.publishedParameters(scope, vertical));
    const [publishedCount, readyCount, missingCount] = await Promise.all([
      published,
      notPublished
        .clone()
        .andWhere('array_length(p.imageUrls, 1) > 0')
        .getCount(),
      notPublished.andWhere('array_length(p.imageUrls, 1) IS NULL').getCount(),
    ]);
    return {
      published: publishedCount,
      ready_to_publish: readyCount,
      need_images: missingCount,
    };
  }

  private publishedSql(scope: Scope) {
    const storePredicate = scope.accessibleStoreIds
      ? scope.accessibleStoreIds.length
        ? 'and pubAccount.primary_store_id in (:...publishedStoreIds)'
        : 'and 1 = 0'
      : '';
    return (
      "(p.vertical_validation_status = 'published' OR exists (select 1 from ebay_listing_channels pub join connected_ebay_accounts pubAccount on pubAccount.id = pub.ebay_account_id and pubAccount.organization_id = pub.organization_id where pub.catalog_product_id = p.id and pub.organization_id = p.organization_id and pub.vertical = :publishedVertical and pub.listing_status = 'published' " +
      storePredicate +
      '))'
    );
  }

  private publishedParameters(scope: Scope, vertical: ProductVertical) {
    return {
      publishedVertical: vertical,
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

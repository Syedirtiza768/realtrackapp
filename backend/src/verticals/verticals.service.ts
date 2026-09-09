import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import { EbaySellingMetadataService } from '../channels/ebay/ebay-selling-metadata.service.js';
import type { EbayAspect } from '../channels/ebay/ebay-api.types.js';
import {
  attributesFromImportRow,
  DEFAULT_VERTICAL_CONFIG,
  normalizeVerticalConfig,
  validateVerticalAttributes,
  VERTICAL_PROFILES,
} from './vertical.config.js';
import {
  DEFAULT_PRODUCT_VERTICAL,
  isProductVertical,
  normalizeProductVertical,
} from './vertical.types.js';
import type {
  ProductAttributes,
  ProductVertical,
  VerticalCategoryMetadata,
  VerticalConfig,
  VerticalPublishProjection,
} from './vertical.types.js';
import { isRestrictedBusinessIndustrialFamily, validateBusinessIndustrialAttributes } from './business-industrial.config.js';
import { ProductFamily } from './entities/product-family.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { VariantMarketplaceMapping } from './entities/variant-marketplace-mapping.entity.js';
import { ProductMarketplaceCategory } from './entities/product-marketplace-category.entity.js';
import { BusinessIndustrialReview } from './entities/business-industrial-review.entity.js';
import { Repository } from 'typeorm';

type ProductLike = Pick<CatalogProduct, 'vertical' | 'verticalAttributes' | 'verticalValidationStatus' | 'manualReview' | 'title' | 'description' | 'brand' | 'mpn' | 'price' | 'quantity' | 'categoryId' | 'categoryName' | 'conditionId' | 'conditionLabel' | 'imageUrls'>;

@Injectable()
export class VerticalsService {
  private readonly logger = new Logger(VerticalsService.name);
  private readonly metadataCache = new Map<string, { value: VerticalCategoryMetadata; expiresAt: number }>();
  private readonly metadataTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly taxonomy: EbayTaxonomyApiService,
    private readonly sellingMetadata: EbaySellingMetadataService,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount) private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(CatalogProduct) private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord) private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ProductFamily) private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(ProductVariant) private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(VariantMarketplaceMapping) private readonly mappingRepo: Repository<VariantMarketplaceMapping>,
    @InjectRepository(ProductMarketplaceCategory) private readonly categoryRepo: Repository<ProductMarketplaceCategory>,
    @InjectRepository(BusinessIndustrialReview) private readonly businessIndustrialReviewRepo: Repository<BusinessIndustrialReview>,
  ) {}

  async assertFeatureEnabled(): Promise<void> {
    if (!(await this.featureFlags.isEnabled('multi_vertical_catalog'))) {
      throw new ServiceUnavailableException(
        'Business & Industrial and Fashion workflows are disabled. Enable the multi_vertical_catalog feature flag before configuring a pilot store.',
      );
    }
  }

  async assertIntakeVerticalEnabled(vertical: ProductVertical, storeId?: string): Promise<void> {
    if (vertical === DEFAULT_PRODUCT_VERTICAL) return;
    await this.assertFeatureEnabled();
    if (!storeId) return;
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    const config = this.getStoreConfig(store);
    if (!config.enabledVerticals.includes(vertical)) {
      throw new BadRequestException(
        `${VERTICAL_PROFILES[vertical].label} is not enabled for store ${store.storeName}`,
      );
    }
  }

  getProfiles() {
    return Object.values(VERTICAL_PROFILES);
  }

  getStoreConfig(store: Store): VerticalConfig {
    return normalizeVerticalConfig(store.verticalConfig ?? DEFAULT_VERTICAL_CONFIG);
  }

  async listStoresForOrganization(organizationId: string): Promise<Array<Store & { verticalConfig: VerticalConfig }>> {
    const stores = await this.storeRepo
      .createQueryBuilder('store')
      .leftJoinAndMapOne('store.ebayAccount', ConnectedEbayAccount, 'account', 'account.primary_store_id = store.id')
      .where('store.organization_id = :organizationId OR account.organization_id = :organizationId', { organizationId })
      .orderBy('store.is_primary', 'DESC')
      .addOrderBy('store.store_name', 'ASC')
      .getMany();
    return stores.map((store) => ({ ...store, verticalConfig: this.getStoreConfig(store) }));
  }

  async getStoreConfigForOrganization(storeId: string, organizationId: string): Promise<VerticalConfig> {
    const store = await this.assertStoreOrganization(storeId, organizationId);
    return this.getStoreConfig(store);
  }

  async updateFashionStoreConfig(
    storeId: string,
    organizationId: string,
    enabled: boolean,
  ): Promise<VerticalConfig> {
    const store = await this.assertStoreOrganization(storeId, organizationId);
    const current = this.getStoreConfig(store);
    if (enabled) await this.assertFeatureEnabled();
    const enabledVerticals = enabled
      ? [...new Set([...current.enabledVerticals, 'fashion' as ProductVertical])]
      : current.enabledVerticals.filter((vertical) => vertical !== 'fashion');
    const defaultVertical =
      enabled || current.defaultVertical !== 'fashion'
        ? current.defaultVertical
        : DEFAULT_PRODUCT_VERTICAL;
    const next = normalizeVerticalConfig({
      ...current,
      enabledVerticals,
      defaultVertical,
    });
    store.verticalConfig = next;
    await this.storeRepo.save(store);
    return next;
  }

  async updateStoreConfig(
    storeId: string,
    organizationId: string,
    patch: Partial<VerticalConfig>,
  ): Promise<VerticalConfig> {
    const store = await this.assertStoreOrganization(storeId, organizationId);
    const current = this.getStoreConfig(store);
    const next = normalizeVerticalConfig({ ...current, ...patch });
    const newVerticals = next.enabledVerticals.filter((v) => v !== DEFAULT_PRODUCT_VERTICAL);
    if (newVerticals.length || next.defaultVertical !== DEFAULT_PRODUCT_VERTICAL) {
      await this.assertFeatureEnabled();
    }
    if (!next.enabledVerticals.includes(next.defaultVertical)) {
      throw new BadRequestException('The store default vertical must be enabled for that store');
    }
    store.verticalConfig = next;
    await this.storeRepo.save(store);
    return next;
  }

  resolveVertical(
    product: Pick<ProductLike, 'vertical'> | null | undefined,
    listing: Pick<ListingRecord, 'vertical'> | null | undefined,
    frozenVertical?: ProductVertical | null,
  ): ProductVertical {
    if (frozenVertical && isProductVertical(frozenVertical)) return frozenVertical;
    if (product?.vertical && isProductVertical(product.vertical)) return product.vertical;
    if (listing?.vertical && isProductVertical(listing.vertical)) return listing.vertical;
    return DEFAULT_PRODUCT_VERTICAL;
  }

  normalizeIntakeVertical(value: unknown): ProductVertical {
    const vertical = normalizeProductVertical(value);
    if (value != null && typeof value === 'string' && !isProductVertical(value) && vertical === DEFAULT_PRODUCT_VERTICAL) {
      const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
      if (!['auto', 'motors', 'automotive'].includes(normalized)) {
        throw new BadRequestException(`Unsupported product vertical "${value}"`);
      }
    }
    return vertical;
  }

  buildAttributes(vertical: ProductVertical, data: Record<string, string>): ProductAttributes {
    const candidate = attributesFromImportRow(vertical, data);
    const validated = validateVerticalAttributes(vertical, candidate);
    if (validated.errors.length) throw new BadRequestException(validated.errors);
    return validated.attributes;
  }

  async buildPublishProjection(params: {
    vertical: ProductVertical;
    product: ProductLike;
    listing: ListingRecord | null;
    storeId: string;
    marketplaceId: string;
  }): Promise<VerticalPublishProjection | null> {
    if (params.vertical === DEFAULT_PRODUCT_VERTICAL) return null;
    await this.assertIntakeVerticalEnabled(params.vertical, params.storeId);

    const productAttributes = validateVerticalAttributes(
      params.vertical,
      params.product.verticalAttributes ?? {},
    );
    const warnings = [...productAttributes.errors.map((error) => `Invalid vertical attributes: ${error}`)];
    const blockingErrors: string[] = [];
    if (params.vertical === 'business_industrial') {
      const businessIndustrial = validateBusinessIndustrialAttributes(
        params.product.verticalAttributes ?? {},
      );
      for (const error of businessIndustrial.errors) {
        blockingErrors.push(`Invalid Business & Industrial attributes: ${error}`);
      }
      warnings.push(...businessIndustrial.warnings);
      if (params.product.verticalValidationStatus !== 'approved') {
        blockingErrors.push('Business & Industrial compliance review must be approved before publishing');
      }
      const productIdentity = params.product as CatalogProduct;
      const review = await this.businessIndustrialReviewRepo.findOne({
        where: { organizationId: productIdentity.organizationId!, catalogProductId: productIdentity.id },
      });
      if (review?.status !== 'approved') {
        blockingErrors.push('A recorded Business & Industrial compliance decision is required before publishing');
      }
      const attributes = businessIndustrial.attributes;
      if (isRestrictedBusinessIndustrialFamily(attributes.categoryFamily) && !review?.restrictedCategoryCleared) {
        blockingErrors.push('Restricted Business & Industrial categories require recorded compliance clearance before publishing');
      }
      if (params.product.manualReview) {
        blockingErrors.push('Business & Industrial listing is quarantined and cannot be published');
      }
      const shippingMode = attributes.shippingMode;
      if (!shippingMode) blockingErrors.push('shippingMode is required for Business & Industrial publishing');
      if (!attributes.dispatchLocation) blockingErrors.push('dispatchLocation is required for Business & Industrial publishing');
      if (!attributes.shippingCoverage) blockingErrors.push('shippingCoverage is required for Business & Industrial publishing');
      if (shippingMode === 'parcel' || shippingMode === 'freight') {
        for (const field of ['packedLength', 'packedWidth', 'packedHeight', 'packedWeight', 'packedDimensionsUnit', 'packedWeightUnit']) {
          if (attributes[field] === undefined || attributes[field] === '') blockingErrors.push(`${field} is required for ${shippingMode} shipping`);
        }
      }
      if (shippingMode === 'freight' && !attributes.freightLoadingFacilities) {
        blockingErrors.push('freightLoadingFacilities is required for freight shipping');
      }
    }
    if (
      params.vertical === 'fashion' &&
      params.product.verticalValidationStatus !== 'approved'
    ) {
      blockingErrors.push(
        'Fashion authenticity/compliance review must be approved before publishing',
      );
    }
    const categoryId = params.listing?.categoryId?.trim() || params.product.categoryId?.trim() || '';
    const metadata = categoryId
      ? await this.getCategoryMetadata(params.storeId, params.marketplaceId, categoryId).catch((error: unknown) => {
          blockingErrors.push(`Category metadata could not be validated for ${categoryId}. Refresh eBay metadata and try again: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        })
      : null;
    if (!categoryId) blockingErrors.push('An eBay leaf category is required before publishing a non-automotive product');

    const condition = this.mapCondition(params.listing?.conditionId || params.product.conditionId, params.listing?.conditionLabel || params.product.conditionLabel);
    if (!condition) blockingErrors.push('A category-supported eBay condition is required; no condition was inferred');

    const aspects = this.buildAspects(params.product, params.listing, productAttributes.attributes);
    if (metadata) {
      for (const aspect of metadata.aspects) {
        const name = aspect.localizedAspectName;
        const normalize = (key: string) => key.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_match, ch: string) => ch.toUpperCase()).toLowerCase();
        const matched = Object.keys(aspects).find((key) => normalize(key) === normalize(name));
        const values = aspects[name] ?? aspects[matched ?? ''] ?? [];
        if (matched && matched !== name) {
          aspects[name] = values;
          delete aspects[matched];
        }
        if (aspect.aspectConstraint?.aspectRequired && values.length === 0) {
          blockingErrors.push(`Required eBay aspect "${name}" is missing for category ${categoryId}`);
        }
        const maxValues = (aspect.aspectConstraint as Record<string, unknown>)?.aspectMaxValues;
        if (typeof maxValues === 'number' && values.length > maxValues) {
          blockingErrors.push(`eBay aspect "${name}" allows at most ${maxValues} value(s)`);
        }
      }
    }

    const title = params.listing?.title?.trim() || params.product.title?.trim() || '';
    const description = params.listing?.description?.trim() || params.product.description?.trim() || title;
    if (!title) blockingErrors.push('A product title is required');
    if (!params.product.imageUrls?.length && !params.listing?.itemPhotoUrl?.trim()) warnings.push('No image is currently stored; publish will require at least one HTTPS image');

    return {
      vertical: params.vertical,
      title,
      description,
      categoryId,
      aspects,
      condition: condition ?? 'NEW',
      conditionDescription: params.product.conditionLabel ?? undefined,
      warnings,
      blockingErrors,
      taxonomyAspects: metadata?.aspects ?? [],
    };
  }

  async getCategoryMetadata(storeId: string, marketplaceId: string, categoryId: string): Promise<VerticalCategoryMetadata> {
    const normalizedCategory = categoryId.trim();
    const key = `${marketplaceId}:${normalizedCategory}`;
    const cached = this.metadataCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const treeId = await this.taxonomy.getDefaultCategoryTreeId(marketplaceId);
    const [aspects, policy] = await Promise.all([
      this.taxonomy.getItemAspectsForCategory(normalizedCategory, treeId),
      this.sellingMetadata.getCategoryPolicies(storeId, marketplaceId, normalizedCategory).catch(() => null),
    ]);
    const metadata: VerticalCategoryMetadata = {
      marketplaceId,
      categoryTreeId: treeId,
      categoryId: normalizedCategory,
      aspects,
      supportedConditions: policy?.supportedConditions ?? [],
      supportsVariations: policy?.supportsVariations ?? null,
      fetchedAt: new Date().toISOString(),
    };
    this.metadataCache.set(key, { value: metadata, expiresAt: Date.now() + this.metadataTtlMs });
    return metadata;
  }

  async persistCategoryMetadata(productId: string, organizationId: string | null, vertical: ProductVertical, metadata: VerticalCategoryMetadata) {
    const existing = await this.categoryRepo.findOne({ where: { catalogProductId: productId, marketplaceId: metadata.marketplaceId } });
    const row = existing ?? this.categoryRepo.create({ catalogProductId: productId, marketplaceId: metadata.marketplaceId });
    Object.assign(row, {
      organizationId,
      vertical,
      categoryTreeId: metadata.categoryTreeId,
      categoryId: metadata.categoryId,
      categoryName: metadata.categoryName ?? null,
      aspectMetadata: metadata.aspects as unknown as Record<string, unknown>[],
      conditionMetadata: metadata.supportedConditions,
      supportsVariations: metadata.supportsVariations,
      fetchedAt: new Date(metadata.fetchedAt),
      invalidatedAt: null,
    });
    return this.categoryRepo.save(row);
  }

  async createFamily(input: { organizationId: string; catalogProductId: string; name: string; slug: string; vertical: ProductVertical }) {
    if (input.vertical === DEFAULT_PRODUCT_VERTICAL) {
      throw new BadRequestException('Product families are only available for pilot non-automotive verticals');
    }
    await this.assertFeatureEnabledForNonAutomotive(input.vertical);
    const product = await this.productRepo.findOneBy({ id: input.catalogProductId });
    if (!product) throw new NotFoundException('Catalog product not found');
    if (product.vertical && product.vertical !== input.vertical) throw new ConflictException('Product family vertical does not match the catalog product');
    return this.familyRepo.save(this.familyRepo.create(input));
  }

  async createVariant(input: { organizationId: string; familyId: string; sku: string; price?: number; quantity?: number; attributes?: unknown; imageUrls?: string[]; conditionId?: string }) {
    const family = await this.familyRepo.findOneBy({ id: input.familyId, organizationId: input.organizationId });
    if (!family) throw new NotFoundException('Product family not found');
    const validated = validateVerticalAttributes(family.vertical, input.attributes ?? {});
    if (validated.errors.length) throw new BadRequestException(validated.errors);
    const variant = this.variantRepo.create({
      organizationId: input.organizationId,
      familyId: family.id,
      catalogProductId: family.catalogProductId,
      vertical: family.vertical,
      sku: input.sku.trim(),
      price: input.price ?? null,
      quantity: input.quantity ?? 0,
      attributes: validated.attributes,
      imageUrls: input.imageUrls ?? [],
      conditionId: input.conditionId ?? null,
    });
    return this.variantRepo.save(variant);
  }

  async listVariants(familyId: string, organizationId: string) {
    return this.variantRepo.find({ where: { familyId, organizationId }, order: { sku: 'ASC' } });
  }

  async createVariantMapping(input: { organizationId: string; variantId: string; ebayAccountId: string; marketplaceId: string; inventorySku?: string }) {
    const variant = await this.variantRepo.findOneBy({ id: input.variantId, organizationId: input.organizationId });
    if (!variant) throw new NotFoundException('Product variant not found');
    const account = await this.accountRepo.findOneBy({ id: input.ebayAccountId, organizationId: input.organizationId });
    if (!account) throw new NotFoundException('eBay account not found in this organization');
    return this.mappingRepo.save(this.mappingRepo.create({
      variantId: variant.id,
      ebayAccountId: account.id,
      marketplaceId: input.marketplaceId,
      inventorySku: input.inventorySku?.trim() || variant.sku,
      offerId: null,
      listingId: null,
      status: 'pending',
      lastError: null,
      resultPayload: null,
    }));
  }

  private async assertStoreOrganization(storeId: string, organizationId: string): Promise<Store> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    if (store.organizationId === organizationId) return store;
    const account = await this.accountRepo.findOneBy({ primaryStoreId: storeId, organizationId });
    if (!account) throw new NotFoundException(`Store ${storeId} is not available in this organization`);
    return store;
  }

  private async assertFeatureEnabledForNonAutomotive(vertical: ProductVertical) {
    if (vertical !== DEFAULT_PRODUCT_VERTICAL) await this.assertFeatureEnabled();
  }

  private buildAspects(product: ProductLike, listing: ListingRecord | null, attributes: ProductAttributes): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(attributes)) {
      const values = Array.isArray(value) ? value : [String(value)];
      if (values.length && values.every((item) => item.trim().length > 0)) result[key] = values;
    }
    const fallback: Array<[string, string | null | undefined]> = [
      ['Brand', listing?.cBrand ?? product.brand],
      ['MPN', listing?.cManufacturerPartNumber ?? product.mpn],
      ['Model', attributes.model as string | undefined],
      ['Material', listing?.cMaterial ?? (attributes.material as string | undefined)],
    ];
    for (const [key, value] of fallback) if (value?.trim() && !result[key]) result[key] = [value.trim()];
    return result;
  }

  private mapCondition(conditionId?: string | null, conditionLabel?: string | null): string | null {
    const raw = `${conditionId ?? ''} ${conditionLabel ?? ''}`.toLowerCase();
    if (raw.includes('1000') || raw.includes('new')) return 'NEW';
    if (raw.includes('1500') || raw.includes('open')) return 'NEW_OTHER';
    if (raw.includes('2000') || raw.includes('certified')) return 'CERTIFIED_REFURBISHED';
    if (raw.includes('2500') || raw.includes('refurb')) return 'SELLER_REFURBISHED';
    if (raw.includes('7000') || raw.includes('parts')) return 'FOR_PARTS_OR_NOT_WORKING';
    if (raw.includes('3000') || raw.includes('used')) return 'USED_GOOD';
    if (raw.includes('4000') || raw.includes('very good')) return 'USED_VERY_GOOD';
    if (raw.includes('5000') || raw.includes('good')) return 'USED_GOOD';
    if (raw.includes('6000') || raw.includes('acceptable')) return 'USED_ACCEPTABLE';
    return null;
  }
}

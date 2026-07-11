import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Store } from '../entities/store.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
import { EbayTaxonomyCacheService } from './ebay-taxonomy-cache.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbaySellAccountApiService } from '../../integrations/ebay/services/ebay-sell-account-api.service.js';
import { EbayPaReturnPolicyService } from '../../integrations/ebay/services/ebay-pa-return-policy.service.js';
import {
  resolveMarketplaceId,
  toEbayInventoryApiMarketplaceId,
} from './ebay-marketplace-headers.util.js';
import type {
  EbayInventoryItem,
  EbayOffer,
  EbayConditionEnum,
  EbayCompatibilityPayload,
  EbayPublishResponse,
} from './ebay-api.types.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../../integrations/ebay/entities/ebay-account-marketplace.entity.js';
import type { ListingBuilderResult } from '../../integrations/ebay/services/listing-builder.service.js';
import { SellerpunditListingAdapter } from '../../integrations/sellerpundit/sellerpundit-listing.adapter.js';
import { SellerpunditPolicySyncService } from '../../integrations/sellerpundit/sellerpundit-policy-sync.service.js';
import {
  parseSellerpunditPublishFallbackMode,
  shouldAttemptSellerpunditBulkCreate,
  shouldFallbackFromSellerpunditBulkCreate,
} from '../../integrations/sellerpundit/sellerpundit-publish.util.js';
import {
  buildEbayListingDescription,
  sanitizePublishListingText,
} from './ebay-listing-text.util.js';
import { sanitizeEbayImageUrls } from './ebay-listing-images.util.js';
import { mapToEbayConditionEnum } from './ebay-listing-condition.util.js';
import {
  extractEbayErrorParameter,
  formatEbayApiError,
  isEbayInvalidAccessTokenError,
  isEbayInvalidCategoryError,
  isEbayInvalidItemConditionError,
  isEbayOfferAlreadyExistsError,
  isEbayPartsAccessoriesReturnPolicyError,
  isEbayRecoverableBusinessPolicyError,
  isEbaySellingLimitError,
} from './ebay-api-error.util.js';
import {
  EbayBusinessPolicy,
  type EbayPolicyType,
} from '../../integrations/ebay/entities/ebay-business-policy.entity.js';
import {
  coalesceValidPolicyId,
  hasValidDefaultPolicyIds,
  listingRequiresPartsAccessoriesReturnPolicy,
  partsAccessoriesReturnPolicyGuidance,
  pickPolicyIdForMarketplace,
  pickReturnPolicyIdForListing,
  readPolicyGeoSite,
} from '../../integrations/ebay/services/ebay-business-policy.util.js';
import { SellerpunditTokenSyncService } from '../../integrations/sellerpundit/sellerpundit-token-sync.service.js';
import { SellerpunditMarketplaceRegistry } from '../../integrations/sellerpundit/sellerpundit-marketplace.registry.js';
import { EbayMarketplaceConfigService } from '../../integrations/ebay/services/ebay-marketplace-config.service.js';
import {
  buildListingAspects,
  isUsedEbayCondition,
  localizeAspectsForMarketplace,
} from './ebay-listing-aspects.util.js';
import { fitmentDataToCompatibilityPayload } from '../../fitment/fitment-mvl.util.js';

/**
 * Publishing request payload from the frontend / caller.
 */
export interface PublishRequest {
  /** Internal listing/product ID */
  listingId: string;
  /** Target store(s) to publish to */
  storeIds: string[];
  /** SKU — must be unique per store */
  sku: string;
  /** Title for the eBay listing */
  title: string;
  /** HTML description */
  description: string;
  /** eBay category ID (from Taxonomy API) */
  categoryId: string;
  /** Condition: NEW, USED_EXCELLENT, USED_GOOD, etc. */
  condition: EbayConditionEnum;
  /** Condition description (required for used items) */
  conditionDescription?: string;
  /** Price in the store's currency */
  price: number;
  /** Currency (default USD) */
  currency?: string;
  /** Available quantity */
  quantity: number;
  /** Image URLs (first = primary) */
  imageUrls: string[];
  /** Item specifics (key-value pairs) */
  aspects: Record<string, string[]>;
  /** Vehicle compatibility data (fitment) */
  compatibility?: EbayCompatibilityPayload;
  /** Fulfillment policy ID */
  fulfillmentPolicyId?: string;
  /** Payment policy ID */
  paymentPolicyId?: string;
  /** Return policy ID */
  returnPolicyId?: string;
  /** Inventory location key */
  merchantLocationKey?: string;
  /** Format: FIXED_PRICE or AUCTION */
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  /** Listing duration (e.g. GTC) */
  listingDuration?: string;
  /** Internal: skip SellerPundit bulk-create (direct eBay Inventory API retry) */
  forceDirectEbay?: boolean;
  /** Name of the user-selected shipping profile (for validation/debugging) */
  requestedFulfillmentPolicyName?: string;
  /** Name of the user-selected return profile (for validation/debugging) */
  requestedReturnPolicyName?: string;
  /** Name of the user-selected payment profile (for validation/debugging) */
  requestedPaymentPolicyName?: string;
}

/**
 * Per-store result from a publish operation.
 */
export interface PublishResult {
  storeId: string;
  storeName: string;
  success: boolean;
  offerId?: string;
  listingId?: string;
  error?: string;
  /** Internal: SellerPundit bulk-create platform defect — triggers direct eBay fallback. */
  platformError?: boolean;
}

/**
 * EbayPublishService — Multi-store listing publish orchestrator.
 *
 * Orchestrates the eBay 3-step publishing flow across one or more stores:
 *  1. Create/update Inventory Item (PUT /inventory_item/{sku})
 *  2. Create Offer (links item to marketplace + policies)
 *  3. Publish Offer (makes it live)
 *
 * Supports:
 *  - Multi-store: publish the same product to multiple eBay stores
 *  - Per-store SKU uniqueness validation
 *  - Partial success (some stores succeed, others fail)
 *  - Compatibility/fitment data attachment
 */
@Injectable()
export class EbayPublishService {
  private readonly logger = new Logger(EbayPublishService.name);
  private readonly compatibilityCategoryCache = new Map<string, boolean>();

  constructor(
    private readonly config: ConfigService,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly taxonomyApi: EbayTaxonomyApiService,
    private readonly taxonomyCache: EbayTaxonomyCacheService,
    private readonly auth: EbayAuthService,
    private readonly sellAccount: EbaySellAccountApiService,
    private readonly paReturnPolicy: EbayPaReturnPolicyService,
    private readonly sellerpunditListing: SellerpunditListingAdapter,
    private readonly sellerpunditPolicies: SellerpunditPolicySyncService,
    private readonly sellerpunditTokens: SellerpunditTokenSyncService,
    private readonly sellerpunditRegistry: SellerpunditMarketplaceRegistry,
    private readonly mpConfig: EbayMarketplaceConfigService,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly connectedAccountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
  ) {}

  /** Resolve images from listing_records / catalog_products when the caller omitted them. */
  private async resolvePublishImages(
    listingId: string,
    provided: string[] | null | undefined,
  ) {
    const initial = sanitizeEbayImageUrls(provided);
    if (initial.imageUrls.length) return initial;

    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (listing?.itemPhotoUrl) {
      const fromListing = sanitizeEbayImageUrls([listing.itemPhotoUrl]);
      if (fromListing.imageUrls.length) return fromListing;
    }

    const catalog = await this.catalogRepo.findOne({
      where: { id: listingId },
    });
    if (catalog?.imageUrls?.length) {
      const fromCatalog = sanitizeEbayImageUrls(catalog.imageUrls);
      if (fromCatalog.imageUrls.length) return fromCatalog;
    }

    if (listing?.customLabelSku) {
      const bySku = await this.catalogRepo.findOne({
        where: { sku: listing.customLabelSku },
      });
      if (bySku?.imageUrls?.length) {
        const fromSku = sanitizeEbayImageUrls(bySku.imageUrls);
        if (fromSku.imageUrls.length) return fromSku;
      }
    }

    return initial;
  }

  /**
   * Bulk/stub publish payloads (inventory manager, channel queue) send placeholder
   * fields including `condition: 'NEW'`. Do not let that override listing_records.
   */
  private publishRequestLooksLikeStub(req: PublishRequest): boolean {
    return (
      !req.title?.trim() &&
      !req.description?.trim() &&
      !req.categoryId?.trim() &&
      req.price === 0 &&
      req.quantity === 0 &&
      !req.imageUrls?.length &&
      (req.sku === req.listingId || !req.sku?.trim())
    );
  }

  private async resolveCatalogProductForPublish(
    listingId: string,
    sku?: string | null,
  ): Promise<CatalogProduct | null> {
    const byId = await this.catalogRepo.findOne({ where: { id: listingId } });
    if (byId) return byId;
    const normalizedSku = sku?.trim();
    if (!normalizedSku) return null;
    return this.catalogRepo.findOne({ where: { sku: normalizedSku } });
  }

  private compatibilityFromCatalog(
    catalog: CatalogProduct | null,
  ): EbayCompatibilityPayload | undefined {
    if (!catalog) return undefined;
    const source =
      Array.isArray(catalog.fitmentData) && catalog.fitmentData.length > 0
        ? catalog.fitmentData
        : Array.isArray(catalog.fitmentRows) && catalog.fitmentRows.length > 0
          ? catalog.fitmentRows
          : undefined;
    const compatibility = fitmentDataToCompatibilityPayload(source);
    if (source?.length && !compatibility) {
      throw new BadRequestException(
        'Structured fitment rows exist but none contain a valid Year, Make, and Model. Correct or validate fitment before publishing.',
      );
    }
    return compatibility;
  }

  private async categoryRequiresCompatibility(
    store: Store,
    categoryId: string,
    account?: ConnectedEbayAccount | null,
  ): Promise<boolean> {
    const marketplaceId = account
      ? this.resolvePublishMarketplaceId(account, store)
      : resolveMarketplaceId(store);
    const marketplace = this.mpConfig.require(marketplaceId);
    if (!marketplace.supportsMotorsFitment) return false;

    const normalizedCategory = categoryId.trim();
    if (!normalizedCategory) return false;
    const cacheKey = `${marketplace.categoryTreeId}:${normalizedCategory}`;

    // 1. In-memory cache (fast, same process)
    const memCached = this.compatibilityCategoryCache.get(cacheKey);
    if (memCached !== undefined) return memCached;

    // 2. Persistent JSON cache (survives restarts)
    const diskCached = this.taxonomyCache.getCompatibility(
      marketplace.categoryTreeId,
      normalizedCategory,
    );
    if (diskCached !== undefined) {
      this.compatibilityCategoryCache.set(cacheKey, diskCached);
      return diskCached;
    }

    // 3. eBay Taxonomy API (only on cache miss)
    try {
      const properties = await this.taxonomyApi.getCompatibilityProperties(
        marketplace.categoryTreeId,
        normalizedCategory,
      );
      const names = new Set(
        properties.map((property) =>
          property.propertyName.trim().toLowerCase(),
        ),
      );
      const required =
        names.has('year') && names.has('make') && names.has('model');
      this.compatibilityCategoryCache.set(cacheKey, required);
      this.taxonomyCache.setCompatibility(
        marketplace.categoryTreeId,
        normalizedCategory,
        required,
      );
      return required;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;

      // 400 = category doesn't support compatibility at all (e.g. non-P&A categories)
      if (status === 400) {
        this.logger.debug(
          `Category ${normalizedCategory} does not support vehicle compatibility (400) — treating as not required`,
        );
        this.compatibilityCategoryCache.set(cacheKey, false);
        this.taxonomyCache.setCompatibility(
          marketplace.categoryTreeId,
          normalizedCategory,
          false,
        );
        return false;
      }

      // 429 = rate limited after retries exhausted — assume requires compatibility (safe default for Motors)
      if (status === 429) {
        this.logger.warn(
          `Category ${normalizedCategory} compatibility check rate-limited (429) after retries — assuming compatibility required (safe default)`,
        );
        this.compatibilityCategoryCache.set(cacheKey, true);
        this.taxonomyCache.setCompatibility(
          marketplace.categoryTreeId,
          normalizedCategory,
          true,
        );
        return true;
      }

      throw new BadRequestException(
        `Could not verify whether eBay category ${normalizedCategory} requires vehicle compatibility. Publishing is blocked to prevent a description-only fitment listing. ${err instanceof Error ? err.message : ''}`.trim(),
      );
    }
  }

  private compatibilityRowKey(
    row: EbayCompatibilityPayload['compatibleProducts'][number],
  ): string {
    return row.compatibilityProperties
      .map((property) => ({
        name: property.name.trim().toLowerCase(),
        value: property.value.trim().toLowerCase(),
      }))
      .filter((property) => property.name && property.value)
      .sort((a, b) =>
        `${a.name}:${a.value}`.localeCompare(`${b.name}:${b.value}`),
      )
      .map((property) => `${property.name}:${property.value}`)
      .join('|');
  }

  private assertCompatibilityPersisted(
    sku: string,
    expected: EbayCompatibilityPayload,
    actual: EbayCompatibilityPayload,
  ): void {
    const actualRows = new Set(
      (actual.compatibleProducts ?? [])
        .map((row) => this.compatibilityRowKey(row))
        .filter(Boolean),
    );
    const missingRows = expected.compatibleProducts.filter(
      (row) => !actualRows.has(this.compatibilityRowKey(row)),
    );
    if (missingRows.length > 0) {
      throw new BadRequestException(
        `eBay compatibility verification failed for SKU ${sku}: ${missingRows.length} of ${expected.compatibleProducts.length} structured fitment row(s) were not persisted. The offer was not published.`,
      );
    }
    this.logger.log(
      `Verified ${expected.compatibleProducts.length} structured eBay compatibility row(s) for SKU ${sku}`,
    );
  }

  /** Backfill SKU, text, category, condition, and pricing from listing_records when the client sends stubs. */
  private async enrichPublishRequest(
    req: PublishRequest,
  ): Promise<PublishRequest> {
    const listing = await this.listingRepo.findOne({
      where: { id: req.listingId },
    });

    const looksStub = this.publishRequestLooksLikeStub(req);
    const listingCondition = listing?.conditionId?.trim() || undefined;
    // PublishModal and bulk stubs send `condition: 'NEW'` when conditionId was not loaded.
    const clientSentNewPlaceholder =
      req.condition === 'NEW' && !!listingCondition;
    const conditionSource =
      looksStub || clientSentNewPlaceholder
        ? listingCondition
        : (req.condition ?? listingCondition ?? undefined);
    const mappedCondition = mapToEbayConditionEnum(
      typeof conditionSource === 'string' ? conditionSource : undefined,
    );

    if (!listing) {
      const desc = buildEbayListingDescription({
        description: req.description,
        title: req.title,
        sku: req.sku,
      });
      return {
        ...req,
        condition: mappedCondition,
        description: desc.description,
      };
    }

    const skuLooksLikeListingId =
      !req.sku?.trim() || req.sku === req.listingId || req.sku === listing.id;
    const sku = skuLooksLikeListingId
      ? listing.customLabelSku?.trim() || req.sku
      : req.sku.trim();
    const catalog = await this.resolveCatalogProductForPublish(listing.id, sku);
    const compatibility = req.compatibility?.compatibleProducts?.length
      ? req.compatibility
      : this.compatibilityFromCatalog(catalog);

    const parsedPrice = parseFloat(listing.startPrice ?? '');
    const parsedQty = parseInt(listing.quantity ?? '', 10);
    const title = req.title?.trim() || listing.title?.trim() || '';
    const desc = buildEbayListingDescription({
      description: req.description?.trim() || listing.description?.trim() || '',
      title,
      brand: listing.cBrand,
      mpn: listing.cManufacturerPartNumber,
      sku,
      partType: listing.cType,
    });

    const aspects = buildListingAspects({
      brand: listing.cBrand || listing.manufacturerName,
      mpn: listing.cManufacturerPartNumber,
      partType: listing.cType,
      upc: listing.pUpc,
      oeOemPartNumber: listing.cOeOemPartNumber,
      existing: req.aspects,
    });

    if (!aspects.Brand?.length) {
      aspects.Brand = ['Unbranded'];
    }

    const conditionDescription =
      req.conditionDescription?.trim() ||
      (isUsedEbayCondition(mappedCondition)
        ? listing.cType?.trim() || title || 'Used item'
        : undefined);

    const listingDuration =
      req.listingDuration?.trim() ||
      (listing.duration?.trim().toUpperCase() === 'GTC' ? 'GTC' : undefined) ||
      'GTC';

    return {
      ...req,
      sku,
      title,
      description: desc.description,
      categoryId: req.categoryId?.trim() || listing.categoryId?.trim() || '',
      condition: mappedCondition,
      conditionDescription,
      listingDuration,
      aspects,
      compatibility,
      price:
        req.price > 0
          ? req.price
          : Number.isFinite(parsedPrice)
            ? parsedPrice
            : req.price,
      quantity:
        req.quantity > 0
          ? req.quantity
          : Number.isFinite(parsedQty) && parsedQty > 0
            ? parsedQty
            : req.quantity || 1,
      requestedFulfillmentPolicyName:
        req.requestedFulfillmentPolicyName?.trim() ||
        listing.shippingProfileName?.trim() ||
        undefined,
      requestedReturnPolicyName:
        req.requestedReturnPolicyName?.trim() ||
        listing.returnProfileName?.trim() ||
        undefined,
      requestedPaymentPolicyName:
        req.requestedPaymentPolicyName?.trim() ||
        listing.paymentProfileName?.trim() ||
        undefined,
    };
  }

  /** Extract and log policy details for debugging shipping cost discrepancies. */
  private async logPolicyDetails(
    fulfillmentPolicyId: string | undefined,
    storeName: string,
    sku: string,
  ): Promise<void> {
    if (!fulfillmentPolicyId) return;

    try {
      const policy = await this.policyRepo.findOne({
        where: { ebayPolicyId: fulfillmentPolicyId },
      });

      if (!policy) {
        this.logger.warn(
          `Policy ${fulfillmentPolicyId} not found in database for SKU ${sku} on "${storeName}"`,
        );
        return;
      }

      const raw = policy.rawPayload;
      const shippingOptions = raw?.shippingOptions as
        | Array<Record<string, unknown>>
        | undefined;
      let shippingCost: string | undefined;
      let serviceCode: string | undefined;

      if (shippingOptions?.[0]?.shippingServices) {
        const services = shippingOptions[0].shippingServices as Array<
          Record<string, unknown>
        >;
        if (services[0]?.shippingCost) {
          const cost = services[0].shippingCost as {
            value?: string;
            currency?: string;
          };
          shippingCost = cost.value
            ? `${cost.value} ${cost.currency || 'USD'}`
            : undefined;
        }
        serviceCode = services[0]?.shippingServiceCode as string;
      }

      this.logger.log(
        `Policy details for SKU ${sku} on "${storeName}": ` +
          `ID=${fulfillmentPolicyId}, Name="${policy.name}", ` +
          `ShippingCost=${shippingCost || 'N/A'}, Service=${serviceCode || 'N/A'}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to log policy details for ${fulfillmentPolicyId}: ${err}`,
      );
    }
  }

  private validateDirectOffer(offer: EbayOffer, store: Store): string | null {
    const policies = offer.listingPolicies ?? {};
    if (!policies.fulfillmentPolicyId?.trim()) {
      return `Missing fulfillment policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
    }
    if (!policies.paymentPolicyId?.trim()) {
      return `Missing payment policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
    }
    if (!policies.returnPolicyId?.trim()) {
      return `Missing return policy for "${store.storeName}". Sync eBay policies in Settings → eBay Integrations.`;
    }
    if (!offer.categoryId?.trim()) {
      return 'eBay category is required before publishing.';
    }
    if (!offer.merchantLocationKey?.trim()) {
      return `Missing inventory location for "${store.storeName}". Sync policies from eBay or map a merchant location key.`;
    }
    return null;
  }

  /**
   * Publish a listing to one or more eBay stores.
   * Returns per-store success/failure results.
   */
  async publish(req: PublishRequest): Promise<PublishResult[]> {
    if (!req.storeIds.length) {
      throw new BadRequestException('At least one storeId is required');
    }

    const enriched = await this.enrichPublishRequest(req);
    const listing = await this.listingRepo.findOne({
      where: { id: enriched.listingId },
    });
    const listingOem =
      listing?.cOeOemPartNumber ?? listing?.cManufacturerPartNumber ?? '';
    const sanitized = sanitizePublishListingText({
      title: enriched.title,
      description: enriched.description,
      sku: enriched.sku,
      brand: listing?.cBrand,
      mpn: listing?.cManufacturerPartNumber,
      partType: listing?.cType,
      make: (listing?.cBrand ?? listing?.extractedMake ?? '').trim() || null,
      model: (listing?.extractedModel ?? '').trim() || null,
      position: (listing?.cPlacement ?? '').trim() || null,
      partName: (listing?.cType ?? '').trim() || null,
      oemPartNumber: listingOem.trim() || null,
    });
    if (sanitized.warnings.length) {
      this.logger.debug(
        `Publish text warnings for "${enriched.sku}": ${sanitized.warnings.join('; ')}`,
      );
    }
    const images = await this.resolvePublishImages(
      enriched.listingId,
      enriched.imageUrls,
    );
    if (!images.imageUrls.length) {
      throw new BadRequestException(
        'At least one valid image URL (http/https) is required to publish',
      );
    }
    const normalizedReq: PublishRequest = {
      ...enriched,
      title: sanitized.title,
      description: sanitized.description,
      imageUrls: images.imageUrls,
    };

    const results: PublishResult[] = [];

    // Process stores in parallel (eBay rate limits are per-app, so serial may be safer at scale)
    for (const storeId of req.storeIds) {
      const result = await this.publishToStore(storeId, normalizedReq);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    this.logger.log(
      `Publish "${req.sku}" complete: ${succeeded} succeeded, ${failed} failed across ${req.storeIds.length} stores`,
    );

    if (succeeded > 0) {
      const firstSuccess = results.find((r) => r.success);
      try {
        await this.listingRepo.update(req.listingId, {
          status: 'published',
          publishedAt: new Date(),
          ...(firstSuccess?.listingId
            ? { ebayListingId: firstSuccess.listingId }
            : {}),
        });
      } catch (writeErr) {
        this.logger.warn(
          `Failed to write publish status for listing ${req.listingId}: ${(writeErr as Error).message}`,
        );
      }
    }

    return results;
  }

  /**
   * Batch publish listing records using backend enrichment (images, condition, policies).
   * Callers may pass stub fields; `enrichPublishRequest` backfills from `listing_records`.
   */
  async publishByListingIds(
    listingIds: string[],
    storeIds: string[],
    options?: {
      fulfillmentPolicyId?: string;
      paymentPolicyId?: string;
      returnPolicyId?: string;
      shippingProfileName?: string;
      returnProfileName?: string;
      paymentProfileName?: string;
    },
  ): Promise<Array<{ listingId: string; results: PublishResult[] }>> {
    if (!storeIds.length) {
      throw new BadRequestException('At least one storeId is required');
    }

    if (
      options?.shippingProfileName ||
      options?.returnProfileName ||
      options?.paymentProfileName
    ) {
      await this.applyListingProfileNames(listingIds, options);
    }

    const CONCURRENCY = 5;
    const allResults: Array<{ listingId: string; results: PublishResult[] }> =
      [];

    for (let i = 0; i < listingIds.length; i += CONCURRENCY) {
      const chunk = listingIds.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map((id) =>
          this.publish(this.stubPublishRequest(id, storeIds, options)),
        ),
      );
      for (let j = 0; j < chunk.length; j++) {
        const settled = chunkResults[j];
        allResults.push({
          listingId: chunk[j],
          results:
            settled.status === 'fulfilled'
              ? settled.value
              : storeIds.map((storeId) => ({
                  storeId,
                  storeName: storeId,
                  success: false as const,
                  error:
                    settled.reason instanceof Error
                      ? settled.reason.message
                      : 'Unknown error',
                })),
        });
      }
    }
    return allResults;
  }

  private async applyListingProfileNames(
    listingIds: string[],
    options: {
      shippingProfileName?: string;
      returnProfileName?: string;
      paymentProfileName?: string;
    },
  ): Promise<void> {
    const listings = await this.listingRepo.findBy({ id: In(listingIds) });
    for (const listing of listings) {
      if (options.shippingProfileName) {
        listing.shippingProfileName = options.shippingProfileName;
      }
      if (options.returnProfileName) {
        listing.returnProfileName = options.returnProfileName;
      }
      if (options.paymentProfileName) {
        listing.paymentProfileName = options.paymentProfileName;
      }
    }
    if (listings.length) {
      await this.listingRepo.save(listings);
    }
  }

  /** Minimal publish payload; enrichment fills title, SKU, images, condition, policies. */
  stubPublishRequest(
    listingId: string,
    storeIds: string[],
    options?: {
      fulfillmentPolicyId?: string;
      paymentPolicyId?: string;
      returnPolicyId?: string;
      shippingProfileName?: string;
      returnProfileName?: string;
      paymentProfileName?: string;
    },
  ): PublishRequest {
    return {
      listingId,
      storeIds,
      sku: listingId,
      title: '',
      description: '',
      categoryId: '',
      // Placeholder only — enrichPublishRequest reads listing_records.conditionId.
      condition: 'NEW',
      price: 0,
      quantity: 0,
      imageUrls: [],
      aspects: {},
      fulfillmentPolicyId: options?.fulfillmentPolicyId,
      paymentPolicyId: options?.paymentPolicyId,
      returnPolicyId: options?.returnPolicyId,
      requestedFulfillmentPolicyName: options?.shippingProfileName,
      requestedReturnPolicyName: options?.returnProfileName,
      requestedPaymentPolicyName: options?.paymentProfileName,
    };
  }

  /**
   * Publish a listing to a single store.
   */
  private async publishToStore(
    storeId: string,
    req: PublishRequest,
  ): Promise<PublishResult> {
    const store = await this.storeRepo.findOneBy({ id: storeId });
    if (!store) {
      return {
        storeId,
        storeName: 'Unknown',
        success: false,
        error: `Store ${storeId} not found`,
      };
    }

    const account = await this.connectedAccountRepo.findOne({
      where: { primaryStoreId: storeId },
    });

    if (!req.compatibility?.compatibleProducts?.length) {
      try {
        const requiresCompatibility = await this.categoryRequiresCompatibility(
          store,
          req.categoryId,
          account,
        );
        if (requiresCompatibility) {
          return {
            storeId,
            storeName: store.storeName,
            success: false,
            error:
              'This eBay Motors category supports vehicle compatibility, but no validated structured fitment rows were found. Add Year, Make, and Model fitment before publishing; description text alone is not accepted.',
          };
        }
      } catch (err: unknown) {
        return {
          storeId,
          storeName: store.storeName,
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Could not validate eBay fitment requirements',
        };
      }
    }

    const fallbackMode = parseSellerpunditPublishFallbackMode(
      this.config.get<string>('SELLERPUNDIT_PUBLISH_FALLBACK'),
    );

    if (
      account?.connectionSource === 'sellerpundit' &&
      !req.compatibility?.compatibleProducts?.length &&
      shouldAttemptSellerpunditBulkCreate(fallbackMode, req.forceDirectEbay)
    ) {
      const spResult = await this.publishViaSellerpundit(store, account, req);
      if (spResult.success) {
        return spResult;
      }
      if (shouldFallbackFromSellerpunditBulkCreate(fallbackMode, spResult)) {
        this.logger.warn(
          `SellerPundit bulk-create unavailable for "${store.storeName}"` +
            (spResult.error ? ` (${spResult.error})` : '') +
            ' — falling back to direct eBay Inventory API',
        );
        const enriched = await this.enrichPoliciesFromMarketplace(
          account,
          store,
          req,
        );
        return this.publishViaDirectEbay(
          store,
          storeId,
          {
            ...enriched,
            forceDirectEbay: true,
          },
          account,
        );
      }
      return spResult;
    }

    const directReq = account
      ? await this.enrichPoliciesFromMarketplace(account, store, req)
      : await this.enrichPoliciesFromStoreOnly(store, req);
    return this.publishViaDirectEbay(store, storeId, directReq, account);
  }

  private async publishViaDirectEbay(
    store: Store,
    storeId: string,
    req: PublishRequest,
    account?: ConnectedEbayAccount | null,
  ): Promise<PublishResult> {
    const runDirectPublish = async (): Promise<PublishResult> => {
      const inventoryItem = this.buildInventoryItem(req, store);
      await this.inventoryApi.createOrReplaceItem(
        storeId,
        req.sku,
        inventoryItem,
      );

      if (req.compatibility?.compatibleProducts?.length) {
        await this.inventoryApi.setCompatibility(
          storeId,
          req.sku,
          req.compatibility,
        );
        const persistedCompatibility = await this.inventoryApi.getCompatibility(
          storeId,
          req.sku,
        );
        this.assertCompatibilityPersisted(
          req.sku,
          req.compatibility,
          persistedCompatibility,
        );
      }

      const offer = this.buildOffer(req, store);

      // Log policy details for debugging shipping cost discrepancies
      await this.logPolicyDetails(
        offer.listingPolicies?.fulfillmentPolicyId,
        store.storeName,
        req.sku,
      );

      const offerValidationError = this.validateDirectOffer(offer, store);
      if (offerValidationError) {
        return {
          storeId,
          storeName: store.storeName,
          success: false,
          error: offerValidationError,
        };
      }

      const offerId = await this.resolveOrCreateOfferId(
        storeId,
        offer,
        store,
        inventoryItem,
      );

      let publishResult: EbayPublishResponse;
      try {
        publishResult = await this.publishOfferWithRetries(
          storeId,
          offerId,
          store,
          account,
          req,
        );
      } catch (publishErr: unknown) {
        if (isEbayInvalidItemConditionError(publishErr)) {
          const fallbackCondition = this.fallbackConditionForCategory(req);
          if (fallbackCondition && fallbackCondition !== req.condition) {
            this.logger.warn(
              `Publish rejected condition "${req.condition}" for SKU ${req.sku} — retrying with ${fallbackCondition}`,
            );
            const retryItem = this.buildInventoryItem(
              {
                ...req,
                condition: fallbackCondition,
              },
              store,
            );
            await this.inventoryApi.createOrReplaceItem(
              storeId,
              req.sku,
              retryItem,
            );
            publishResult = await this.publishOfferWithRetries(
              storeId,
              offerId,
              store,
              account,
              { ...req, condition: fallbackCondition },
            );
          } else {
            throw publishErr;
          }
        } else {
          throw publishErr;
        }
      }

      return {
        storeId,
        storeName: store.storeName,
        success: true,
        offerId,
        listingId: publishResult.listingId,
      };
    };

    try {
      if (account?.connectionSource === 'sellerpundit') {
        await this.sellerpunditTokens.ensureFreshAccessToken(account.id, {
          force: true,
        });
      }
      return await runDirectPublish();
    } catch (err: unknown) {
      if (
        account?.connectionSource === 'sellerpundit' &&
        isEbayInvalidAccessTokenError(err)
      ) {
        this.logger.warn(
          `eBay rejected SellerPundit token for "${store.storeName}" — forcing SellerPundit re-fetch and retrying publish`,
        );
        try {
          await this.sellerpunditTokens.refreshTokenFromSellerpundit(account);
          return await runDirectPublish();
        } catch (retryErr: unknown) {
          return this.formatDirectPublishFailure(
            store,
            storeId,
            req,
            retryErr,
            account,
          );
        }
      }
      return this.formatDirectPublishFailure(store, storeId, req, err, account);
    }
  }

  private formatDirectPublishFailure(
    store: Store,
    storeId: string,
    req: PublishRequest,
    err: unknown,
    account?: ConnectedEbayAccount | null,
  ): PublishResult {
    let errorMsg = formatEbayApiError(
      err,
      err instanceof Error ? err.message : 'Publish failed',
    );
    if (isEbayInvalidAccessTokenError(err)) {
      if (account?.connectionSource === 'sellerpundit') {
        void this.connectedAccountRepo
          .update(account.id, {
            connectionStatus: 'reconnect_required',
            lastErrorMessage:
              'eBay rejected the OAuth token supplied by SellerPundit — reconnect eBay for this store in SellerPundit, then Re-sync stores here',
          })
          .catch((updateErr) =>
            this.logger.warn(
              `Could not mark SellerPundit account ${account.id} reconnect_required`,
              updateErr,
            ),
          );
        errorMsg =
          `eBay rejected the OAuth token for "${store.storeName}". ` +
          "RealTrackApp is connected to SellerPundit, but SellerPundit's eBay authorization for this store is invalid or expired. " +
          'Reconnect eBay in SellerPundit for this account, then use Settings → eBay Integrations → Re-sync stores.';
      } else {
        errorMsg = `eBay authorization failed for "${store.storeName}". Re-sync or reconnect this store in Settings → eBay Integrations.`;
      }
    }

    if (isEbaySellingLimitError(err)) {
      errorMsg =
        `eBay DE selling limit reached for "${store.storeName}". ` +
        'Your eBay DE account has exceeded its monthly listing value limit (€3,000,000.00). ' +
        'New listings cannot be created until the limit resets (typically at the start of the next month) ' +
        'or eBay approves a limit increase. ' +
        'Request a limit increase at: https://www.ebay.de/help/selling/listings/selling-limits?id=4107';
    }
    const responseData = (err as { response?: { data?: unknown } })?.response
      ?.data;
    if (responseData) {
      this.logger.error(
        `eBay API error for "${req.sku}" on "${store.storeName}": ${JSON.stringify(responseData)}`,
      );
    }
    this.logger.error(
      `Failed to publish "${req.sku}" to store ${storeId}: ${errorMsg}`,
    );
    return {
      storeId,
      storeName: store.storeName,
      success: false,
      error: errorMsg,
    };
  }

  private async enrichPoliciesFromStoreOnly(
    store: Store,
    req: PublishRequest,
  ): Promise<PublishRequest> {
    const merchantLocationKey = await this.resolveMerchantLocationKey(
      store,
      req,
    );
    return {
      ...req,
      fulfillmentPolicyId:
        req.fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
      paymentPolicyId:
        req.paymentPolicyId ?? store.paymentPolicyId ?? undefined,
      returnPolicyId: req.returnPolicyId ?? store.returnPolicyId ?? undefined,
      merchantLocationKey,
    };
  }

  private resolvePublishMarketplaceId(
    account: ConnectedEbayAccount,
    store: Store,
  ): string {
    const fromStore = resolveMarketplaceId(store);
    if (account.connectionSource !== 'sellerpundit') return fromStore;
    return this.sellerpunditRegistry.resolveMarketplaceForAccount(
      account.sellerpunditAccountName ??
        account.accountDisplayName ??
        store.storeName ??
        '',
      fromStore,
    );
  }

  private async ensureMarketplaceRow(
    ebayAccountId: string,
    marketplaceId: string,
  ): Promise<EbayAccountMarketplace> {
    let mpRow = await this.mpRepo.findOne({
      where: { ebayAccountId, marketplaceId },
    });
    if (!mpRow) {
      const mp = this.mpConfig.require(marketplaceId);
      mpRow = this.mpRepo.create({
        ebayAccountId,
        marketplaceId,
        currency: mp.currency,
        locale: mp.locale,
        enabled: true,
      });
      mpRow = await this.mpRepo.save(mpRow);
    } else if (!mpRow.enabled) {
      mpRow.enabled = true;
      mpRow = await this.mpRepo.save(mpRow);
    }
    return mpRow;
  }

  private async enrichPoliciesFromMarketplace(
    account: ConnectedEbayAccount,
    store: Store,
    req: PublishRequest,
  ): Promise<PublishRequest> {
    const marketplaceId = this.resolvePublishMarketplaceId(account, store);

    if (
      account.connectionSource === 'sellerpundit' &&
      store.ebayMarketplaceId !== marketplaceId
    ) {
      store.ebayMarketplaceId = marketplaceId;
      store.config = {
        ...(store.config ?? {}),
        marketplace: marketplaceId,
      };
      await this.storeRepo.save(store);
    }

    let mpRow = await this.ensureMarketplaceRow(account.id, marketplaceId);

    if (account.connectionSource === 'sellerpundit') {
      const policyCount = await this.policyRepo.count({
        where: { ebayAccountId: account.id, marketplaceId },
      });
      if (policyCount === 0 || !hasValidDefaultPolicyIds(mpRow)) {
        const policyResult =
          await this.sellerpunditPolicies.ensurePoliciesFresh(
            account.id,
            account.organizationId,
            marketplaceId,
          );
        if (!policyResult.ok) {
          throw new BadRequestException(policyResult.message);
        }
        mpRow = await this.ensureMarketplaceRow(account.id, marketplaceId);
      }
    }

    const merchantLocationKey = await this.resolveMerchantLocationKey(
      store,
      req,
      mpRow?.defaultInventoryLocationKey,
      account.id,
    );

    const paReturnRequired = listingRequiresPartsAccessoriesReturnPolicy(
      marketplaceId,
      req.categoryId,
      req.condition,
    );

    const synced = await this.resolvePoliciesFromSyncedTable(
      account.id,
      marketplaceId,
      req.categoryId,
      req.condition,
    );

    // Resolve profile NAMES → policy IDs using the synced ebay_business_policies
    // table. This ensures a listing_records.shippingProfileName like
    // "BLAP shipping policy 3 KG" is resolved to the correct eBay fulfillment
    // policy ID instead of silently falling back to the marketplace default.
    const nameResolvedFulfillment = await this.resolvePolicyByName(
      account.id,
      marketplaceId,
      'fulfillment',
      req.requestedFulfillmentPolicyName,
    );
    const nameResolvedPayment = await this.resolvePolicyByName(
      account.id,
      marketplaceId,
      'payment',
      req.requestedPaymentPolicyName,
    );
    const nameResolvedReturn = await this.resolvePolicyByName(
      account.id,
      marketplaceId,
      'return',
      req.requestedReturnPolicyName,
      req.categoryId,
      req.condition,
    );

    const resolvedFulfillment = coalesceValidPolicyId(
      req.fulfillmentPolicyId,
      nameResolvedFulfillment,
      synced.fulfillmentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultFulfillmentPolicyId
        : undefined,
    );
    const resolvedPayment = coalesceValidPolicyId(
      req.paymentPolicyId,
      nameResolvedPayment,
      synced.paymentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultPaymentPolicyId
        : undefined,
    );
    const resolvedReturn = coalesceValidPolicyId(
      req.returnPolicyId,
      nameResolvedReturn,
      synced.returnPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultReturnPolicyId
        : undefined,
    );
    const needsAccountApiRefresh =
      !resolvedFulfillment ||
      !resolvedPayment ||
      !resolvedReturn ||
      (paReturnRequired && !resolvedReturn);
    const refreshed = needsAccountApiRefresh
      ? await this.refreshPoliciesFromEbayApi(store, account, {
          persist: true,
          categoryId: req.categoryId,
          condition: req.condition,
        })
      : {};

    const fulfillmentPolicyId = coalesceValidPolicyId(
      req.fulfillmentPolicyId,
      nameResolvedFulfillment,
      refreshed.fulfillmentPolicyId,
      synced.fulfillmentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultFulfillmentPolicyId
        : undefined,
      store.fulfillmentPolicyId,
    );
    const paymentPolicyId = coalesceValidPolicyId(
      req.paymentPolicyId,
      nameResolvedPayment,
      refreshed.paymentPolicyId,
      synced.paymentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultPaymentPolicyId
        : undefined,
      store.paymentPolicyId,
    );
    let returnPolicyId = coalesceValidPolicyId(
      req.returnPolicyId,
      nameResolvedReturn,
      refreshed.returnPolicyId,
      synced.returnPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultReturnPolicyId
        : undefined,
      store.returnPolicyId,
    );

    if (paReturnRequired) {
      const ensured = await this.paReturnPolicy.ensureCompliantReturnPolicy({
        store,
        account,
        marketplaceId,
        categoryId: req.categoryId,
        condition: req.condition,
        currentReturnPolicyId: returnPolicyId,
      });
      if (ensured.action === 'blocked') {
        throw new BadRequestException(
          ensured.blockedMessage ?? partsAccessoriesReturnPolicyGuidance(),
        );
      }
      if (ensured.returnPolicyId) {
        if (ensured.action === 'upgraded' || ensured.action === 'created') {
          this.logger.log(
            `P&A return policy ${ensured.action}: ${ensured.returnPolicyId} for store "${store.storeName}"`,
          );
        }
        returnPolicyId = ensured.returnPolicyId;
      } else if (paReturnRequired) {
        throw new BadRequestException(partsAccessoriesReturnPolicyGuidance());
      }
    }

    // Log which source provided each policy ID
    const fulfillmentSource = this.policyResolutionSource(
      req.fulfillmentPolicyId,
      nameResolvedFulfillment,
      refreshed.fulfillmentPolicyId,
      synced.fulfillmentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultFulfillmentPolicyId
        : undefined,
      store.fulfillmentPolicyId,
    );
    const paymentSource = this.policyResolutionSource(
      req.paymentPolicyId,
      nameResolvedPayment,
      refreshed.paymentPolicyId,
      synced.paymentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultPaymentPolicyId
        : undefined,
      store.paymentPolicyId,
    );
    const returnSource = this.policyResolutionSource(
      req.returnPolicyId,
      nameResolvedReturn,
      refreshed.returnPolicyId,
      synced.returnPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultReturnPolicyId
        : undefined,
      store.returnPolicyId,
    );
    this.logger.log(
      `Policy resolution for "${store.storeName}" (${marketplaceId}): ` +
        `fulfillment=${fulfillmentPolicyId ?? 'NONE'} [${fulfillmentSource}], ` +
        `payment=${paymentPolicyId ?? 'NONE'} [${paymentSource}], ` +
        `return=${returnPolicyId ?? 'NONE'} [${returnSource}]`,
    );

    // Validate: if user selected a profile by name but we couldn't resolve it to an ID, fail loudly
    if (req.requestedFulfillmentPolicyName && !fulfillmentPolicyId) {
      throw new BadRequestException(
        `Shipping profile "${req.requestedFulfillmentPolicyName}" could not be resolved to an eBay fulfillment policy. ` +
          `Sync eBay policies in Settings → eBay Integrations, then try again.`,
      );
    }
    if (req.requestedPaymentPolicyName && !paymentPolicyId) {
      throw new BadRequestException(
        `Payment profile "${req.requestedPaymentPolicyName}" could not be resolved to an eBay payment policy. ` +
          `Sync eBay policies in Settings → eBay Integrations, then try again.`,
      );
    }
    if (req.requestedReturnPolicyName && !returnPolicyId) {
      throw new BadRequestException(
        `Return profile "${req.requestedReturnPolicyName}" could not be resolved to an eBay return policy. ` +
          `Sync eBay policies in Settings → eBay Integrations, then try again.`,
      );
    }

    if (mpRow && merchantLocationKey && !mpRow.defaultInventoryLocationKey) {
      mpRow.defaultInventoryLocationKey = merchantLocationKey;
      await this.mpRepo.save(mpRow);
    }

    if (mpRow) {
      let mpDirty = false;
      if (
        fulfillmentPolicyId &&
        mpRow.defaultFulfillmentPolicyId !== fulfillmentPolicyId
      ) {
        mpRow.defaultFulfillmentPolicyId = fulfillmentPolicyId;
        mpDirty = true;
      }
      if (paymentPolicyId && mpRow.defaultPaymentPolicyId !== paymentPolicyId) {
        mpRow.defaultPaymentPolicyId = paymentPolicyId;
        mpDirty = true;
      }
      if (returnPolicyId && mpRow.defaultReturnPolicyId !== returnPolicyId) {
        mpRow.defaultReturnPolicyId = returnPolicyId;
        mpDirty = true;
      }
      if (mpDirty) {
        mpRow = await this.mpRepo.save(mpRow);
      }
    }

    const currency = this.mpConfig.require(marketplaceId).currency;

    if (!mpRow) {
      return {
        ...req,
        currency,
        fulfillmentPolicyId:
          fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: paymentPolicyId ?? store.paymentPolicyId ?? undefined,
        returnPolicyId: returnPolicyId ?? store.returnPolicyId ?? undefined,
        merchantLocationKey,
      };
    }

    return {
      ...req,
      currency,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      merchantLocationKey,
    };
  }

  private async resolvePoliciesFromSyncedTable(
    ebayAccountId: string,
    marketplaceId: string,
    categoryId?: string,
    condition?: string,
  ): Promise<{
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  }> {
    const rows = await this.policyRepo.find({
      where: { ebayAccountId, marketplaceId },
    });
    const toCandidates = (policyType: EbayBusinessPolicy['policyType']) =>
      rows
        .filter((r) => r.policyType === policyType)
        .map((r) => ({
          ebayPolicyId: r.ebayPolicyId,
          isDefault: r.isDefault,
          geoSite: readPolicyGeoSite(r.rawPayload ?? {}),
          rawPayload: r.rawPayload ?? {},
        }));

    return {
      fulfillmentPolicyId:
        pickPolicyIdForMarketplace(
          toCandidates('fulfillment'),
          marketplaceId,
        ) ?? undefined,
      paymentPolicyId:
        pickPolicyIdForMarketplace(toCandidates('payment'), marketplaceId) ??
        undefined,
      returnPolicyId:
        pickReturnPolicyIdForListing(
          toCandidates('return'),
          marketplaceId,
          categoryId,
          condition,
        ) ?? undefined,
    };
  }

  /**
   * Resolve a business-policy NAME to its eBay policy ID using the synced
   * ebay_business_policies table.
   *
   * This closes the bug where listing_records store profile names (e.g.
   * "BLAP shipping policy 3 KG") but the publish coalesce only checked
   * pre-existing numeric IDs — causing silent fallback to the marketplace
   * default policy (which may be a free-shipping policy).
   */
  async resolvePolicyByName(
    ebayAccountId: string,
    marketplaceId: string,
    policyType: EbayPolicyType,
    name: string | null | undefined,
    categoryId?: string,
    condition?: string,
  ): Promise<string | undefined> {
    const trimmed = name?.trim();
    if (!trimmed) return undefined;

    const rows = await this.policyRepo.find({
      where: { ebayAccountId, marketplaceId, policyType },
    });

    const candidates = rows
      .filter((r) => r.name?.trim() === trimmed)
      .map((r) => ({
        ebayPolicyId: r.ebayPolicyId,
        isDefault: r.isDefault,
        geoSite: readPolicyGeoSite(r.rawPayload ?? {}),
        rawPayload: r.rawPayload ?? {},
      }));

    if (!candidates.length) {
      this.logger.warn(
        `Profile name "${trimmed}" (${policyType}) not found in synced policies ` +
          `for account ${ebayAccountId} / ${marketplaceId}. Falling back to default policy resolution.`,
      );
      return undefined;
    }

    const resolved =
      policyType === 'return'
        ? pickReturnPolicyIdForListing(
            candidates,
            marketplaceId,
            categoryId,
            condition,
          )
        : pickPolicyIdForMarketplace(candidates, marketplaceId);

    return coalesceValidPolicyId(resolved ?? undefined);
  }

  private async pickCompliantReturnPolicyFromStore(
    ebayAccountId: string,
    marketplaceId: string,
    categoryId?: string,
    condition?: string,
  ): Promise<string | undefined> {
    const synced = await this.resolvePoliciesFromSyncedTable(
      ebayAccountId,
      marketplaceId,
      categoryId,
      condition,
    );
    return synced.returnPolicyId;
  }

  /** Pull marketplace-scoped business policies from eBay Account API. */
  private async refreshPoliciesFromEbayApi(
    store: Store,
    account: ConnectedEbayAccount,
    options?: { persist?: boolean; categoryId?: string; condition?: string },
  ): Promise<{
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  }> {
    const HARD_TIMEOUT_MS = 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);

    try {
      // Use normal token expiry logic — don't force-refresh from SellerPundit
      // since the token was already refreshed during the earlier publish step.
      const token = await this.auth.getAccessToken(store.id);
      const baseUrl = await this.auth.getApiBaseUrlForStore(store.id);
      const marketplaceId = resolveMarketplaceId(store);

      const [fulfill, payment, ret] = await Promise.all([
        this.sellAccount.listFulfillmentPolicies(
          token,
          baseUrl,
          marketplaceId,
          controller.signal,
        ),
        this.sellAccount.listPaymentPolicies(
          token,
          baseUrl,
          marketplaceId,
          controller.signal,
        ),
        this.sellAccount.listReturnPolicies(
          token,
          baseUrl,
          marketplaceId,
          controller.signal,
        ),
      ]);
      const pick = (items: { ebayPolicyId: string; isDefault: boolean }[]) =>
        items.find((x) => x.isDefault)?.ebayPolicyId ?? items[0]?.ebayPolicyId;
      const fulfillmentPolicyId = coalesceValidPolicyId(pick(fulfill));
      const paymentPolicyId = coalesceValidPolicyId(pick(payment));
      const returnPolicyId = coalesceValidPolicyId(
        pickReturnPolicyIdForListing(
          ret.map((r) => ({
            ebayPolicyId: r.ebayPolicyId,
            isDefault: r.isDefault,
            geoSite: readPolicyGeoSite(r.raw),
            rawPayload: r.raw,
          })),
          marketplaceId,
          options?.categoryId,
          options?.condition,
        ),
      );

      if (
        options?.persist &&
        (fulfillmentPolicyId || paymentPolicyId || returnPolicyId)
      ) {
        await this.persistAccountApiPolicies(
          account.id,
          marketplaceId,
          { fulfill, payment, ret },
          {
            fulfillmentPolicyId,
            paymentPolicyId,
            returnPolicyId,
          },
        );
      }

      if (fulfillmentPolicyId || paymentPolicyId || returnPolicyId) {
        this.logger.debug(
          `Refreshed eBay policies for "${store.storeName}" (${marketplaceId})`,
        );
      }
      return { fulfillmentPolicyId, paymentPolicyId, returnPolicyId };
    } catch (err: unknown) {
      const aborted = controller.signal.aborted;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        aborted
          ? `eBay policy refresh timed out for "${store.storeName}" after ${HARD_TIMEOUT_MS / 1000}s`
          : `Could not refresh eBay policies for "${store.storeName}": ${message}`,
      );
      return {};
    } finally {
      clearTimeout(timer);
    }
  }

  /** Determine which source provided the winning policy ID for logging. */
  private policyResolutionSource(
    reqId?: string | null,
    nameResolvedId?: string | null,
    refreshedId?: string | null,
    syncedId?: string | null,
    defaultId?: string | null,
    storeId?: string | null,
  ): string {
    if (reqId && coalesceValidPolicyId(reqId)) return 'user-selected';
    if (nameResolvedId && coalesceValidPolicyId(nameResolvedId))
      return 'profile-name';
    if (refreshedId && coalesceValidPolicyId(refreshedId))
      return 'ebay-api-refresh';
    if (syncedId && coalesceValidPolicyId(syncedId)) return 'synced-table';
    if (defaultId && coalesceValidPolicyId(defaultId))
      return 'marketplace-default';
    if (storeId && coalesceValidPolicyId(storeId)) return 'store-fallback';
    return 'none';
  }

  private async persistAccountApiPolicies(
    ebayAccountId: string,
    marketplaceId: string,
    lists: {
      fulfill: Array<{
        ebayPolicyId: string;
        name: string;
        isDefault: boolean;
        raw: Record<string, unknown>;
      }>;
      payment: Array<{
        ebayPolicyId: string;
        name: string;
        isDefault: boolean;
        raw: Record<string, unknown>;
      }>;
      ret: Array<{
        ebayPolicyId: string;
        name: string;
        isDefault: boolean;
        raw: Record<string, unknown>;
      }>;
    },
    defaults: {
      fulfillmentPolicyId?: string;
      paymentPolicyId?: string;
      returnPolicyId?: string;
    },
  ): Promise<void> {
    if (!lists.fulfill.length && !lists.payment.length && !lists.ret.length) {
      return;
    }

    // Atomic replace: delete old + insert new in a single transaction
    await this.policyRepo.manager.transaction(async (trx) => {
      await trx.delete(EbayBusinessPolicy, { ebayAccountId, marketplaceId });

      for (const p of lists.fulfill) {
        await trx.save(
          trx.create(EbayBusinessPolicy, {
            ebayAccountId,
            marketplaceId,
            policyType: 'fulfillment',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
      }
      for (const p of lists.payment) {
        await trx.save(
          trx.create(EbayBusinessPolicy, {
            ebayAccountId,
            marketplaceId,
            policyType: 'payment',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
      }
      for (const p of lists.ret) {
        await trx.save(
          trx.create(EbayBusinessPolicy, {
            ebayAccountId,
            marketplaceId,
            policyType: 'return',
            ebayPolicyId: p.ebayPolicyId,
            name: p.name,
            rawPayload: p.raw,
            isDefault: p.isDefault,
          }),
        );
      }
    });

    const mpRow = await this.mpRepo.findOne({
      where: { ebayAccountId, marketplaceId },
    });
    if (!mpRow) return;

    let dirty = false;
    if (
      defaults.fulfillmentPolicyId &&
      mpRow.defaultFulfillmentPolicyId !== defaults.fulfillmentPolicyId
    ) {
      mpRow.defaultFulfillmentPolicyId = defaults.fulfillmentPolicyId;
      dirty = true;
    }
    if (
      defaults.paymentPolicyId &&
      mpRow.defaultPaymentPolicyId !== defaults.paymentPolicyId
    ) {
      mpRow.defaultPaymentPolicyId = defaults.paymentPolicyId;
      dirty = true;
    }
    if (
      defaults.returnPolicyId &&
      mpRow.defaultReturnPolicyId !== defaults.returnPolicyId
    ) {
      mpRow.defaultReturnPolicyId = defaults.returnPolicyId;
      dirty = true;
    }
    if (dirty) await this.mpRepo.save(mpRow);
  }

  /** Resolve merchantLocationKey from request, DB, sibling marketplace, or eBay API (create if needed). */
  private async resolveMerchantLocationKey(
    store: Store,
    req: PublishRequest,
    mpDefaultKey?: string | null,
    ebayAccountId?: string,
  ): Promise<string | undefined> {
    let merchantLocationKey =
      req.merchantLocationKey?.trim() ||
      mpDefaultKey?.trim() ||
      store.locationKey?.trim() ||
      undefined;

    const storeConfig = store.config ?? {};
    if (!merchantLocationKey && typeof storeConfig.locationKey === 'string') {
      merchantLocationKey = storeConfig.locationKey.trim() || undefined;
    }

    if (!merchantLocationKey && ebayAccountId) {
      const sibling = await this.mpRepo.findOne({
        where: {
          ebayAccountId,
          defaultInventoryLocationKey: Not(IsNull()),
        },
      });
      if (sibling?.defaultInventoryLocationKey?.trim()) {
        merchantLocationKey = sibling.defaultInventoryLocationKey.trim();
      }
    }

    if (!merchantLocationKey) {
      const ensured = await this.inventoryApi.ensureMerchantLocation(
        store.id,
        req.merchantLocationKey ?? store.locationKey,
      );
      if (ensured) {
        merchantLocationKey = ensured;
      } else {
        this.logger.warn(
          `No inventory location for "${store.storeName}" — map a merchant location key in Settings → eBay Integrations.`,
        );
      }
    }

    return merchantLocationKey;
  }

  /** Publish via SellerPundit bulk-create API; falls back to direct eBay on platform errors. */
  private async publishViaSellerpundit(
    store: Store,
    account: ConnectedEbayAccount,
    req: PublishRequest,
  ): Promise<PublishResult> {
    const marketplaceId = this.resolvePublishMarketplaceId(account, store);

    let enrichedReq: PublishRequest;
    try {
      enrichedReq = await this.enrichPoliciesFromMarketplace(
        account,
        store,
        req,
      );
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        const response = err.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : typeof response === 'object' &&
                response !== null &&
                'message' in response
              ? String((response as { message: unknown }).message)
              : err.message;
        return {
          storeId: store.id,
          storeName: store.storeName,
          success: false,
          error: message,
        };
      }
      throw err;
    }
    this.logger.log(
      `SellerPundit publish policies for "${store.storeName}" (${marketplaceId}, category=${enrichedReq.categoryId ?? 'n/a'}): ` +
        `fulfillment=${enrichedReq.fulfillmentPolicyId ?? 'missing'}, ` +
        `payment=${enrichedReq.paymentPolicyId ?? 'missing'}, ` +
        `return=${enrichedReq.returnPolicyId ?? 'missing'}`,
    );

    const built: ListingBuilderResult = {
      publishRequest: { ...enrichedReq, storeIds: [store.id] },
      warnings: [],
      blockingErrors: [],
    };

    const spResult = await this.sellerpunditListing.publish(
      built,
      account,
      marketplaceId,
    );

    if (spResult.success) {
      return {
        storeId: store.id,
        storeName: store.storeName,
        success: true,
        offerId: spResult.offerId,
        listingId: spResult.listingId,
      };
    }

    const error =
      spResult.error ??
      spResult.errors?.join('; ') ??
      'SellerPundit publish failed';

    if (!spResult.platformError) {
      this.logger.error(
        `SellerPundit publish failed for "${req.sku}" on "${store.storeName}": ${error}`,
      );
    }

    return {
      storeId: store.id,
      storeName: store.storeName,
      success: false,
      error,
      platformError: spResult.platformError,
    };
  }

  /**
   * Delete a stale offer + inventory item on eBay so a fresh offer with the
   * correct category can be created. This is needed when a previous publish
   * created an offer with an invalid category that eBay refuses to update
   * (errorId 25005).
   */
  private async purgeStaleEbayInventory(
    storeId: string,
    sku: string,
    offerId?: string,
    inventoryItem?: EbayInventoryItem,
  ): Promise<void> {
    try {
      if (offerId) {
        // Withdraw first if the offer is published
        try {
          await this.inventoryApi.withdrawOffer(storeId, offerId);
          this.logger.log(`Withdrew stale offer ${offerId} for SKU ${sku}`);
        } catch {
          // Offer may not be published — try deleting directly
        }
        try {
          await this.inventoryApi.deleteOffer(storeId, offerId);
          this.logger.log(`Deleted stale offer ${offerId} for SKU ${sku}`);
        } catch {
          // Offer may have been withdrawn already
        }
      }

      // Find and delete any remaining offers for this SKU
      try {
        const { offers } = await this.inventoryApi.getOffersBySku(storeId, sku);
        for (const o of offers) {
          if (!o.offerId) continue;
          try {
            if (o.status === 'PUBLISHED') {
              await this.inventoryApi.withdrawOffer(storeId, o.offerId);
            }
            await this.inventoryApi.deleteOffer(storeId, o.offerId);
            this.logger.log(
              `Deleted remaining offer ${o.offerId} for SKU ${sku}`,
            );
          } catch {
            // Best effort
          }
        }
      } catch {
        // No offers found — fine
      }

      // Delete the inventory item itself
      await this.inventoryApi.deleteItem(storeId, sku);
      this.logger.log(
        `Purged stale inventory item for SKU ${sku} — ready for fresh publish`,
      );

      // Recreate the inventory item so createOffer can succeed
      if (inventoryItem) {
        await this.inventoryApi.createOrReplaceItem(
          storeId,
          sku,
          inventoryItem,
        );
        this.logger.log(`Recreated inventory item for SKU ${sku}`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not fully purge stale inventory for SKU ${sku}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Reuse an unpublished offer for the SKU when createOffer returns 25002. */
  private async resolveOrCreateOfferId(
    storeId: string,
    offer: EbayOffer,
    store?: Store,
    inventoryItem?: EbayInventoryItem,
  ): Promise<string> {
    try {
      const created = await this.inventoryApi.createOffer(storeId, offer);
      return created.offerId;
    } catch (err: unknown) {
      if (!isEbayOfferAlreadyExistsError(err)) throw err;

      const existingOfferId = extractEbayErrorParameter(err, 'offerId');
      if (existingOfferId) {
        this.logger.warn(
          `Offer already exists for SKU ${offer.sku} — updating offer ${existingOfferId}`,
        );
        try {
          await this.inventoryApi.updateOffer(storeId, existingOfferId, offer);
          return existingOfferId;
        } catch (updateErr: unknown) {
          if (!isEbayInvalidCategoryError(updateErr)) throw updateErr;
          this.logger.warn(
            `Offer ${existingOfferId} for SKU ${offer.sku} has a stale/invalid category — purging and recreating`,
          );
          await this.purgeStaleEbayInventory(
            storeId,
            offer.sku,
            existingOfferId,
            inventoryItem,
          );
          const recreated = await this.inventoryApi.createOffer(storeId, offer);
          return recreated.offerId;
        }
      }

      const { offers } = await this.inventoryApi.getOffersBySku(
        storeId,
        offer.sku,
      );
      const unpublished = offers.find(
        (o) => o.status !== 'PUBLISHED' && o.offerId,
      );
      if (!unpublished?.offerId) throw err;

      this.logger.warn(
        `Offer already exists for SKU ${offer.sku} — updating offer ${unpublished.offerId}`,
      );
      try {
        await this.inventoryApi.updateOffer(
          storeId,
          unpublished.offerId,
          offer,
        );
        return unpublished.offerId;
      } catch (updateErr: unknown) {
        if (!isEbayInvalidCategoryError(updateErr)) throw updateErr;
        this.logger.warn(
          `Offer ${unpublished.offerId} for SKU ${offer.sku} has a stale/invalid category — purging and recreating`,
        );
        await this.purgeStaleEbayInventory(
          storeId,
          offer.sku,
          unpublished.offerId,
          inventoryItem,
        );
        const recreated = await this.inventoryApi.createOffer(storeId, offer);
        return recreated.offerId;
      }
    }
  }

  private async publishOfferWithRetries(
    storeId: string,
    offerId: string,
    store: Store,
    account: ConnectedEbayAccount | null | undefined,
    req: PublishRequest,
  ): Promise<EbayPublishResponse> {
    try {
      return await this.inventoryApi.publishOffer(storeId, offerId);
    } catch (publishErr: unknown) {
      if (!account || !isEbayRecoverableBusinessPolicyError(publishErr)) {
        throw publishErr;
      }

      const marketplaceId = resolveMarketplaceId(store);
      const paReturnIssue = isEbayPartsAccessoriesReturnPolicyError(publishErr);

      this.logger.warn(
        paReturnIssue
          ? `Publish rejected P&A return policy for offer ${offerId} — selecting compliant return policy and retrying`
          : `Publish rejected business policies for offer ${offerId} — refreshing from eBay Account API and retrying`,
      );

      const refreshed = await this.refreshPoliciesFromEbayApi(store, account, {
        persist: true,
        categoryId: req.categoryId,
        condition: req.condition,
      });

      let returnPolicyId: string | undefined;
      const paReturnRequired = listingRequiresPartsAccessoriesReturnPolicy(
        marketplaceId,
        req.categoryId,
        req.condition,
      );

      if (paReturnIssue && !paReturnRequired) {
        throw new BadRequestException(
          `eBay reported a Parts & Accessories return policy error, but this listing condition (${req.condition ?? 'unknown'}) is not New or New Other — seller-paid return shipping is only mandatory for those conditions per eBay Seller Center. Verify the condition sent to eBay (expect 3000 / USED_EXCELLENT for used parts). If the condition is correct, contact eBay support or SellerPundit — the API may be over-enforcing the rule.`,
        );
      }

      if (paReturnRequired) {
        const ensured = await this.paReturnPolicy.ensureCompliantReturnPolicy({
          store,
          account,
          marketplaceId,
          categoryId: req.categoryId,
          condition: req.condition,
          currentReturnPolicyId: refreshed.returnPolicyId ?? req.returnPolicyId,
        });
        if (ensured.action === 'blocked') {
          throw new BadRequestException(
            ensured.blockedMessage ?? partsAccessoriesReturnPolicyGuidance(),
          );
        }
        returnPolicyId = ensured.returnPolicyId ?? undefined;
      } else {
        returnPolicyId =
          refreshed.returnPolicyId ??
          (await this.pickCompliantReturnPolicyFromStore(
            account.id,
            marketplaceId,
            req.categoryId,
            req.condition,
          ));
      }

      if (
        !refreshed.fulfillmentPolicyId ||
        !refreshed.paymentPolicyId ||
        !returnPolicyId
      ) {
        if (paReturnIssue) {
          throw new BadRequestException(partsAccessoriesReturnPolicyGuidance());
        }
        throw publishErr;
      }

      // Fetch existing offer first — PUT replaces the entire offer, so we must
      // include all existing fields (pricing, category, etc.) to avoid wiping them.
      const existingOffer = await this.inventoryApi.getOffer(storeId, offerId);
      await this.inventoryApi.updateOffer(storeId, offerId, {
        ...existingOffer,
        listingPolicies: {
          fulfillmentPolicyId: refreshed.fulfillmentPolicyId,
          paymentPolicyId: refreshed.paymentPolicyId,
          returnPolicyId,
        },
      });
      return this.inventoryApi.publishOffer(storeId, offerId);
    }
  }

  /**
   * Motors P&A categories often reject USED_GOOD for legacy 3000-Used imports.
   */
  private fallbackConditionForCategory(
    req: PublishRequest,
  ): EbayConditionEnum | undefined {
    const current = mapToEbayConditionEnum(req.condition);
    const usedLike = new Set<EbayConditionEnum>([
      'USED_GOOD',
      'USED_VERY_GOOD',
      'USED_ACCEPTABLE',
    ]);
    if (!usedLike.has(current)) return undefined;
    return 'USED_EXCELLENT';
  }

  /**
   * Build an EbayInventoryItem from the publish request.
   */
  private buildInventoryItem(
    req: PublishRequest,
    store: Store,
  ): EbayInventoryItem {
    const condition = mapToEbayConditionEnum(req.condition);
    const marketplaceId = resolveMarketplaceId(store);
    const item: EbayInventoryItem = {
      availability: {
        shipToLocationAvailability: {
          quantity: req.quantity,
        },
      },
      condition,
      conditionDescription: req.conditionDescription,
      product: {
        title: req.title,
        description: req.description,
        aspects: localizeAspectsForMarketplace(req.aspects, marketplaceId),
        imageUrls: req.imageUrls,
      },
    };

    return item;
  }

  /**
   * Build an EbayOffer from the publish request and store config.
   */
  private buildOffer(req: PublishRequest, store: Store): EbayOffer {
    const storeConfig = (store.config ?? {}) as Record<string, any>;
    const marketplace = resolveMarketplaceId(store);

    const format = req.listingFormat ?? 'FIXED_PRICE';

    const offer: EbayOffer = {
      sku: req.sku,
      marketplaceId: toEbayInventoryApiMarketplaceId(marketplace),
      format,
      listingDescription: req.description,
      pricingSummary: {
        price: {
          value: req.price.toFixed(2),
          currency: req.currency ?? this.mpConfig.require(marketplace).currency,
        },
      },
      categoryId: req.categoryId,
      listingPolicies: {
        fulfillmentPolicyId:
          req.fulfillmentPolicyId ?? storeConfig.fulfillmentPolicyId,
        paymentPolicyId: req.paymentPolicyId ?? storeConfig.paymentPolicyId,
        returnPolicyId: req.returnPolicyId ?? storeConfig.returnPolicyId,
      },
      merchantLocationKey: req.merchantLocationKey ?? storeConfig.locationKey,
    };

    offer.listingDuration =
      req.listingDuration ?? (format === 'FIXED_PRICE' ? 'GTC' : undefined);

    return offer;
  }

  /**
   * Update price and quantity for an existing published listing.
   */
  async updatePriceQuantity(
    storeId: string,
    offers: {
      offerId: string;
      price: number;
      quantity: number;
      currency?: string;
    }[],
  ) {
    return this.inventoryApi.bulkUpdatePriceQuantity(
      storeId,
      offers.map((o) => ({
        offers: [
          {
            offerId: o.offerId,
            price: { value: o.price.toFixed(2), currency: o.currency ?? 'USD' },
            availableQuantity: o.quantity,
          },
        ],
      })),
    );
  }

  /**
   * End a listing by withdrawing the offer.
   */
  async endListing(storeId: string, offerId: string): Promise<void> {
    await this.inventoryApi.withdrawOffer(storeId, offerId);
    this.logger.log(`Ended listing (offer ${offerId}) on store ${storeId}`);
  }
}

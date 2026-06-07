import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Store } from '../entities/store.entity.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
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
  isEbayInvalidItemConditionError,
  isEbayOfferAlreadyExistsError,
  isEbayPartsAccessoriesReturnPolicyError,
  isEbayRecoverableBusinessPolicyError,
} from './ebay-api-error.util.js';
import { EbayBusinessPolicy } from '../../integrations/ebay/entities/ebay-business-policy.entity.js';
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
} from './ebay-listing-aspects.util.js';

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

  constructor(
    private readonly config: ConfigService,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly taxonomyApi: EbayTaxonomyApiService,
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

    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (listing?.itemPhotoUrl) {
      const fromListing = sanitizeEbayImageUrls([listing.itemPhotoUrl]);
      if (fromListing.imageUrls.length) return fromListing;
    }

    const catalog = await this.catalogRepo.findOne({ where: { id: listingId } });
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

  /** Backfill SKU, text, category, condition, and pricing from listing_records when the client sends stubs. */
  private async enrichPublishRequest(req: PublishRequest): Promise<PublishRequest> {
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
      !req.sku?.trim() ||
      req.sku === req.listingId ||
      req.sku === listing.id;
    const sku = (skuLooksLikeListingId
      ? listing.customLabelSku?.trim() || req.sku
      : req.sku.trim()) + 'IGBC';

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
      brand: listing.cBrand,
      mpn: listing.cManufacturerPartNumber,
      partType: listing.cType,
      upc: listing.pUpc,
      oeOemPartNumber: listing.cOeOemPartNumber,
      existing: req.aspects,
    });

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
    };
  }

  private validateDirectOffer(
    offer: EbayOffer,
    store: Store,
  ): string | null {
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
    const sanitized = sanitizePublishListingText({
      title: enriched.title,
      description: enriched.description,
      sku: enriched.sku,
      brand: listing?.cBrand,
      mpn: listing?.cManufacturerPartNumber,
      partType: listing?.cType,
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

    return results;
  }

  /**
   * Batch publish listing records using backend enrichment (images, condition, policies).
   * Callers may pass stub fields; `enrichPublishRequest` backfills from `listing_records`.
   */
  async publishByListingIds(
    listingIds: string[],
    storeIds: string[],
  ): Promise<Array<{ listingId: string; results: PublishResult[] }>> {
    if (!storeIds.length) {
      throw new BadRequestException('At least one storeId is required');
    }
    const allResults: Array<{ listingId: string; results: PublishResult[] }> = [];
    for (const listingId of listingIds) {
      const results = await this.publish(this.stubPublishRequest(listingId, storeIds));
      allResults.push({ listingId, results });
    }
    return allResults;
  }

  /** Minimal publish payload; enrichment fills title, SKU, images, condition, policies. */
  stubPublishRequest(listingId: string, storeIds: string[]): PublishRequest {
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

    const fallbackMode = parseSellerpunditPublishFallbackMode(
      this.config.get<string>('SELLERPUNDIT_PUBLISH_FALLBACK'),
    );

    if (
      account?.connectionSource === 'sellerpundit' &&
      shouldAttemptSellerpunditBulkCreate(fallbackMode, req.forceDirectEbay)
    ) {
      const spResult = await this.publishViaSellerpundit(store, account, req);
      if (spResult.success) {
        return spResult;
      }
      if (shouldFallbackFromSellerpunditBulkCreate(fallbackMode, spResult)) {
        this.logger.warn(
          `SellerPundit bulk-create unavailable for "${store.storeName}" — falling back to direct eBay Inventory API`,
        );
        const enriched = await this.enrichPoliciesFromMarketplace(
          account,
          store,
          req,
        );
        return this.publishViaDirectEbay(store, storeId, {
          ...enriched,
          forceDirectEbay: true,
        }, account);
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
      const inventoryItem = this.buildInventoryItem(req);
      await this.inventoryApi.createOrReplaceItem(storeId, req.sku, inventoryItem);

      if (req.compatibility?.compatibleProducts?.length) {
        await this.inventoryApi.setCompatibility(
          storeId,
          req.sku,
          req.compatibility,
        );
      }

      const offer = this.buildOffer(req, store);
      const offerValidationError = this.validateDirectOffer(offer, store);
      if (offerValidationError) {
        return {
          storeId,
          storeName: store.storeName,
          success: false,
          error: offerValidationError,
        };
      }

      const offerId = await this.resolveOrCreateOfferId(storeId, offer);

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
            const retryItem = this.buildInventoryItem({
              ...req,
              condition: fallbackCondition,
            });
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
      errorMsg =
        account?.connectionSource === 'sellerpundit'
          ? `eBay authorization failed for "${store.storeName}". Re-sync stores in Settings → eBay Integrations (SellerPundit must have a valid eBay connection for this account).`
          : `eBay authorization failed for "${store.storeName}". Re-sync or reconnect this store in Settings → eBay Integrations.`;
    }
    const responseData = (err as { response?: { data?: unknown } })?.response?.data;
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
    let merchantLocationKey = await this.resolveMerchantLocationKey(store, req);
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
        const policyResult = await this.sellerpunditPolicies.ensurePoliciesFresh(
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

    let merchantLocationKey = await this.resolveMerchantLocationKey(
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
    const resolvedFulfillment = coalesceValidPolicyId(
      req.fulfillmentPolicyId,
      synced.fulfillmentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultFulfillmentPolicyId
        : undefined,
    );
    const resolvedPayment = coalesceValidPolicyId(
      req.paymentPolicyId,
      synced.paymentPolicyId,
      hasValidDefaultPolicyIds(mpRow) ? mpRow?.defaultPaymentPolicyId : undefined,
    );
    const resolvedReturn = coalesceValidPolicyId(
      req.returnPolicyId,
      synced.returnPolicyId,
      hasValidDefaultPolicyIds(mpRow) ? mpRow?.defaultReturnPolicyId : undefined,
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
      refreshed.fulfillmentPolicyId,
      synced.fulfillmentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultFulfillmentPolicyId
        : undefined,
      store.fulfillmentPolicyId,
    );
    const paymentPolicyId = coalesceValidPolicyId(
      req.paymentPolicyId,
      refreshed.paymentPolicyId,
      synced.paymentPolicyId,
      hasValidDefaultPolicyIds(mpRow)
        ? mpRow?.defaultPaymentPolicyId
        : undefined,
      store.paymentPolicyId,
    );
    let returnPolicyId = coalesceValidPolicyId(
      req.returnPolicyId,
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
        if (
          ensured.action === 'upgraded' ||
          ensured.action === 'created'
        ) {
          this.logger.log(
            `P&A return policy ${ensured.action}: ${ensured.returnPolicyId} for store "${store.storeName}"`,
          );
        }
        returnPolicyId = ensured.returnPolicyId;
      } else if (paReturnRequired) {
        throw new BadRequestException(partsAccessoriesReturnPolicyGuidance());
      }
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
    try {
      const token = await this.auth.getAccessToken(store.id, {
        forceRefresh: account.connectionSource === 'sellerpundit',
      });
      const baseUrl = await this.auth.getApiBaseUrlForStore(store.id);
      const marketplaceId = resolveMarketplaceId(store);
      const [fulfill, payment, ret] = await Promise.all([
        this.sellAccount.listFulfillmentPolicies(token, baseUrl, marketplaceId),
        this.sellAccount.listPaymentPolicies(token, baseUrl, marketplaceId),
        this.sellAccount.listReturnPolicies(token, baseUrl, marketplaceId),
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
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not refresh eBay policies for "${store.storeName}": ${message}`,
      );
      return {};
    }
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

    await this.policyRepo.delete({ ebayAccountId, marketplaceId });

    for (const p of lists.fulfill) {
      await this.policyRepo.save(
        this.policyRepo.create({
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
      await this.policyRepo.save(
        this.policyRepo.create({
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
      await this.policyRepo.save(
        this.policyRepo.create({
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

    const storeConfig = (store.config ?? {}) as Record<string, unknown>;
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

  /** Reuse an unpublished offer for the SKU when createOffer returns 25002. */
  private async resolveOrCreateOfferId(
    storeId: string,
    offer: EbayOffer,
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
        await this.inventoryApi.updateOffer(storeId, existingOfferId, offer);
        return existingOfferId;
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
      await this.inventoryApi.updateOffer(storeId, unpublished.offerId, offer);
      return unpublished.offerId;
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
          currentReturnPolicyId:
            refreshed.returnPolicyId ?? req.returnPolicyId,
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

      await this.inventoryApi.updateOffer(storeId, offerId, {
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
  private buildInventoryItem(req: PublishRequest): EbayInventoryItem {
    const condition = mapToEbayConditionEnum(req.condition);
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
        aspects: req.aspects,
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
        paymentPolicyId:
          req.paymentPolicyId ?? storeConfig.paymentPolicyId,
        returnPolicyId:
          req.returnPolicyId ?? storeConfig.returnPolicyId,
      },
      merchantLocationKey:
        req.merchantLocationKey ?? storeConfig.locationKey,
    };

    offer.listingDuration =
      req.listingDuration ??
      (format === 'FIXED_PRICE' ? 'GTC' : undefined);

    return offer;
  }

  /**
   * Update price and quantity for an existing published listing.
   */
  async updatePriceQuantity(
    storeId: string,
    offers: { offerId: string; price: number; quantity: number; currency?: string }[],
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

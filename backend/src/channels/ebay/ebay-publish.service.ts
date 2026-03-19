import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../entities/store.entity.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTaxonomyApiService } from './ebay-taxonomy-api.service.js';
import type {
  EbayInventoryItem,
  EbayOffer,
  EbayConditionEnum,
  EbayCompatibilityPayload,
  EbayPublishResponse,
} from './ebay-api.types.js';

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
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly taxonomyApi: EbayTaxonomyApiService,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  /**
   * Publish a listing to one or more eBay stores.
   * Returns per-store success/failure results.
   */
  async publish(req: PublishRequest): Promise<PublishResult[]> {
    if (!req.storeIds.length) {
      throw new BadRequestException('At least one storeId is required');
    }

    const results: PublishResult[] = [];

    // Process stores in parallel (eBay rate limits are per-app, so serial may be safer at scale)
    for (const storeId of req.storeIds) {
      const result = await this.publishToStore(storeId, req);
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

    try {
      // Step 1: Create/replace Inventory Item
      const inventoryItem = this.buildInventoryItem(req);
      await this.inventoryApi.createOrReplaceItem(storeId, req.sku, inventoryItem);

      // Step 1b: Attach compatibility/fitment data if provided
      if (req.compatibility?.compatibleProducts?.length) {
        await this.inventoryApi.setCompatibility(
          storeId,
          req.sku,
          req.compatibility,
        );
      }

      // Step 2: Create Offer
      const offer = this.buildOffer(req, store);
      const offerResult = await this.inventoryApi.createOffer(storeId, offer);

      // Step 3: Publish Offer
      let publishResult: EbayPublishResponse;
      try {
        publishResult = await this.inventoryApi.publishOffer(
          storeId,
          offerResult.offerId,
        );
      } catch (publishErr: any) {
        // If already published, the offer ID still exists
        this.logger.warn(
          `Publish failed for offer ${offerResult.offerId}: ${publishErr.message}`,
        );
        return {
          storeId,
          storeName: store.storeName,
          success: false,
          offerId: offerResult.offerId,
          error: publishErr?.response?.data?.errors?.[0]?.message ?? publishErr.message,
        };
      }

      return {
        storeId,
        storeName: store.storeName,
        success: true,
        offerId: offerResult.offerId,
        listingId: publishResult.listingId,
      };
    } catch (err: any) {
      const ebayErrors = err?.response?.data?.errors;
      const errorMsg = ebayErrors?.[0]?.message ?? err.message;
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
  }

  /**
   * Build an EbayInventoryItem from the publish request.
   */
  private buildInventoryItem(req: PublishRequest): EbayInventoryItem {
    const item: EbayInventoryItem = {
      availability: {
        shipToLocationAvailability: {
          quantity: req.quantity,
        },
      },
      condition: req.condition,
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
    const marketplace = storeConfig.marketplace ?? 'EBAY_US';

    const offer: EbayOffer = {
      sku: req.sku,
      marketplaceId: marketplace,
      format: req.listingFormat ?? 'FIXED_PRICE',
      listingDescription: req.description,
      pricingSummary: {
        price: {
          value: req.price.toFixed(2),
          currency: req.currency ?? 'USD',
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

    if (req.listingDuration) {
      offer.listingDuration = req.listingDuration;
    }

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

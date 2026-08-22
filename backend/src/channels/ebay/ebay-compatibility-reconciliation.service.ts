import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import axios from 'axios';
import type {
  EbayCompatibilityPayload,
  EbayCompatibleProduct,
  EbayInventoryItem,
  EbayOffer,
} from './ebay-api.types.js';
import { EbayInventoryApiService } from './ebay-inventory-api.service.js';
import { EbayTradingApiService } from './ebay-trading-api.service.js';
import { EbayAuthService } from './ebay-auth.service.js';
import { EbaySellAccountApiService } from '../../integrations/ebay/services/ebay-sell-account-api.service.js';

export interface EbayFreshOfferRecovery {
  sku: string;
  offerId: string;
  listingId: string;
}

/**
 * Keeps the two eBay compatibility representations in lockstep.
 *
 * Inventory API compatibility belongs to the SKU.  Older/live listings can
 * also retain the legacy Trading API ItemCompatibilityList when an offer is
 * reused.  Both must be verified because either one can be the source eBay
 * displays to buyers.
 */
@Injectable()
export class EbayCompatibilityReconciliationService {
  private readonly logger = new Logger(
    EbayCompatibilityReconciliationService.name,
  );

  constructor(
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly tradingApi: EbayTradingApiService,
    @Optional() private readonly auth?: EbayAuthService,
    @Optional() private readonly sellAccount?: EbaySellAccountApiService,
  ) {}

  emptyPayload(): EbayCompatibilityPayload {
    return { compatibleProducts: [] };
  }

  normalize(payload?: EbayCompatibilityPayload | null): EbayCompatibilityPayload {
    return {
      compatibleProducts: Array.isArray(payload?.compatibleProducts)
        ? payload!.compatibleProducts
        : [],
    };
  }

  rowKey(row: EbayCompatibleProduct): string {
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

  assertExactRows(
    sku: string,
    expected: EbayCompatibilityPayload,
    actual: EbayCompatibilityPayload | null | undefined,
    source: string,
  ): void {
    const expectedKeys = new Set(
      expected.compatibleProducts.map((row) => this.rowKey(row)).filter(Boolean),
    );
    const actualKeys = new Set(
      (actual?.compatibleProducts ?? [])
        .map((row) => this.rowKey(row))
        .filter(Boolean),
    );
    const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
    const unexpected = [...actualKeys].filter((key) => !expectedKeys.has(key));
    if (missing.length > 0 || unexpected.length > 0) {
      throw new BadRequestException(
        `eBay compatibility verification failed for SKU ${sku} (${source}): ` +
          `${missing.length} expected row(s) missing and ${unexpected.length} stale row(s) present.`,
      );
    }
  }

  /** Replace the Inventory API state and verify that eBay persisted it exactly. */
  async syncInventory(
    storeId: string,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<EbayCompatibilityPayload> {
    const expected = this.normalize(payload);
    if (expected.compatibleProducts.length > 0) {
      await this.inventoryApi.setCompatibility(storeId, sku, expected);
    } else {
      try {
        await this.inventoryApi.deleteCompatibility(storeId, sku);
      } catch (err: unknown) {
        if (!this.isNotFound(err)) throw err;
        this.logger.debug(`No Inventory API compatibility existed for ${sku}`);
      }
    }

    let actual: EbayCompatibilityPayload;
    try {
      actual = await this.inventoryApi.getCompatibility(storeId, sku);
    } catch (err: unknown) {
      if (!this.isNotFound(err)) throw err;
      actual = this.emptyPayload();
    }
    this.assertExactRows(sku, expected, actual, 'Inventory API');
    this.logger.log(
      `Verified ${expected.compatibleProducts.length} Inventory API compatibility row(s) for SKU ${sku}`,
    );
    return expected;
  }

  /**
   * Push the already-reconciled SKU compatibility into a published Inventory
   * API offer. eBay documents updateOffer as the operation that propagates a
   * published offer change to its active listing; Trading revise calls are
   * rejected for Inventory API-managed listings.
   */
  async refreshPublishedOffer(
    storeId: string,
    offerId: string,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<string | null> {
    const offer = await this.inventoryApi.getOffer(storeId, offerId);
    await this.inventoryApi.updateOffer(storeId, offerId, {
      ...offer,
      includeCatalogProductDetails: false,
      ...(payload ? { compatibility: this.normalize(payload) } : {}),
    });
    this.logger.log(
      `Refreshed published Inventory API offer ${offerId} for SKU ${sku}`,
    );
    return offer.listingId ?? null;
  }

  /**
   * Recreate the Inventory item and offer when eBay's old published projection
   * still contains legacy compatibility rows.  Withdrawing/re-publishing the
   * same offer is not sufficient: eBay can retain the old listing projection.
   * A fresh item/offer pair forces the active listing to be built from the
   * exact compatibility state just verified on the Inventory API.
   */
  async recreatePublishedOffer(
    storeId: string,
    offerId: string,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<string> {
    const [item, offer, offerPage] = await Promise.all([
      this.inventoryApi.getItem(storeId, sku),
      this.inventoryApi.getOffer(storeId, offerId),
      this.inventoryApi.getOffersBySku(storeId, sku, 100, 0),
    ]);
    const otherOffers = offerPage.offers.filter(
      (candidate) => candidate.offerId && candidate.offerId !== offerId,
    );
    if (offerPage.total > offerPage.offers.length || otherOffers.length > 0) {
      throw new BadRequestException(
        `Refusing to recreate SKU ${sku}: another Inventory API offer exists; ` +
          'manual account-level reconciliation is required.',
      );
    }
    // Resolve seller policies before withdrawing anything. A failed policy
    // lookup must leave the active listing untouched.
    const expected = this.normalize(payload);
    const listingPolicies = await this.resolveCurrentListingPolicies(
      storeId,
      offer.marketplaceId,
    );

    if (offer.status === 'PUBLISHED') {
      await this.inventoryApi.withdrawOffer(storeId, offerId);
    }
    await this.inventoryApi.deleteOffer(storeId, offerId);
    await this.inventoryApi.deleteItem(storeId, sku);

    await this.inventoryApi.createOrReplaceItem(
      storeId,
      sku,
      this.inventoryItemPayloadForWrite(item),
    );
    await this.syncInventory(storeId, sku, payload);

    const offerPayload: EbayOffer = {
      sku,
      marketplaceId: offer.marketplaceId,
      format: offer.format,
      listingDescription: offer.listingDescription,
      availableQuantity: offer.availableQuantity,
      categoryId: offer.categoryId,
      merchantLocationKey: offer.merchantLocationKey,
      pricingSummary: offer.pricingSummary,
      listingPolicies,
      tax: offer.tax,
      listingDuration: offer.listingDuration,
      // eBay defaults this to true when omitted. The application owns the
      // exact compatibility list, so catalog-derived fitment must be off.
      includeCatalogProductDetails: false,
      compatibility: expected,
    };
    const created = await this.inventoryApi.createOffer(storeId, {
      ...offerPayload,
    });
    const result = await this.inventoryApi.publishOffer(
      storeId,
      created.offerId,
    );
    if (!result.listingId) {
      throw new BadRequestException(
        `eBay did not return a listing ID while recreating SKU ${sku}.`,
      );
    }
    this.logger.log(
      `Recreated Inventory API offer ${created.offerId} as listing ${result.listingId} for SKU ${sku}`,
    );
    return result.listingId;
  }

  /**
   * Recover a listing when eBay retains a catalog-derived compatibility
   * projection even after the Inventory item and offer are recreated. A new
   * per-listing SKU breaks that retained projection. The item is first
   * published with catalog identifiers neutralized, then restored to the
   * seller's real title/aspects after the zero-row projection is verified.
   *
   * If the caller's offer ID is already stale, use the sole currently
   * published offer for the SKU. This covers interrupted prior recoveries.
   */
  async recreatePublishedOfferWithFreshSku(
    storeId: string,
    offerId: string,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<EbayFreshOfferRecovery> {
    const expected = this.normalize(payload);
    const item = await this.inventoryApi.getItem(storeId, sku);
    let sourceOffer: EbayOffer;
    let sourceOfferId = offerId;
    try {
      sourceOffer = await this.inventoryApi.getOffer(storeId, offerId);
    } catch (err: unknown) {
      if (!this.isNotFound(err)) throw err;
      const page = await this.inventoryApi.getOffersBySku(storeId, sku, 100, 0);
      const published = page.offers.filter(
        (candidate) => candidate.offerId && candidate.status === 'PUBLISHED',
      );
      if (page.total > page.offers.length || published.length !== 1) {
        throw new BadRequestException(
          `Cannot recover SKU ${sku} with a fresh eBay SKU: the original offer ` +
            `is missing and ${page.total} replacement offer(s) are visible.`,
        );
      }
      sourceOffer = published[0];
      sourceOfferId = sourceOffer.offerId!;
    }

    const listingPolicies = await this.resolveCurrentListingPolicies(
      storeId,
      sourceOffer.marketplaceId,
    );
    const freshSku = this.freshInventorySku(sku);
    const finalItem = {
      ...this.inventoryItemPayloadForWrite(item),
      sku: freshSku,
    };
    const neutralItem = this.neutralizeCatalogIdentifiers(finalItem);
    const offerPayload: EbayOffer = {
      sku: freshSku,
      marketplaceId: sourceOffer.marketplaceId,
      format: sourceOffer.format,
      listingDescription: sourceOffer.listingDescription,
      availableQuantity: sourceOffer.availableQuantity ?? 1,
      categoryId: sourceOffer.categoryId,
      merchantLocationKey: sourceOffer.merchantLocationKey,
      pricingSummary: sourceOffer.pricingSummary,
      listingPolicies,
      tax: sourceOffer.tax,
      listingDuration: sourceOffer.listingDuration,
      includeCatalogProductDetails: false,
      compatibility: expected,
    };

    try {
      await this.inventoryApi.createOrReplaceItem(storeId, freshSku, neutralItem);
      await this.syncInventory(storeId, freshSku, expected);
      const created = await this.inventoryApi.createOffer(storeId, offerPayload);
      const published = await this.inventoryApi.publishOffer(
        storeId,
        created.offerId,
      );
      if (!published.listingId) {
        throw new BadRequestException(
          `eBay did not return a listing ID for fresh SKU ${freshSku}.`,
        );
      }
      await this.verifyLiveListing(
        storeId,
        published.listingId,
        sourceOffer.marketplaceId,
        freshSku,
        expected,
      );

      await this.inventoryApi.createOrReplaceItem(storeId, freshSku, finalItem);
      await this.inventoryApi.updateOffer(storeId, created.offerId, {
        ...offerPayload,
        compatibility: expected,
        includeCatalogProductDetails: false,
      });
      await this.verifyLiveListing(
        storeId,
        published.listingId,
        sourceOffer.marketplaceId,
        freshSku,
        expected,
      );

      if (sourceOffer.status === 'PUBLISHED') {
        await this.inventoryApi.withdrawOffer(storeId, sourceOfferId);
      }
      await this.inventoryApi.deleteOffer(storeId, sourceOfferId);
      try {
        const remaining = await this.inventoryApi.getOffersBySku(
          storeId,
          sku,
          100,
          0,
        );
        if (remaining.total === 0) {
          await this.inventoryApi.deleteItem(storeId, sku);
        }
      } catch (err: unknown) {
        if (!this.isNotFound(err)) throw err;
      }

      this.logger.log(
        `Recovered stale eBay projection with fresh SKU ${freshSku}, ` +
          `offer ${created.offerId}, listing ${published.listingId}`,
      );
      return {
        sku: freshSku,
        offerId: created.offerId,
        listingId: published.listingId,
      };
    } catch (err: unknown) {
      // Leave the original listing intact when fresh-SKU verification fails.
      // Best-effort cleanup avoids orphaning a partial recovery listing.
      try {
        const freshOffers = await this.inventoryApi.getOffersBySku(
          storeId,
          freshSku,
          100,
          0,
        );
        for (const freshOffer of freshOffers.offers) {
          if (!freshOffer.offerId) continue;
          if (freshOffer.status === 'PUBLISHED') {
            await this.inventoryApi.withdrawOffer(storeId, freshOffer.offerId);
          }
          await this.inventoryApi.deleteOffer(storeId, freshOffer.offerId);
        }
        await this.inventoryApi.deleteItem(storeId, freshSku);
      } catch (cleanupErr: unknown) {
        this.logger.warn(
          `Fresh SKU cleanup failed for ${freshSku}: ${
            cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
          }`,
        );
      }
      throw err;
    }
  }

  /** Verify the buyer-facing compatibility without attempting a write. */
  async verifyLiveListing(
    storeId: string,
    itemId: string,
    marketplaceId: string | null | undefined,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<void> {
    const expected = this.normalize(payload);
    const actual = await this.tradingApi.getItemDetails(
      storeId,
      itemId,
      marketplaceId,
    );
    this.assertExactRows(sku, expected, actual.compatibility, 'Trading API');
    this.logger.log(
      `Verified ${expected.compatibleProducts.length} buyer-facing compatibility row(s) for SKU ${sku}, item ${itemId}`,
    );
  }

  /** Replace the legacy live-listing compatibility and verify it with GetItem. */
  async syncLiveListing(
    storeId: string,
    itemId: string,
    marketplaceId: string | null | undefined,
    sku: string,
    payload?: EbayCompatibilityPayload | null,
  ): Promise<void> {
    const expected = this.normalize(payload);
    const current = await this.tradingApi.getItemDetails(
      storeId,
      itemId,
      marketplaceId,
    );
    if (this.sameRows(expected, current.compatibility)) return;

    await this.tradingApi.replaceItemCompatibility(
      storeId,
      itemId,
      expected,
      marketplaceId,
      current.listingDetails,
    );
    const verified = await this.tradingApi.getItemDetails(
      storeId,
      itemId,
      marketplaceId,
    );
    this.assertExactRows(sku, expected, verified.compatibility, 'Trading API');
    this.logger.log(
      `Reconciled ${expected.compatibleProducts.length} Trading API compatibility row(s) for SKU ${sku}, item ${itemId}`,
    );
  }

  private sameRows(
    expected: EbayCompatibilityPayload,
    actual: EbayCompatibilityPayload | null | undefined,
  ): boolean {
    try {
      this.assertExactRows('', expected, actual, 'comparison');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * GET /inventory_item can return calculated/response-only package fields.
   * In particular, eBay returns weight.value=0 for listings without a stored
   * weight but rejects that same value on PUT (error 25709). Keep the SKU and
   * valid product/availability fields, and omit invalid package metadata.
   */
  private inventoryItemPayloadForWrite(
    item: EbayInventoryItem,
  ): EbayInventoryItem {
    const { packageWeightAndSize, ...base } = item;
    const packagePayload: NonNullable<EbayInventoryItem['packageWeightAndSize']> = {};
    const weight = packageWeightAndSize?.weight;
    if (weight && Number.isFinite(weight.value) && weight.value > 0) {
      packagePayload.weight = weight;
    }
    const dimensions = packageWeightAndSize?.dimensions;
    if (
      dimensions &&
      dimensions.length.value > 0 &&
      dimensions.width.value > 0 &&
      dimensions.height.value > 0
    ) {
      packagePayload.dimensions = dimensions;
    }
    return Object.keys(packagePayload).length > 0
      ? { ...base, packageWeightAndSize: packagePayload }
      : base;
  }

  private freshInventorySku(sourceSku: string): string {
    const base = sourceSku.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 34);
    return `${base || 'EBAY-FITMENT'}-FF-${Date.now().toString(36)}`.slice(
      0,
      50,
    );
  }

  private neutralizeCatalogIdentifiers(
    item: EbayInventoryItem,
  ): EbayInventoryItem {
    const { brand: _brand, mpn: _mpn, upc: _upc, ean: _ean, epid: _epid, ...productBase } =
      item.product;
    const aspects = Object.fromEntries(
      Object.entries(item.product.aspects ?? {}).filter(([name]) => {
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return ![
          'mpn',
          'oempartnumber',
          'oeoempartnumber',
          'manufacturerpartnumber',
          'partnumber',
          'epid',
        ].includes(key);
      }),
    );
    return {
      ...item,
      product: {
        ...productBase,
        title: 'Used automotive replacement part',
        ...(Object.keys(aspects).length > 0 ? { aspects } : {}),
      },
    };
  }

  private async resolveCurrentListingPolicies(
    storeId: string,
    marketplaceId: string,
  ): Promise<NonNullable<EbayOffer['listingPolicies']>> {
    if (!this.auth || !this.sellAccount) {
      throw new BadRequestException(
        'Cannot safely recreate an eBay offer: live seller-policy services are unavailable.',
      );
    }
    const token = await this.auth.getAccessToken(storeId);
    const baseUrl = await this.auth.getApiBaseUrlForStore(storeId);
    const accountMarketplace =
      marketplaceId === 'EBAY_MOTORS' ? 'EBAY_MOTORS_US' : marketplaceId;
    const [fulfillment, payment, returns] = await Promise.all([
      this.sellAccount.listFulfillmentPolicies(
        token,
        baseUrl,
        accountMarketplace,
      ),
      this.sellAccount.listPaymentPolicies(token, baseUrl, accountMarketplace),
      this.sellAccount.listReturnPolicies(token, baseUrl, accountMarketplace),
    ]);
    const pick = (rows: Array<{ ebayPolicyId: string; isDefault: boolean }>) =>
      rows.find((row) => row.isDefault)?.ebayPolicyId ?? rows[0]?.ebayPolicyId;
    const listingPolicies = {
      fulfillmentPolicyId: pick(fulfillment),
      paymentPolicyId: pick(payment),
      returnPolicyId: pick(returns),
    };
    if (
      !listingPolicies.fulfillmentPolicyId ||
      !listingPolicies.paymentPolicyId ||
      !listingPolicies.returnPolicyId
    ) {
      throw new BadRequestException(
        `Cannot safely recreate SKU ${storeId}: eBay returned an incomplete seller-policy set.`,
      );
    }
    return listingPolicies;
  }

  private isNotFound(err: unknown): boolean {
    if (axios.isAxiosError(err)) return err.response?.status === 404;
    return Boolean(
      err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404,
    );
  }
}

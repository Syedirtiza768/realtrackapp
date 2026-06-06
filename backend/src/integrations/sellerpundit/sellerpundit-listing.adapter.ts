import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../ebay/entities/ebay-business-policy.entity.js';
import type { ListingBuilderResult } from '../ebay/services/listing-builder.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';
import type { SellerpunditPublishResult } from './sellerpundit.types.js';
import { tagSellerpunditPlatformError } from './sellerpundit-publish.util.js';
import { sanitizePublishListingText } from '../../channels/ebay/ebay-listing-text.util.js';
import { sanitizeEbayImageUrls } from '../../channels/ebay/ebay-listing-images.util.js';
import { mapToEbayConditionEnum } from '../../channels/ebay/ebay-listing-condition.util.js';
import {
  isLikelyEbayRestPolicyId,
  isPartsAccessoriesCompliantReturnPolicy,
  listingRequiresPartsAccessoriesReturnPolicy,
  paReturnPolicyBlockedMessage,
  partsAccessoriesReturnPolicyGuidance,
  pickReturnPolicyIdForListing,
  policyMatchesMarketplaceGeo,
  readPolicyGeoSite,
} from '../ebay/services/ebay-business-policy.util.js';

@Injectable()
export class SellerpunditListingAdapter {
  constructor(
    private readonly auth: SellerpunditAuthService,
    private readonly http: SellerpunditHttpClient,
    private readonly registry: SellerpunditMarketplaceRegistry,
    private readonly tokenSync: SellerpunditTokenSyncService,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
  ) {}

  async publish(
    built: ListingBuilderResult,
    account: ConnectedEbayAccount,
    marketplaceId: string,
  ): Promise<SellerpunditPublishResult> {
    const req = built.publishRequest;
    const listingText = sanitizePublishListingText({
      title: req.title,
      description: req.description,
      sku: req.sku,
      brand: req.aspects?.Brand?.[0],
      mpn: req.aspects?.MPN?.[0],
      partType: req.aspects?.Type?.[0],
    });
    const images = sanitizeEbayImageUrls(req.imageUrls);
    if (!images.imageUrls.length) {
      return {
        success: false,
        error: 'At least one valid image URL (http/https) is required to publish',
        errors: [
          'Catalog product requires at least one valid image URL before SellerPundit publish',
        ],
      };
    }
    const mpRow = await this.mpRepo.findOne({
      where: { ebayAccountId: account.id, marketplaceId },
    });

    const fulfillmentPolicyId = req.fulfillmentPolicyId ?? mpRow?.defaultFulfillmentPolicyId;
    const paymentPolicyId = req.paymentPolicyId ?? mpRow?.defaultPaymentPolicyId;
    let returnPolicyId = req.returnPolicyId ?? mpRow?.defaultReturnPolicyId;
    const compliantReturnId = await this.resolveCompliantReturnPolicyId(
      account.id,
      marketplaceId,
      req.categoryId,
      req.condition,
    );
    if (compliantReturnId) {
      returnPolicyId = compliantReturnId;
    }

    if (
      listingRequiresPartsAccessoriesReturnPolicy(
        marketplaceId,
        req.categoryId,
        req.condition,
      )
    ) {
      if (!returnPolicyId) {
        return {
          success: false,
          error: partsAccessoriesReturnPolicyGuidance(),
          errors: [partsAccessoriesReturnPolicyGuidance()],
        };
      }
      const returnRow = await this.policyRepo.findOne({
        where: {
          ebayAccountId: account.id,
          marketplaceId,
          policyType: 'return',
          ebayPolicyId: returnPolicyId,
        },
      });
      if (
        !isPartsAccessoriesCompliantReturnPolicy(returnRow?.rawPayload ?? {})
      ) {
        const blocked = paReturnPolicyBlockedMessage({
          returnPolicyId,
          raw: returnRow?.rawPayload,
          storeName: account.accountDisplayName ?? account.ebayUsername ?? undefined,
          marketplaceId,
          condition: req.condition,
        });
        return {
          success: false,
          error: blocked,
          errors: [blocked],
        };
      }
    }

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      const hint = await this.missingPolicyHint(
        account.id,
        marketplaceId,
        account.sellerpunditAccountName ?? account.accountDisplayName,
      );
      return {
        success: false,
        error: hint ?? 'Missing business policy IDs after sync',
        errors: [
          hint ??
            'Fulfillment, payment, and return policies are required — sync SellerPundit policies and map defaults.',
        ],
      };
    }

    if (
      !isLikelyEbayRestPolicyId(fulfillmentPolicyId) ||
      !isLikelyEbayRestPolicyId(paymentPolicyId) ||
      !isLikelyEbayRestPolicyId(returnPolicyId)
    ) {
      return {
        success: false,
        error: 'Invalid business policy IDs — re-sync policies from Settings → eBay Integrations',
        errors: [
          'Stored policy IDs are not valid eBay REST policy identifiers. Sync policies again so defaults use eBay fulfillment/payment/return policy IDs.',
        ],
      };
    }

    if (!account.sellerpunditAccountName || account.sellerpunditMarketplaceId == null) {
      return {
        success: false,
        error: 'SellerPundit account metadata missing',
        errors: ['Re-import stores from SellerPundit'],
      };
    }

    const siteId = this.registry.siteIdFor(marketplaceId);
    const country = this.registry.countryForSite(siteId);
    const currency = req.currency ?? this.registry.currencyForMarketplace(marketplaceId);

    const itemSpecifics = Object.entries(req.aspects ?? {}).map(([name, values]) => ({
      name,
      value: Array.isArray(values) ? values.join(', ') : String(values),
    }));

    const csku = {
      title: listingText.title,
      description: listingText.description,
      price: String(req.price),
      quantity: String(req.quantity),
      currency,
      images: images.imageUrls,
      country,
      conditionId: this.conditionIdFromEnum(mapToEbayConditionEnum(req.condition)),
      location: country,
      sellerProfile: {
        fulfillmentPolicyId,
        paymentPolicyId,
        returnPolicyId,
      },
      categoryId: req.categoryId || '0',
      categoryName: req.categoryId ? `Category ${req.categoryId}` : 'General',
      itemSpecifics,
      siteId,
      isku: req.sku,
      mrp: String(req.price),
    };

    const body = {
      accountName: account.sellerpunditAccountName,
      marketplaceId: account.sellerpunditMarketplaceId,
      // SellerPundit tokens table column is marketPlaceId (camel-case P).
      marketPlaceId: account.sellerpunditMarketplaceId,
      tokenId: account.sellerpunditTokenId,
      cskuData: [csku],
    };

    try {
      await this.tokenSync.ensureFreshAccessToken(account.id);
      const jwt = await this.auth.getJwt(account.organizationId);
      const raw = await this.http.post<unknown>(
        jwt,
        '/inventory/bulk-create-using-api',
        body,
      );
      return this.parseBulkCreateResponse(raw, req.sku);
    } catch (e) {
      let message: string;
      let errors: string[];
      let details: Record<string, unknown> | undefined;
      if (e instanceof HttpException) {
        const resp = e.getResponse();
        if (typeof resp === 'object' && resp !== null) {
          const r = resp as Record<string, unknown>;
          message = (r.message as string) ?? e.message;
          errors = Array.isArray(r.errors) ? r.errors as string[] : [message];
          details = r.details as Record<string, unknown> | undefined;
        } else {
          message = e.message;
          errors = [message];
        }
      } else {
        message = (e as Error).message;
        errors = [message];
      }
      const failure = {
        success: false,
        error: message,
        errors,
        sellerPunditResponse: details,
      };
      return {
        ...failure,
        ...tagSellerpunditPlatformError(failure),
      };
    }
  }

  private asRecord(raw: unknown): Record<string, unknown> | undefined {
    return raw != null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : undefined;
  }

  private parseBulkCreateResponse(raw: unknown, sku: string): SellerpunditPublishResult {
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const successFlag = o.success;
      if (successFlag === false) {
        const errors = this.collectErrors(o);
        const failure = {
          success: false,
          error: errors[0] ?? 'SellerPundit bulk create failed',
          errors,
          sellerPunditResponse: this.asRecord(raw),
        };
        return { ...failure, ...tagSellerpunditPlatformError(failure) };
      }

      const data = o.data ?? o.result ?? o;
      if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        if (d.success === false) {
          const errors = this.collectErrors(d);
          const failure = {
            success: false,
            error: errors[0] ?? 'SellerPundit rejected listing',
            errors,
            sellerPunditResponse: this.asRecord(raw),
          };
          return { ...failure, ...tagSellerpunditPlatformError(failure) };
        }
        const listingId =
          d.listingId ?? d.ebayListingId ?? d.itemId ?? d.id;
        const offerId = d.offerId ?? d.offer_id;
        if (listingId != null || offerId != null) {
          return {
            success: true,
            listingId: listingId != null ? String(listingId) : undefined,
            offerId: offerId != null ? String(offerId) : undefined,
            sellerPunditResponse: this.asRecord(raw),
          };
        }
      }

      if (Array.isArray(o.errors) && o.errors.length) {
        const errors = this.collectErrors(o);
        const failure = {
          success: false,
          error: errors[0] ?? 'SellerPundit returned errors',
          errors,
          sellerPunditResponse: this.asRecord(raw),
        };
        return { ...failure, ...tagSellerpunditPlatformError(failure) };
      }
    }

    return {
      success: true,
      listingId: undefined,
      offerId: sku,
      sellerPunditResponse: this.asRecord(raw),
    };
  }

  private collectErrors(o: Record<string, unknown>): string[] {
    const out: string[] = [];
    if (typeof o.message === 'string') out.push(o.message);
    if (typeof o.error === 'string') out.push(o.error);
    if (Array.isArray(o.errors)) {
      for (const e of o.errors) {
        if (typeof e === 'string') out.push(e);
        else if (e && typeof e === 'object' && 'message' in e) {
          out.push(String((e as { message: unknown }).message));
        }
      }
    }
    return out.length ? out : ['Unknown SellerPundit error'];
  }

  private async resolveCompliantReturnPolicyId(
    ebayAccountId: string,
    marketplaceId: string,
    categoryId?: string,
    condition?: string | null,
  ): Promise<string | undefined> {
    const rows = await this.policyRepo.find({
      where: { ebayAccountId, marketplaceId, policyType: 'return' },
    });
    if (!rows.length) return undefined;
    return (
      pickReturnPolicyIdForListing(
        rows.map((r) => ({
          ebayPolicyId: r.ebayPolicyId,
          isDefault: r.isDefault,
          geoSite: readPolicyGeoSite(r.rawPayload ?? {}),
          rawPayload: r.rawPayload ?? {},
        })),
        marketplaceId,
        categoryId,
        condition,
      ) ?? undefined
    );
  }

  private async missingPolicyHint(
    ebayAccountId: string,
    marketplaceId: string,
    accountName?: string | null,
  ): Promise<string | null> {
    const rows = await this.policyRepo.find({ where: { ebayAccountId } });
    if (!rows.length) {
      return 'No business policies found — open Settings → eBay Integrations, sync SellerPundit policies, then retry publish.';
    }

    const geoSites = [
      ...new Set(
        rows
          .map((r) => readPolicyGeoSite(r.rawPayload ?? {}))
          .filter((g): g is string => Boolean(g?.trim())),
      ),
    ];
    const matchingGeo = geoSites.filter((g) =>
      policyMatchesMarketplaceGeo(g, marketplaceId),
    );
    if (geoSites.length && !matchingGeo.length) {
      const inferred = accountName
        ? this.registry.inferMarketplaceFromAccountName(accountName)
        : null;
      const geoList = geoSites.join(', ');
      if (inferred && inferred !== marketplaceId) {
        return (
          `Synced policies are for ${geoList}, but this store is publishing to ${marketplaceId}. ` +
          `Re-sync SellerPundit stores so "${accountName}" maps to ${inferred}, then sync policies and publish again.`
        );
      }
      return (
        `Synced policies are for ${geoList}, but this store is publishing to ${marketplaceId}. ` +
        'Create or enable matching business policies in eBay Seller Hub, sync policies, or publish to the correct marketplace.'
      );
    }

    return null;
  }

  private conditionIdFromEnum(condition: string): number {
    const map: Record<string, number> = {
      NEW: 1000,
      NEW_OTHER: 1500,
      USED_EXCELLENT: 3000,
      USED_GOOD: 5000,
      USED_ACCEPTABLE: 6000,
      FOR_PARTS_OR_NOT_WORKING: 7000,
    };
    return map[condition] ?? 5000;
  }
}

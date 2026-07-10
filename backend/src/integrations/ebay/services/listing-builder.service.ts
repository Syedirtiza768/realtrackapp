import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { ListingStoreOverride } from '../entities/listing-store-override.entity.js';

import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';

import type { PublishRequest } from '../../../channels/ebay/ebay-publish.service.js';

import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';

import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';

import {
  buildEbayListingTitle,
  buildEbayListingDescription,
} from '../../../channels/ebay/ebay-listing-text.util.js';

import { applyImageOrderOverride } from '../../../channels/ebay/ebay-listing-images.util.js';

import { CatalogPublishResolverService } from './catalog-publish-resolver.service.js';

import { mapToEbayConditionEnum } from '../../../channels/ebay/ebay-listing-condition.util.js';
import {
  listingRequiresPartsAccessoriesReturnPolicy,
  partsAccessoriesReturnPolicyGuidance,
  pickReturnPolicyIdForListing,
  readPolicyGeoSite,
} from './ebay-business-policy.util.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import {
  buildListingAspects,
  isUsedEbayCondition,
} from '../../../channels/ebay/ebay-listing-aspects.util.js';
import { fitmentDataToCompatibilityPayload } from '../../../fitment/fitment-mvl.util.js';
import type { EbayCompatibilityPayload } from '../../../channels/ebay/ebay-api.types.js';

export interface ListingBuilderResult {
  publishRequest: PublishRequest;

  warnings: string[];

  blockingErrors: string[];
}

@Injectable()
export class ListingBuilderService {
  constructor(
    @InjectRepository(ListingStoreOverride)
    private readonly overrideRepo: Repository<ListingStoreOverride>,

    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,

    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,

    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,

    private readonly marketplaceConfig: EbayMarketplaceConfigService,

    private readonly publishResolver: CatalogPublishResolverService,

    private readonly inventoryApi: EbayInventoryApiService,
  ) {}

  async build(params: {
    catalogProductId: string;

    ebayAccountId: string;

    marketplaceId: string;

    listingRecordId: string;

    storeId: string;
  }): Promise<ListingBuilderResult> {
    const warnings: string[] = [];

    const blockingErrors: string[] = [];

    const resolved = await this.publishResolver.resolve(
      params.catalogProductId,
    );

    if (!resolved) {
      blockingErrors.push('Catalog product or listing record not found');

      return this.emptyResult(blockingErrors, warnings, params);
    }

    const { snapshot } = resolved;

    warnings.push(...resolved.warnings);

    const ov = await this.overrideRepo.findOne({
      where: {
        catalogProductId: snapshot.catalogProductId,

        ebayAccountId: params.ebayAccountId,

        marketplaceId: params.marketplaceId,
      },
    });

    const sku = snapshot.sku;

    const listingRecord = resolved.listingRecord;
    const catalogProduct = resolved.catalogProduct;

    // Structured (deterministic) composition fields — sourced only from stored
    // catalog/listing columns. Year range and generation are intentionally NOT
    // derived; pass an explicit yearRange/generation elsewhere to lead with it.
    const structuredMake =
      (
        snapshot.brand ??
        listingRecord?.cBrand ??
        listingRecord?.extractedMake ??
        ''
      ).trim() || null;
    const structuredModel =
      (listingRecord?.extractedModel ?? '').trim() || null;
    const structuredPosition =
      (catalogProduct?.placement ?? listingRecord?.cPlacement ?? '').trim() ||
      null;
    const structuredPartName =
      (snapshot.partType ?? listingRecord?.cType ?? '').trim() || null;
    const structuredOem =
      (
        catalogProduct?.oemPartNumber ??
        listingRecord?.cOeOemPartNumber ??
        snapshot.mpn ??
        listingRecord?.cManufacturerPartNumber ??
        ''
      ).trim() || null;

    const titleResult = buildEbayListingTitle({
      title: snapshot.title,

      titleOverride: ov?.titleOverride,

      brand: snapshot.brand,

      partType: snapshot.partType,

      mpn: snapshot.mpn,

      sku,

      make: structuredMake,

      model: structuredModel,

      position: structuredPosition,

      partName: structuredPartName,

      oemPartNumber: structuredOem,
    });

    warnings.push(...titleResult.warnings);

    const title = titleResult.title;

    const descResult = buildEbayListingDescription({
      description: ov?.descriptionOverride?.trim() || snapshot.description,

      title,

      brand: snapshot.brand,

      mpn: snapshot.mpn,

      sku,

      partType: snapshot.partType,
    });

    warnings.push(...descResult.warnings);

    const description = descResult.description;

    const price =
      ov?.priceOverride != null
        ? Number(ov.priceOverride)
        : Number(snapshot.price ?? 0);

    const quantity = ov?.quantityOverride ?? snapshot.quantity ?? 0;

    const categoryId =
      ov?.categoryIdOverride?.trim() || snapshot.categoryId || '';

    const condition = mapToEbayConditionEnum(
      ov?.conditionOverride ?? snapshot.conditionId,

      'USED_GOOD',
    );

    if (!categoryId) {
      warnings.push(
        'Using empty category — publish will likely fail until taxonomy is set',
      );
    }

    const mpRow = await this.mpRepo.findOne({
      where: {
        ebayAccountId: params.ebayAccountId,

        marketplaceId: params.marketplaceId,
      },
    });

    let fulfillmentPolicyId = mpRow?.defaultFulfillmentPolicyId ?? undefined;

    let paymentPolicyId = mpRow?.defaultPaymentPolicyId ?? undefined;

    let returnPolicyId = mpRow?.defaultReturnPolicyId ?? undefined;

    let merchantLocationKey = mpRow?.defaultInventoryLocationKey ?? undefined;

    const po = ov?.policyOverrides;

    if (po && typeof po === 'object') {
      const o = po;

      if (
        typeof o.fulfillmentPolicyId === 'string' &&
        o.fulfillmentPolicyId.trim()
      ) {
        fulfillmentPolicyId = o.fulfillmentPolicyId.trim();
      }

      if (typeof o.paymentPolicyId === 'string' && o.paymentPolicyId.trim()) {
        paymentPolicyId = o.paymentPolicyId.trim();
      }

      if (typeof o.returnPolicyId === 'string' && o.returnPolicyId.trim()) {
        returnPolicyId = o.returnPolicyId.trim();
      }

      if (
        typeof o.merchantLocationKey === 'string' &&
        o.merchantLocationKey.trim()
      ) {
        merchantLocationKey = o.merchantLocationKey.trim();
      }
    }

    const returnRows = await this.policyRepo.find({
      where: {
        ebayAccountId: params.ebayAccountId,
        marketplaceId: params.marketplaceId,
        policyType: 'return',
      },
    });
    if (returnRows.length) {
      const compliantReturnId = pickReturnPolicyIdForListing(
        returnRows.map((r) => ({
          ebayPolicyId: r.ebayPolicyId,
          isDefault: r.isDefault,
          geoSite: readPolicyGeoSite(r.rawPayload ?? {}),
          rawPayload: r.rawPayload ?? {},
        })),
        params.marketplaceId,
        categoryId,
        condition,
      );
      if (compliantReturnId) {
        returnPolicyId = compliantReturnId;
      } else if (
        listingRequiresPartsAccessoriesReturnPolicy(
          params.marketplaceId,
          categoryId,
          condition,
        )
      ) {
        blockingErrors.push(partsAccessoriesReturnPolicyGuidance());
      }
    }

    let currency: string | undefined;

    try {
      currency = this.marketplaceConfig.require(params.marketplaceId).currency;
    } catch {
      warnings.push(
        `Unknown marketplace ${params.marketplaceId} — defaulting currency in offer may be wrong`,
      );
    }

    const account = await this.accountRepo.findOne({
      where: { id: params.ebayAccountId },
    });

    const isSellerpundit = account?.connectionSource === 'sellerpundit';

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId) {
      blockingErrors.push(
        isSellerpundit
          ? 'Missing fulfillment, payment, or return policy IDs — sync SellerPundit policies.'
          : 'Missing fulfillment, payment, or return policy IDs — sync policies and map defaults.',
      );
    }

    if (!merchantLocationKey) {
      const ensured = await this.inventoryApi.ensureMerchantLocation(
        params.storeId,

        merchantLocationKey,
      );

      if (ensured) {
        merchantLocationKey = ensured;

        if (mpRow) {
          mpRow.defaultInventoryLocationKey = ensured;

          await this.mpRepo.save(mpRow);
        }
      } else {
        blockingErrors.push(
          isSellerpundit
            ? 'Missing merchant location — required when SellerPundit falls back to direct eBay publish. Sync policies from eBay or set a default ship-from address.'
            : 'Missing merchant location — sync policies from eBay or set a default ship-from address.',
        );
      }
    }

    const aspects = buildListingAspects({
      brand: snapshot.brand,
      mpn: snapshot.mpn,
      partType: snapshot.partType,
    });

    if (!aspects.Brand?.length) {
      aspects.Brand = ['Unbranded'];
      warnings.push(
        'Brand/Hersteller is missing — using "Unbranded" as fallback. Set the brand on the catalog product for better search ranking.',
      );
    }

    const imageUrls = applyImageOrderOverride(
      snapshot.imageUrls,

      ov?.imageOrderOverride,
    );

    if (!imageUrls.length) {
      blockingErrors.push(
        'At least one valid image URL (http/https) is required — add images to the catalog listing or linked image assets',
      );
    }

    const listingRecordId =
      snapshot.listingRecordId ??
      params.listingRecordId ??
      snapshot.catalogProductId;

    let compatibility: EbayCompatibilityPayload | undefined;
    const fitmentOverride = ov?.fitmentOverride;
    const fitmentSource =
      Array.isArray(fitmentOverride) && fitmentOverride.length > 0
        ? (fitmentOverride as Record<string, unknown>[])
        : (resolved.catalogProduct?.fitmentData ??
          resolved.catalogProduct?.fitmentRows ??
          undefined);

    compatibility = fitmentDataToCompatibilityPayload(fitmentSource);

    if (compatibility) {
      let supportsMotorsFitment = true;
      try {
        supportsMotorsFitment = this.marketplaceConfig.require(
          params.marketplaceId,
        ).supportsMotorsFitment;
      } catch {
        supportsMotorsFitment = false;
      }

      if (!supportsMotorsFitment) {
        warnings.push(
          'Marketplace does not support Motors fitment — compatibility omitted from publish',
        );
        compatibility = undefined;
      } else {
        warnings.push(
          `Including ${compatibility.compatibleProducts.length} eBay MVL fitment row(s) in publish payload`,
        );
      }
    }

    const publishRequest: PublishRequest = {
      listingId: listingRecordId,

      storeIds: [params.storeId],

      sku,

      title,

      description,

      categoryId,

      condition,

      conditionDescription:
        snapshot.conditionLabel?.trim() ||
        (isUsedEbayCondition(condition)
          ? snapshot.partType?.trim() || title
          : undefined),
      listingDuration: 'GTC',

      price,

      currency,

      quantity,

      imageUrls,

      aspects,

      compatibility,

      fulfillmentPolicyId,

      paymentPolicyId,

      returnPolicyId,

      merchantLocationKey,
    };

    return { publishRequest, warnings, blockingErrors };
  }

  private emptyResult(
    blockingErrors: string[],

    warnings: string[],

    params: { listingRecordId: string; storeId: string },
  ): ListingBuilderResult {
    return {
      blockingErrors,

      warnings,

      publishRequest: {
        listingId: params.listingRecordId,

        storeIds: [params.storeId],

        sku: 'missing',

        title: 'missing',

        description: 'missing',

        categoryId: '',

        condition: 'USED_GOOD',

        price: 0,

        quantity: 0,

        imageUrls: [],

        aspects: {},
      },
    };
  }
}

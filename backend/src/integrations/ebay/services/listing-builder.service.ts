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
  pickPolicyIdForMarketplace,
  pickReturnPolicyIdForListing,
  readPolicyGeoSite,
} from './ebay-business-policy.util.js';
import { EbayInventoryApiService } from '../../../channels/ebay/ebay-inventory-api.service.js';
import {
  buildListingAspects,
  isUsedEbayCondition,
} from '../../../channels/ebay/ebay-listing-aspects.util.js';
import {
  fitmentDataToCompatibilityPayload,
  isSameMakeVariant,
  parseFitmentEntry,
  selectPublishFitmentSource,
} from '../../../fitment/fitment-mvl.util.js';
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

    sourceListingId?: string;

    ebayAccountId: string;

    marketplaceId: string;

    listingRecordId: string;

    storeId: string;
  }): Promise<ListingBuilderResult> {
    const warnings: string[] = [];

    const blockingErrors: string[] = [];

    const resolved = await this.publishResolver.resolve(
      params.sourceListingId ?? params.catalogProductId,
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

    // Fitment-derived make/year range. catalog_products.fitmentData resolves
    // make against the canonical fitment_makes table during enrichment, which
    // corrects spelling issues that can exist in raw source columns like
    // listingRecord.cBrand (observed: "Bently" survived uncorrected into a
    // recomposed title because this call site previously used cBrand
    // directly and never derived a year range at all). Fitment rows also
    // give us the actual compatible year span for the composed title.
    const parsedFitmentRows = (catalogProduct?.fitmentData ?? [])
      .map((row) => parseFitmentEntry(row))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const fitmentMake = parsedFitmentRows[0]?.make?.trim() || null;
    const fitmentYears = parsedFitmentRows
      .map((row) => Number(row.year))
      .filter((y) => Number.isFinite(y));
    const fitmentYearRange = fitmentYears.length
      ? (() => {
          const min = Math.min(...fitmentYears);
          const max = Math.max(...fitmentYears);
          return min === max ? String(min) : `${min}-${max}`;
        })()
      : null;

    // Structured (deterministic) composition fields — sourced from stored
    // catalog/listing columns, preferring fitment-resolved values where
    // available (see fitmentMake/fitmentYearRange above). Fitment data
    // commonly includes legitimate cross-brand platform-sharing applications
    // (a Nissan part's compatible-vehicle rows can list Infiniti; a Lincoln
    // part on a Ford platform can list Ford) — those are a DIFFERENT
    // manufacturer than the part itself, not a typo, so fitmentMake only
    // overrides the raw brand when isSameMakeVariant confirms it's the same
    // make (a spelling/formatting correction), or as a fallback when the raw
    // brand is missing entirely.
    const rawMake = (
      snapshot.brand ??
      listingRecord?.cBrand ??
      listingRecord?.extractedMake ??
      ''
    ).trim();
    const structuredMake =
      (rawMake && fitmentMake && isSameMakeVariant(rawMake, fitmentMake)
        ? fitmentMake
        : rawMake) ||
      fitmentMake ||
      null;
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

      yearRange: fitmentYearRange,

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
    let explicitFulfillmentPolicy = false;
    let explicitPaymentPolicy = false;
    let explicitReturnPolicy = false;

    if (po && typeof po === 'object') {
      const o = po;

      if (
        typeof o.fulfillmentPolicyId === 'string' &&
        o.fulfillmentPolicyId.trim()
      ) {
        fulfillmentPolicyId = o.fulfillmentPolicyId.trim();
        explicitFulfillmentPolicy = true;
      }

      if (typeof o.paymentPolicyId === 'string' && o.paymentPolicyId.trim()) {
        paymentPolicyId = o.paymentPolicyId.trim();
        explicitPaymentPolicy = true;
      }

      if (typeof o.returnPolicyId === 'string' && o.returnPolicyId.trim()) {
        returnPolicyId = o.returnPolicyId.trim();
        explicitReturnPolicy = true;
      }

      if (
        typeof o.merchantLocationKey === 'string' &&
        o.merchantLocationKey.trim()
      ) {
        merchantLocationKey = o.merchantLocationKey.trim();
      }
    }

    const policyRows = await this.policyRepo.find({
      where: {
        ebayAccountId: params.ebayAccountId,
        marketplaceId: params.marketplaceId,
      },
    });

    const requestedFulfillmentPolicyName =
      listingRecord?.shippingProfileName?.trim() ||
      catalogProduct?.shippingProfile?.trim() ||
      undefined;
    const requestedReturnPolicyName =
      listingRecord?.returnProfileName?.trim() ||
      catalogProduct?.returnProfile?.trim() ||
      undefined;
    const requestedPaymentPolicyName =
      listingRecord?.paymentProfileName?.trim() ||
      catalogProduct?.paymentProfile?.trim() ||
      undefined;
    const normalizedPolicyName = (name: string) => name.trim().toLowerCase();
    const candidates = (rows: EbayBusinessPolicy[]) =>
      rows.map((r) => ({
        ebayPolicyId: r.ebayPolicyId,
        isDefault: r.isDefault,
        geoSite: readPolicyGeoSite(r.rawPayload ?? {}),
        rawPayload: r.rawPayload ?? {},
      }));
    const rowsByName = (
      policyType: EbayBusinessPolicy['policyType'],
      name: string,
    ) =>
      policyRows.filter(
        (row) =>
          row.policyType === policyType &&
          normalizedPolicyName(row.name) === normalizedPolicyName(name),
      );
    const resolveNamedPolicy = (
      policyType: EbayBusinessPolicy['policyType'],
      name: string,
    ): string | null => {
      const matching = rowsByName(policyType, name);
      if (policyType === 'return') {
        return pickReturnPolicyIdForListing(
          candidates(matching),
          params.marketplaceId,
          categoryId,
          condition,
        );
      }
      return pickPolicyIdForMarketplace(
        candidates(matching),
        params.marketplaceId,
      );
    };

    if (!explicitFulfillmentPolicy && requestedFulfillmentPolicyName) {
      const resolvedId = resolveNamedPolicy(
        'fulfillment',
        requestedFulfillmentPolicyName,
      );
      if (resolvedId) fulfillmentPolicyId = resolvedId;
      else {
        warnings.push(
          `Shipping profile "${requestedFulfillmentPolicyName}" is not in the local policy cache; it will be refreshed and verified against eBay before publishing.`,
        );
      }
    }
    if (!explicitPaymentPolicy && requestedPaymentPolicyName) {
      const resolvedId = resolveNamedPolicy(
        'payment',
        requestedPaymentPolicyName,
      );
      if (resolvedId) paymentPolicyId = resolvedId;
      else {
        warnings.push(
          `Payment profile "${requestedPaymentPolicyName}" is not in the local policy cache; it will be refreshed and verified against eBay before publishing.`,
        );
      }
    }
    if (!explicitReturnPolicy && requestedReturnPolicyName) {
      const resolvedId = resolveNamedPolicy(
        'return',
        requestedReturnPolicyName,
      );
      if (resolvedId) returnPolicyId = resolvedId;
      else {
        warnings.push(
          `Return profile "${requestedReturnPolicyName}" is not usable from the local policy cache; it will be refreshed and verified against eBay before publishing.`,
        );
      }
    }

    const returnRows = policyRows.filter((r) => r.policyType === 'return');
    if (
      !explicitReturnPolicy &&
      !requestedReturnPolicyName &&
      returnRows.length
    ) {
      const compliantReturnId = pickReturnPolicyIdForListing(
        candidates(returnRows),
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

    if (
      (!fulfillmentPolicyId && !requestedFulfillmentPolicyName) ||
      (!paymentPolicyId && !requestedPaymentPolicyName) ||
      (!returnPolicyId && !requestedReturnPolicyName)
    ) {
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
        : selectPublishFitmentSource(
            resolved.catalogProduct?.fitmentData as
              | Record<string, unknown>[]
              | null
              | undefined,
            resolved.catalogProduct?.fitmentRows as
              | Record<string, unknown>[]
              | null
              | undefined,
          );

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

      requestedFulfillmentPolicyName: explicitFulfillmentPolicy
        ? policyRows.find(
            (row) =>
              row.policyType === 'fulfillment' &&
              row.ebayPolicyId === fulfillmentPolicyId,
          )?.name
        : requestedFulfillmentPolicyName,

      requestedReturnPolicyName: explicitReturnPolicy
        ? policyRows.find(
            (row) =>
              row.policyType === 'return' &&
              row.ebayPolicyId === returnPolicyId,
          )?.name
        : requestedReturnPolicyName,

      requestedPaymentPolicyName: explicitPaymentPolicy
        ? policyRows.find(
            (row) =>
              row.policyType === 'payment' &&
              row.ebayPolicyId === paymentPolicyId,
          )?.name
        : requestedPaymentPolicyName,

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

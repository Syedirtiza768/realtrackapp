import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ListingStoreOverride } from '../entities/listing-store-override.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import type { PublishRequest } from '../../../channels/ebay/ebay-publish.service.js';
import type { EbayConditionEnum } from '../../../channels/ebay/ebay-api.types.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';

export interface ListingBuilderResult {
  publishRequest: PublishRequest;
  warnings: string[];
  blockingErrors: string[];
}

@Injectable()
export class ListingBuilderService {
  constructor(
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingStoreOverride)
    private readonly overrideRepo: Repository<ListingStoreOverride>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    private readonly marketplaceConfig: EbayMarketplaceConfigService,
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

    const product = await this.catalogRepo.findOne({
      where: { id: params.catalogProductId },
    });
    if (!product) {
      blockingErrors.push('Catalog product not found');
      return this.emptyResult(blockingErrors, warnings, params);
    }

    const ov = await this.overrideRepo.findOne({
      where: {
        catalogProductId: params.catalogProductId,
        ebayAccountId: params.ebayAccountId,
        marketplaceId: params.marketplaceId,
      },
    });

    const sku = product.sku?.trim() || product.id;
    const title = ov?.titleOverride?.trim() || product.title;
    const description =
      ov?.descriptionOverride?.trim() || product.description || '<p></p>';
    const price = ov?.priceOverride != null ? Number(ov.priceOverride) : Number(product.price ?? 0);
    const quantity = ov?.quantityOverride ?? product.quantity ?? 0;
    const categoryId = ov?.categoryIdOverride?.trim() || product.categoryId || '';
    const condition = (ov?.conditionOverride ||
      product.conditionId ||
      'USED_GOOD') as EbayConditionEnum;

    if (!categoryId) {
      warnings.push('Using empty category — publish will likely fail until taxonomy is set');
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
      const o = po as Record<string, unknown>;
      if (typeof o.fulfillmentPolicyId === 'string' && o.fulfillmentPolicyId.trim()) {
        fulfillmentPolicyId = o.fulfillmentPolicyId.trim();
      }
      if (typeof o.paymentPolicyId === 'string' && o.paymentPolicyId.trim()) {
        paymentPolicyId = o.paymentPolicyId.trim();
      }
      if (typeof o.returnPolicyId === 'string' && o.returnPolicyId.trim()) {
        returnPolicyId = o.returnPolicyId.trim();
      }
      if (typeof o.merchantLocationKey === 'string' && o.merchantLocationKey.trim()) {
        merchantLocationKey = o.merchantLocationKey.trim();
      }
    }

    let currency: string | undefined;
    try {
      currency = this.marketplaceConfig.require(params.marketplaceId).currency;
    } catch {
      warnings.push(`Unknown marketplace ${params.marketplaceId} — defaulting currency in offer may be wrong`);
    }

    if (!fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId || !merchantLocationKey) {
      blockingErrors.push(
        'Missing fulfillment, payment, return policy IDs or merchant location — sync policies and map defaults.',
      );
    }

    const aspects: Record<string, string[]> = {};
    if (product.brand) aspects.Brand = [product.brand];
    if (product.mpn) aspects.MPN = [product.mpn];

    const publishRequest: PublishRequest = {
      listingId: params.listingRecordId,
      storeIds: [params.storeId],
      sku,
      title,
      description,
      categoryId,
      condition,
      conditionDescription: product.conditionLabel ?? undefined,
      price,
      currency,
      quantity,
      imageUrls: product.imageUrls?.length ? product.imageUrls : [],
      aspects,
      compatibility: undefined,
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

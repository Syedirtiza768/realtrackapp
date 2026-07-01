import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ListingStoreOverride } from '../integrations/ebay/entities/listing-store-override.entity.js';
import { EbayMultiStoreListingService } from '../integrations/ebay/services/ebay-multi-store-listing.service.js';

export interface PublishTarget {
  storeId: string;
  marketplaceId: string;
  policyOverrides?: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
    merchantLocationKey?: string;
  };
}

export interface PublishResult {
  jobId: string;
  status: string;
  targets: Array<{
    storeId: string;
    marketplaceId: string;
    status: 'eligible' | 'skipped';
    errors?: string[];
  }>;
}

@Injectable()
export class InventoryPublishService {
  private readonly logger = new Logger(InventoryPublishService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly ebayAccountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(ListingStoreOverride)
    private readonly overrideRepo: Repository<ListingStoreOverride>,
    private readonly multiStoreListing: EbayMultiStoreListingService,
  ) {}

  async publish(
    listingId: string,
    userId: string,
    targets: PublishTarget[],
  ): Promise<PublishResult> {
    // 1. Load the listing
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    const organizationId = listing.organizationId;
    if (!organizationId) {
      throw new BadRequestException('Listing has no organization — cannot publish');
    }

    const sku = listing.customLabelSku;
    if (!sku) {
      throw new BadRequestException('Listing has no SKU — cannot publish');
    }

    // 2. Ensure a catalog product exists for this SKU (create if needed)
    const catalogProduct = await this.ensureCatalogProduct(listing);

    // 3. Map store IDs to eBay account IDs
    const storeIds = targets.map((t) => t.storeId);
    const stores = await this.storeRepo.find({ where: { id: In(storeIds) } });
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    const accounts = await this.ebayAccountRepo.find({
      where: { primaryStoreId: In(storeIds) },
    });
    const accountByStore = new Map<string, ConnectedEbayAccount>();
    for (const a of accounts) {
      accountByStore.set(a.primaryStoreId, a);
    }

    // 4. Build publish targets (eBay account ID + marketplace ID)
    const publishTargets: { ebayAccountId: string; marketplaceId: string }[] = [];
    const resultTargets: PublishResult['targets'] = [];

    for (const target of targets) {
      const store = storeMap.get(target.storeId);
      if (!store) {
        resultTargets.push({
          storeId: target.storeId,
          marketplaceId: target.marketplaceId,
          status: 'skipped',
          errors: ['Store not found'],
        });
        continue;
      }

      const account = accountByStore.get(target.storeId);
      if (!account) {
        resultTargets.push({
          storeId: target.storeId,
          marketplaceId: target.marketplaceId,
          status: 'skipped',
          errors: ['No eBay account linked to this store'],
        });
        continue;
      }

      publishTargets.push({
        ebayAccountId: account.id,
        marketplaceId: target.marketplaceId,
      });
      resultTargets.push({
        storeId: target.storeId,
        marketplaceId: target.marketplaceId,
        status: 'eligible',
      });

      if (target.policyOverrides) {
        await this.upsertPolicyOverrides(
          catalogProduct.id,
          account.id,
          target.marketplaceId,
          target.policyOverrides,
        );
      }
    }

    if (publishTargets.length === 0) {
      throw new BadRequestException({
        message: 'No valid publish targets',
        targets: resultTargets,
      });
    }

    // 5. Call the existing multi-store publish flow
    try {
      const result = await this.multiStoreListing.createPublishJob({
        organizationId,
        requestedByUserId: userId,
        catalogProductId: catalogProduct.id,
        targets: publishTargets,
      });

      // Merge skipped targets from validation into our results
      for (const skipped of result.skipped) {
        const existing = resultTargets.find(
          (t) =>
            t.marketplaceId === skipped.marketplaceId &&
            stores.find(
              (s) => accountByStore.get(s.id)?.id === skipped.ebayAccountId,
            )?.id ===
              resultTargets.find(
                (rt) => rt.marketplaceId === skipped.marketplaceId,
              )?.storeId,
        );
        if (existing) {
          existing.status = 'skipped';
          existing.errors = skipped.errors;
        }
      }

      return {
        jobId: result.job.id,
        status: result.job.status,
        targets: resultTargets,
      };
    } catch (err) {
      this.logger.error(
        `Publish failed for listing ${listingId}: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  /**
   * Ensure a CatalogProduct exists for this listing's SKU.
   * Creates one from the listing data if it doesn't exist.
   */
  private async ensureCatalogProduct(listing: ListingRecord): Promise<CatalogProduct> {
    const sku = listing.customLabelSku!;

    // Try to find existing catalog product
    const existing = await this.productRepo.findOne({ where: { sku } });
    if (existing) return existing;

    // Create new catalog product from listing data
    const product = this.productRepo.create({
      sku,
      title: listing.title ?? listing.cOeOemPartNumber ?? '',
      description: listing.description ?? null,
      brand: listing.cBrand ?? null,
      brandNormalized: listing.cBrand?.toLowerCase().trim() ?? null,
      mpn: listing.cManufacturerPartNumber ?? null,
      mpnNormalized: listing.cManufacturerPartNumber
        ?.toLowerCase()
        .replace(/[\s\-]/g, '') ?? null,
      oemPartNumber: listing.cOeOemPartNumber ?? null,
      partType: listing.cType ?? null,
      features: listing.cFeatures ?? null,
      categoryId: listing.categoryId ?? null,
      categoryName: listing.categoryName ?? null,
      price: listing.startPriceNum ?? null,
      quantity: listing.quantityNum ?? null,
      conditionId: listing.conditionId ?? null,
      imageUrls: this.parseImageUrls(listing.itemPhotoUrl),
      location: listing.location ?? null,
      pipelineJobId: listing.pipelineJobId ?? null,
    });

    const saved = await this.productRepo.save(product);
    this.logger.log(`Created catalog product ${saved.id} for SKU ${sku}`);
    return saved;
  }

  private async upsertPolicyOverrides(
    catalogProductId: string,
    ebayAccountId: string,
    marketplaceId: string,
    overrides: NonNullable<PublishTarget['policyOverrides']>,
  ): Promise<void> {
    const policyOverrides: Record<string, string> = {};
    if (overrides.fulfillmentPolicyId) {
      policyOverrides.fulfillmentPolicyId = overrides.fulfillmentPolicyId;
    }
    if (overrides.paymentPolicyId) {
      policyOverrides.paymentPolicyId = overrides.paymentPolicyId;
    }
    if (overrides.returnPolicyId) {
      policyOverrides.returnPolicyId = overrides.returnPolicyId;
    }
    if (overrides.merchantLocationKey) {
      policyOverrides.merchantLocationKey = overrides.merchantLocationKey;
    }
    if (Object.keys(policyOverrides).length === 0) return;

    let row = await this.overrideRepo.findOne({
      where: { catalogProductId, ebayAccountId, marketplaceId },
    });
    if (!row) {
      row = this.overrideRepo.create({
        catalogProductId,
        ebayAccountId,
        marketplaceId,
        policyOverrides,
      });
    } else {
      row.policyOverrides = { ...row.policyOverrides, ...policyOverrides };
    }
    await this.overrideRepo.save(row);
    this.logger.debug(
      `Policy overrides saved for product ${catalogProductId} account ${ebayAccountId} ${marketplaceId}`,
    );
  }

  private parseImageUrls(raw: string | null | undefined): string[] {
    if (!raw?.trim()) return [];
    return raw
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);
  }
}

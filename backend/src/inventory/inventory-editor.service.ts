import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { PartFitment } from '../fitment/entities/part-fitment.entity.js';
import { Store } from '../channels/entities/store.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayAccountMarketplace } from '../integrations/ebay/entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../integrations/ebay/entities/ebay-business-policy.entity.js';
import { StoreAccessService } from '../channels/store-access.service.js';
import { User } from '../auth/entities/user.entity.js';
import type {
  EditorResponse,
  EditorListingInfo,
  MarketplaceVersion,
  StoreWithPolicies,
  PolicyOption,
  SaveEditorDto,
} from './dto/inventory-editor.dto.js';

const MARKETPLACE_LABELS: Record<string, string> = {
  EBAY_US: 'United States',
  EBAY_AU: 'Australia',
  EBAY_DE: 'Germany',
  EBAY_GB: 'United Kingdom',
  EBAY_MOTORS_US: 'eBay Motors (US)',
};

const LISTING_MARKETPLACE_TO_EBAY: Record<string, string> = {
  US: 'EBAY_US',
  AU: 'EBAY_AU',
  DE: 'EBAY_DE',
};

const EBAY_TO_LISTING_MARKETPLACE: Record<string, 'US' | 'AU' | 'DE'> = {
  EBAY_US: 'US',
  EBAY_MOTORS_US: 'US',
  EBAY_AU: 'AU',
  EBAY_DE: 'DE',
};

@Injectable()
export class InventoryEditorService {
  private readonly logger = new Logger(InventoryEditorService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(PartFitment)
    private readonly fitmentRepo: Repository<PartFitment>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly ebayAccountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly marketplaceRepo: Repository<EbayAccountMarketplace>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
    private readonly storeAccess: StoreAccessService,
  ) {}

  /**
   * Load all data needed for the inventory listing editor.
   */
  async getEditorData(listingId: string, user: User): Promise<EditorResponse> {
    // 1. Load the primary listing
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    const sku = listing.customLabelSku;

    // 2. Load sibling listing records (same SKU, different marketplaces)
    const siblings = sku
      ? await this.listingRepo.find({
          where: { customLabelSku: sku, deletedAt: IsNull() },
        })
      : [];

    // 3. Find or create catalog product for this SKU
    let catalogProduct: CatalogProduct | null = null;
    if (sku) {
      catalogProduct = await this.productRepo.findOne({ where: { sku } });
    }

    // 4. Build listing info
    const listingInfo: EditorListingInfo = {
      id: listing.id,
      sku: listing.customLabelSku ?? '',
      title: listing.title,
      brand: listing.cBrand,
      partType: listing.cType,
      mpn: listing.cManufacturerPartNumber,
      oemNumber: listing.cOeOemPartNumber,
      categoryId: listing.categoryId,
      categoryName: listing.categoryName,
      imageUrls: this.parseImageUrls(listing.itemPhotoUrl),
      fitmentCount: await this.fitmentRepo.count({ where: { listingId } }),
      status: listing.status,
    };

    // 5. Build marketplace versions from siblings + catalog product
    const marketplaceVersions = this.buildMarketplaceVersions(
      listing,
      siblings,
      catalogProduct,
    );

    // 6. Load accessible stores with policies
    const stores = await this.getStoresWithPolicies(user);

    return {
      listing: listingInfo,
      marketplaceVersions,
      stores,
    };
  }

  /**
   * Persist marketplace version edits to sibling listing records and catalog product.
   */
  async saveEditorData(
    listingId: string,
    dto: SaveEditorDto,
  ): Promise<{ ok: boolean }> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    const sku = listing.customLabelSku;
    const siblings = sku
      ? await this.listingRepo.find({
          where: { customLabelSku: sku, deletedAt: IsNull() },
        })
      : [listing];

    const byMarketplace = new Map<string, ListingRecord>();
    for (const s of siblings) {
      const mkt = s.marketplace;
      if (mkt) byMarketplace.set(mkt, s);
    }

    let catalogProduct: CatalogProduct | null = null;
    if (sku) {
      catalogProduct = await this.productRepo.findOne({ where: { sku } });
    }

    const payloadVersions: Record<string, unknown> = {};
    if (catalogProduct?.optimizationPayload) {
      const raw = catalogProduct.optimizationPayload;
      if (raw.US || raw.AU || raw.DE) {
        Object.assign(payloadVersions, raw);
      }
    }

    for (const ver of dto.marketplaceVersions) {
      let target = byMarketplace.get(ver.marketplace);
      if (!target) {
        target = this.cloneListingForMarketplace(listing, ver.marketplace);
        target = await this.listingRepo.save(target);
        byMarketplace.set(ver.marketplace, target);
      }

      target.title = ver.title;
      target.description = ver.description;
      target.startPriceNum = ver.price ?? null;
      target.startPrice = ver.price != null ? String(ver.price) : null;
      target.quantityNum = ver.quantity ?? null;
      target.quantity = ver.quantity != null ? String(ver.quantity) : null;
      target.conditionId = ver.conditionId;
      await this.listingRepo.save(target);

      const existingPayload = (payloadVersions[ver.marketplace] ??
        {}) as Record<string, unknown>;
      payloadVersions[ver.marketplace] = {
        ...existingPayload,
        optimizedTitle: ver.title,
        seoDescription: ver.description,
        itemSpecifics: ver.itemSpecifics ?? {},
      };
    }

    if (catalogProduct) {
      catalogProduct.optimizationPayload = payloadVersions;
      const usVer = dto.marketplaceVersions.find((v) => v.marketplace === 'US');
      const primaryVer = usVer ?? dto.marketplaceVersions[0];
      if (primaryVer) {
        catalogProduct.title = primaryVer.title;
        catalogProduct.description = primaryVer.description;
        if (primaryVer.price != null) catalogProduct.price = primaryVer.price;
        if (primaryVer.quantity != null)
          catalogProduct.quantity = primaryVer.quantity;
        if (primaryVer.conditionId)
          catalogProduct.conditionId = primaryVer.conditionId;
      }
      await this.productRepo.save(catalogProduct);
    }

    this.logger.log(
      `Saved editor data for listing ${listingId} (${dto.marketplaceVersions.length} versions)`,
    );
    return { ok: true };
  }

  private cloneListingForMarketplace(
    primary: ListingRecord,
    marketplace: 'US' | 'AU' | 'DE',
  ): ListingRecord {
    const row = Math.floor(Date.now() + Math.random() * 1000) % 2_000_000_000;
    return this.listingRepo.create({
      organizationId: primary.organizationId,
      sourceFileName: primary.sourceFileName ?? 'warehouse-intake',
      sourceFilePath: primary.sourceFilePath ?? 'warehouse-intake',
      sheetName: primary.sheetName ?? 'Listings',
      sourceRowNumber: row,
      customLabelSku: primary.customLabelSku,
      categoryId: primary.categoryId,
      categoryName: primary.categoryName,
      title: primary.title,
      description: primary.description,
      cBrand: primary.cBrand,
      cType: primary.cType,
      cManufacturerPartNumber: primary.cManufacturerPartNumber,
      cOeOemPartNumber: primary.cOeOemPartNumber,
      cFeatures: primary.cFeatures,
      conditionId: primary.conditionId,
      startPrice: primary.startPrice,
      startPriceNum: primary.startPriceNum,
      quantity: primary.quantity,
      quantityNum: primary.quantityNum,
      itemPhotoUrl: primary.itemPhotoUrl,
      location: primary.location,
      pipelineJobId: primary.pipelineJobId,
      marketplace,
      status: primary.status ?? 'draft',
    });
  }

  /**
   * Build marketplace versions from sibling listing records and catalog product.
   * Returns versions for US, AU, DE — uses sibling data when available, falls back
   * to the primary listing data for missing marketplaces.
   */
  private buildMarketplaceVersions(
    primaryListing: ListingRecord,
    siblings: ListingRecord[],
    catalogProduct: CatalogProduct | null,
  ): MarketplaceVersion[] {
    const targetMarketplaces = ['US', 'AU', 'DE'] as const;

    // Index siblings by marketplace
    const byMarketplace = new Map<string, ListingRecord>();
    for (const s of siblings) {
      const mkt = s.marketplace;
      if (mkt) byMarketplace.set(mkt, s);
    }

    // Parse optimization_payload if available
    let payloadVersions: Record<
      string,
      {
        optimizedTitle?: string;
        seoDescription?: string;
        itemSpecifics?: Record<string, string>;
      }
    > = {};
    if (catalogProduct?.optimizationPayload) {
      try {
        const raw = catalogProduct.optimizationPayload;
        // Check if payload contains per-marketplace data
        if (raw.US || raw.AU || raw.DE) {
          payloadVersions = raw as any;
        }
      } catch {}
    }

    const seoScore = catalogProduct?.seoScore
      ? Number(catalogProduct.seoScore)
      : null;
    const readinessScore = catalogProduct?.readinessScore
      ? Number(catalogProduct.readinessScore)
      : null;

    return targetMarketplaces.map((mkt) => {
      const sibling = byMarketplace.get(mkt);
      const payload = payloadVersions[mkt] ?? {};

      return {
        marketplace: mkt,
        title:
          sibling?.title ??
          payload.optimizedTitle ??
          primaryListing.title ??
          '',
        description:
          sibling?.description ??
          payload.seoDescription ??
          primaryListing.description ??
          '',
        price: sibling?.startPriceNum ?? primaryListing.startPriceNum ?? null,
        quantity: sibling?.quantityNum ?? primaryListing.quantityNum ?? null,
        conditionId:
          sibling?.conditionId ?? primaryListing.conditionId ?? 'Used',
        conditionDescription: null,
        itemSpecifics: (payload as any)?.itemSpecifics ?? {},
        fitmentSummary: null,
        seoScore,
        readinessScore,
      };
    });
  }

  /**
   * Load stores the user can access, with their eBay account info,
   * marketplaces, and cached business policies.
   */
  private async getStoresWithPolicies(
    user: User,
  ): Promise<StoreWithPolicies[]> {
    const storeIds = await this.storeAccess.getAccessibleStoreIds(user);

    if (storeIds.size === 0) return [];

    // Load stores
    const stores = await this.storeRepo.find({
      where: { id: In([...storeIds]), channel: 'ebay', status: 'active' },
    });

    if (stores.length === 0) return [];

    // Find eBay accounts linked to these stores via primaryStoreId
    const storeIdSet = new Set(stores.map((s) => s.id));
    const accounts = await this.ebayAccountRepo.find({
      where: { primaryStoreId: In([...storeIdSet]) },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);

    // Load all marketplaces for these accounts
    const marketplaces = await this.marketplaceRepo.find({
      where: { ebayAccountId: In(accountIds), enabled: true },
    });

    // Load all cached policies for these accounts
    const policies = await this.policyRepo.find({
      where: { ebayAccountId: In(accountIds) },
    });

    // Index policies by (accountId, marketplaceId, type)
    const policyIndex = new Map<string, PolicyOption[]>();
    for (const p of policies) {
      const key = `${p.ebayAccountId}:${p.marketplaceId}:${p.policyType}`;
      if (!policyIndex.has(key)) policyIndex.set(key, []);
      policyIndex.get(key)!.push({
        id: p.id,
        ebayPolicyId: p.ebayPolicyId,
        name: p.name,
        policyType: p.policyType as 'payment' | 'return' | 'fulfillment',
        marketplaceId: p.marketplaceId,
      });
    }

    // Group marketplaces by account
    const marketplacesByAccount = new Map<string, typeof marketplaces>();
    for (const mp of marketplaces) {
      if (!marketplacesByAccount.has(mp.ebayAccountId)) {
        marketplacesByAccount.set(mp.ebayAccountId, []);
      }
      marketplacesByAccount.get(mp.ebayAccountId)!.push(mp);
    }

    // Build store map for quick lookup
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    // Build result
    const result: StoreWithPolicies[] = [];

    for (const account of accounts) {
      const store = storeMap.get(account.primaryStoreId);
      if (!store) continue;

      const accountMarketplaces = marketplacesByAccount.get(account.id) ?? [];

      result.push({
        id: store.id,
        name: store.storeName,
        ebayAccountId: account.id,
        ebayUserId: account.ebayUserId,
        marketplaces: accountMarketplaces.map((mp) => {
          const makePolicyList = (type: string): PolicyOption[] => {
            return (
              policyIndex.get(`${account.id}:${mp.marketplaceId}:${type}`) ?? []
            );
          };

          return {
            marketplaceId: mp.marketplaceId,
            label: MARKETPLACE_LABELS[mp.marketplaceId] ?? mp.marketplaceId,
            defaultPaymentPolicyId: mp.defaultPaymentPolicyId,
            defaultReturnPolicyId: mp.defaultReturnPolicyId,
            defaultFulfillmentPolicyId: mp.defaultFulfillmentPolicyId,
            defaultInventoryLocationKey: mp.defaultInventoryLocationKey,
            policies: {
              payment: makePolicyList('payment'),
              return: makePolicyList('return'),
              fulfillment: makePolicyList('fulfillment'),
            },
          };
        }),
      });
    }

    return result;
  }

  private parseImageUrls(raw: string | null | undefined): string[] {
    if (!raw?.trim()) return [];
    return raw
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);
  }
}

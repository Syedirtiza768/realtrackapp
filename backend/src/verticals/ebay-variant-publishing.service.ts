import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagService } from '../common/feature-flags/feature-flag.service.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import type {
  EbayConditionEnum,
  EbayInventoryItem,
  EbayInventoryItemGroup,
  EbayOffer,
} from '../channels/ebay/ebay-api.types.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';
import { ConnectedEbayAccount } from '../integrations/ebay/entities/connected-ebay-account.entity.js';
import { ProductFamily } from './entities/product-family.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { VariantMarketplaceMapping } from './entities/variant-marketplace-mapping.entity.js';
import type { ProductVertical } from './vertical.types.js';

export type VariantFamilyPublishInput = {
  organizationId: string;
  familyId: string;
  storeId: string;
  ebayAccountId: string;
  marketplaceId: string;
  categoryId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  currency?: string;
};

@Injectable()
export class EbayVariantPublishingService {
  constructor(
    private readonly featureFlags: FeatureFlagService,
    private readonly inventoryApi: EbayInventoryApiService,
    @InjectRepository(ProductFamily)
    private readonly familyRepo: Repository<ProductFamily>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(VariantMarketplaceMapping)
    private readonly mappingRepo: Repository<VariantMarketplaceMapping>,
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
  ) {}

  async buildGroupPayload(
    family: ProductFamily,
    variants: ProductVariant[],
  ): Promise<EbayInventoryItemGroup> {
    if (family.vertical === 'automotive') {
      throw new BadRequestException(
        'Automotive products continue to use the existing Motors workflow; item groups are only enabled for pilot verticals.',
      );
    }
    if (!variants.length) {
      throw new BadRequestException('At least one active variant is required');
    }

    const seenSkus = new Set<string>();
    const valuesByName = new Map<string, Set<string>>();
    for (const variant of variants) {
      if (!variant.sku.trim() || seenSkus.has(variant.sku.trim())) {
        throw new BadRequestException('Variant SKUs must be present and unique');
      }
      if (variant.vertical !== family.vertical) {
        throw new BadRequestException('All variants must use the family vertical');
      }
      seenSkus.add(variant.sku.trim());
      for (const [name, rawValue] of Object.entries(variant.attributes ?? {})) {
        const values = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];
        const cleanValues = values.map((value) => value.trim()).filter(Boolean);
        if (!cleanValues.length) continue;
        const set = valuesByName.get(name) ?? new Set<string>();
        cleanValues.forEach((value) => set.add(value));
        valuesByName.set(name, set);
      }
    }

    if (!valuesByName.size) {
      throw new BadRequestException(
        'At least one shared variation aspect is required before creating an eBay item group',
      );
    }

    return {
      variantSKUs: [...seenSkus],
      title: family.name,
      description: family.name,
      variesBy: {
        specifications: [...valuesByName.entries()].map(([name, values]) => ({
          name,
          values: [...values],
        })),
      },
    };
  }

  async publishFamily(input: VariantFamilyPublishInput) {
    if (!(await this.featureFlags.isEnabled('multi_vertical_catalog'))) {
      throw new BadRequestException('The multi_vertical_catalog pilot is disabled');
    }
    const account = await this.accountRepo.findOneBy({
      id: input.ebayAccountId,
      organizationId: input.organizationId,
      primaryStoreId: input.storeId,
    });
    if (!account) throw new NotFoundException('eBay account/store is not in this organization');

    const family = await this.familyRepo.findOneBy({
      id: input.familyId,
      organizationId: input.organizationId,
    });
    if (!family) throw new NotFoundException('Product family not found');
    if (family.vertical === 'automotive') {
      throw new BadRequestException('Item-group publishing is not available for automotive');
    }

    const variants = await this.variantRepo.find({
      where: { familyId: family.id, organizationId: input.organizationId, active: true },
      order: { sku: 'ASC' },
    });
    const group = await this.buildGroupPayload(family, variants);
    const product = family.catalogProductId
      ? await this.productRepo.findOneBy({ id: family.catalogProductId })
      : null;
    const categoryId = input.categoryId.trim() || product?.categoryId?.trim();
    if (!categoryId) throw new BadRequestException('A leaf eBay category is required for the family');
    if (!input.merchantLocationKey.trim()) throw new BadRequestException('A merchant location is required');

    const mappings: VariantMarketplaceMapping[] = [];
    for (const variant of variants) {
      const attributes = Object.fromEntries(
        Object.entries(variant.attributes ?? {}).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.map(String) : [String(value)],
        ]),
      ) as Record<string, string[]>;
      const condition = this.mapCondition(variant.conditionId);
      const item: EbayInventoryItem = {
        sku: variant.sku,
        product: {
          title: `${family.name} ${this.variantLabel(variant)}`.trim(),
          description: product?.description ?? family.name,
          imageUrls: variant.imageUrls.length ? variant.imageUrls : product?.imageUrls ?? [],
          aspects: attributes,
          brand: product?.brand ?? undefined,
          mpn: variant.mpn ?? product?.mpn ?? undefined,
        },
        condition,
        availability: { shipToLocationAvailability: { quantity: variant.quantity ?? 0 } },
      };
      await this.inventoryApi.createOrReplaceItem(input.storeId, variant.sku, item);

      const offer: EbayOffer = {
        sku: variant.sku,
        marketplaceId: input.marketplaceId,
        format: 'FIXED_PRICE',
        listingDescription: product?.description ?? family.name,
        availableQuantity: variant.quantity ?? 0,
        categoryId,
        merchantLocationKey: input.merchantLocationKey,
        pricingSummary: {
          price: {
            value: String(variant.price ?? product?.price ?? 0),
            currency: input.currency ?? 'USD',
          },
        },
        listingPolicies: {
          fulfillmentPolicyId: input.fulfillmentPolicyId,
          paymentPolicyId: input.paymentPolicyId,
          returnPolicyId: input.returnPolicyId,
        },
      };
      let mapping = await this.mappingRepo.findOneBy({
        variantId: variant.id,
        ebayAccountId: input.ebayAccountId,
        marketplaceId: input.marketplaceId,
      });
      mapping = mapping ?? this.mappingRepo.create({
        variantId: variant.id,
        ebayAccountId: input.ebayAccountId,
        marketplaceId: input.marketplaceId,
        inventorySku: variant.sku,
        status: 'processing',
      });
      mapping.status = 'processing';
            if (mapping.offerId) {
        await this.inventoryApi.updateOffer(input.storeId, mapping.offerId, offer);
      } else {
        const created = await this.inventoryApi.createOffer(input.storeId, offer);
        mapping.offerId = created.offerId ?? null;
      }
      mapping.inventorySku = variant.sku;
      mappings.push(await this.mappingRepo.save(mapping));
    }

    const groupKey = `${family.slug}-${input.marketplaceId}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
    await this.inventoryApi.createOrReplaceInventoryItemGroup(input.storeId, groupKey, group);
    const published = await this.inventoryApi.publishOfferByInventoryItemGroup(input.storeId, groupKey);
    for (const mapping of mappings) {
      mapping.status = 'published';
      mapping.listingId = published.listingId ?? null;
      mapping.resultPayload = { groupKey, listingId: published.listingId };
    }
    await this.mappingRepo.save(mappings);
    return { groupKey, listingId: published.listingId, variantCount: variants.length };
  }

  private variantLabel(variant: ProductVariant): string {
    return Object.values(variant.attributes ?? {})
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map(String)
      .filter(Boolean)
      .join(' / ');
  }

  private mapCondition(conditionId: string | null): EbayConditionEnum {
    const raw = (conditionId ?? '').toLowerCase();
    if (raw.includes('used') || raw === '3000') return 'USED_GOOD';
    if (raw.includes('refurb')) return 'SELLER_REFURBISHED';
    return 'NEW';
  }
}

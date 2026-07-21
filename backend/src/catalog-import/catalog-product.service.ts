import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogProduct } from './entities/catalog-product.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import {
  computeCatalogProductDerived,
  type CatalogProductDerived,
} from './utils/catalog-product-derivatives.js';
import {
  applyCatalogProductListFilters,
  type CatalogProductListParams,
} from './utils/catalog-product-list-query.js';
import { sanitizeTitle } from '../common/openai/listing-guards.js';
import { StorageService } from '../storage/storage.service.js';

export interface UpdateProductDto {
  title?: string;
  description?: string;
  brand?: string;
  mpn?: string;
  oemPartNumber?: string;
  partType?: string;
  placement?: string;
  material?: string;
  features?: string;
  countryOfOrigin?: string;
  price?: number;
  quantity?: number;
  conditionId?: string;
  conditionLabel?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrls?: string[];
  location?: string;
  format?: string;
  duration?: string;
  shippingProfile?: string;
  returnProfile?: string;
  paymentProfile?: string;
  fitmentData?: Record<string, unknown>[];
}

@Injectable()
export class CatalogProductService {
  private readonly logger = new Logger(CatalogProductService.name);

  constructor(
    @InjectRepository(CatalogProduct)
    private readonly productRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(params: CatalogProductListParams): Promise<{
    products: Array<CatalogProduct & { derived?: CatalogProductDerived }>;
    total: number;
  }> {
    const qb = this.productRepo.createQueryBuilder('p');
    applyCatalogProductListFilters(qb, params);

    qb.orderBy('p.createdAt', 'DESC').take(params.limit).skip(params.offset);

    const [products, total] = await qb.getManyAndCount();

    if (!params.includeDerived) {
      return { products, total };
    }

    const enriched = products.map((row) => ({
      ...row,
      derived: computeCatalogProductDerived(row),
    }));
    return { products: enriched, total };
  }

  async findOne(id: string): Promise<CatalogProduct> {
    const product = await this.productRepo.findOneBy({ id });
    if (!product)
      throw new NotFoundException(`Catalog product ${id} not found`);
    return product;
  }

  async findBySku(sku: string): Promise<CatalogProduct | null> {
    return this.productRepo.findOneBy({ sku });
  }

  async findByIds(ids: string[]): Promise<CatalogProduct[]> {
    return this.productRepo.findBy({ id: In(ids) });
  }

  async findByListingIds(listingIds: string[]): Promise<CatalogProduct[]> {
    // Look up listing records to get SKUs, then find catalog products by SKU
    const listings = await this.listingRepo.findBy({ id: In(listingIds) });
    const skus = listings
      .map((l) => l.customLabelSku)
      .filter((s): s is string => s != null && s !== '');
    if (!skus.length) return [];
    return this.productRepo
      .createQueryBuilder('p')
      .where('p.sku IN (:...skus)', { skus })
      .getMany();
  }

  applyProfileOverrides(
    products: CatalogProduct[],
    overrides: {
      shippingProfile?: string;
      returnProfile?: string;
      paymentProfile?: string;
    },
  ): CatalogProduct[] {
    const { shippingProfile, returnProfile, paymentProfile } = overrides;
    if (!shippingProfile && !returnProfile && !paymentProfile) {
      return products;
    }
    return products.map((p) => {
      const copy = { ...p } as CatalogProduct;
      if (shippingProfile) copy.shippingProfile = shippingProfile;
      if (returnProfile) copy.returnProfile = returnProfile;
      if (paymentProfile) copy.paymentProfile = paymentProfile;
      return copy;
    });
  }

  async persistProfileOverridesForListings(
    listingIds: string[],
    overrides: {
      shippingProfile?: string;
      returnProfile?: string;
      paymentProfile?: string;
    },
  ): Promise<void> {
    const { shippingProfile, returnProfile, paymentProfile } = overrides;
    if (!shippingProfile && !returnProfile && !paymentProfile) return;

    const listings = await this.listingRepo.findBy({ id: In(listingIds) });
    const skus = [
      ...new Set(
        listings
          .map((l) => l.customLabelSku)
          .filter((s): s is string => s != null && s !== ''),
      ),
    ];
    if (!skus.length) return;

    const products = await this.productRepo.findBy({ sku: In(skus) });
    for (const product of products) {
      if (shippingProfile) product.shippingProfile = shippingProfile;
      if (returnProfile) product.returnProfile = returnProfile;
      if (paymentProfile) product.paymentProfile = paymentProfile;
      await this.update(product.id, {
        shippingProfile: product.shippingProfile ?? undefined,
        returnProfile: product.returnProfile ?? undefined,
        paymentProfile: product.paymentProfile ?? undefined,
      });
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<CatalogProduct> {
    const product = await this.findOne(id);

    // Update product fields
    if (dto.title !== undefined) product.title = dto.title;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.brand !== undefined) {
      product.brand = dto.brand;
      product.brandNormalized = dto.brand
        ? dto.brand.toLowerCase().trim()
        : null;
    }
    if (dto.mpn !== undefined) {
      product.mpn = dto.mpn;
      product.mpnNormalized = dto.mpn
        ? dto.mpn.toLowerCase().replace(/[\s\-]/g, '')
        : null;
    }
    if (dto.oemPartNumber !== undefined)
      product.oemPartNumber = dto.oemPartNumber;
    if (dto.partType !== undefined) product.partType = dto.partType;
    if (dto.placement !== undefined) product.placement = dto.placement;
    if (dto.material !== undefined) product.material = dto.material;
    if (dto.features !== undefined) product.features = dto.features;
    if (dto.countryOfOrigin !== undefined)
      product.countryOfOrigin = dto.countryOfOrigin;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.quantity !== undefined) product.quantity = dto.quantity;
    if (dto.conditionId !== undefined) product.conditionId = dto.conditionId;
    if (dto.conditionLabel !== undefined)
      product.conditionLabel = dto.conditionLabel;
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.categoryName !== undefined) product.categoryName = dto.categoryName;
    if (dto.imageUrls !== undefined) {
      // Never let a raw temp/ upload URL land in image_urls — it gets purged by
      // the daily storage-cleanup job within 24h if nothing else confirms it.
      // mirrorRemoteImageUrls is a no-op for already-durable URLs.
      product.imageUrls = await this.storageService.mirrorRemoteImageUrls(
        dto.imageUrls,
        `catalog-product/${product.id}`,
      );
    }
    if (dto.location !== undefined) product.location = dto.location;
    if (dto.format !== undefined) product.format = dto.format;
    if (dto.duration !== undefined) product.duration = dto.duration;
    if (dto.shippingProfile !== undefined)
      product.shippingProfile = dto.shippingProfile;
    if (dto.returnProfile !== undefined)
      product.returnProfile = dto.returnProfile;
    if (dto.paymentProfile !== undefined)
      product.paymentProfile = dto.paymentProfile;
    if (dto.fitmentData !== undefined) product.fitmentData = dto.fitmentData;

    const saved = await this.productRepo.save(product);

    // Sync only fields present in this PATCH — never stomp listing titles
    // (or other listing-only edits) with stale catalog values when the DTO
    // did not include those fields.
    await this.syncToListingRecord(saved, dto);

    return saved;
  }

  async updateBySku(
    sku: string,
    dto: UpdateProductDto,
  ): Promise<CatalogProduct> {
    const product = await this.findBySku(sku);
    if (!product)
      throw new NotFoundException(`Catalog product with SKU ${sku} not found`);
    return this.update(product.id, dto);
  }

  /**
   * Sync catalog product changes to ALL listing_records matching this SKU.
   * Shared field edits propagate to every marketplace variant (US, AU, DE).
   *
   * Only fields present on `changed` are written. A brand/image/country
   * PATCH must not overwrite a manually corrected listing title with a
   * stale catalog_products.title.
   *
   * Uses Repository.update (not save) so listing @VersionColumn is not
   * bumped — callers often follow with a listing PUT that still holds
   * the pre-sync version.
   */
  private async syncToListingRecord(
    product: CatalogProduct,
    changed: UpdateProductDto,
  ): Promise<void> {
    if (!product.sku) return;

    const listings = await this.listingRepo.findBy({
      customLabelSku: product.sku,
    });
    if (!listings.length) return;

    const patch: Partial<ListingRecord> = {};
    if (changed.title !== undefined) patch.title = product.title;
    if (changed.description !== undefined)
      patch.description = product.description;
    if (changed.price !== undefined) {
      patch.startPrice = product.price != null ? String(product.price) : null;
      patch.startPriceNum = product.price;
    }
    if (changed.quantity !== undefined) {
      patch.quantity =
        product.quantity != null ? String(product.quantity) : null;
      patch.quantityNum = product.quantity;
    }
    if (changed.imageUrls !== undefined) {
      patch.itemPhotoUrl = product.imageUrls?.length
        ? product.imageUrls.join('|')
        : null;
    }
    if (changed.conditionId !== undefined)
      patch.conditionId = product.conditionId;
    if (changed.conditionLabel !== undefined)
      patch.conditionLabel = product.conditionLabel;
    if (changed.categoryId !== undefined)
      patch.categoryId = product.categoryId;
    if (changed.categoryName !== undefined)
      patch.categoryName = product.categoryName;
    if (changed.format !== undefined) patch.format = product.format;
    if (changed.duration !== undefined) patch.duration = product.duration;
    if (changed.location !== undefined) patch.location = product.location;
    if (changed.shippingProfile !== undefined)
      patch.shippingProfileName = product.shippingProfile;
    if (changed.returnProfile !== undefined)
      patch.returnProfileName = product.returnProfile;
    if (changed.paymentProfile !== undefined)
      patch.paymentProfileName = product.paymentProfile;
    if (changed.brand !== undefined) patch.cBrand = product.brand;
    if (changed.partType !== undefined) patch.cType = product.partType;
    if (changed.features !== undefined) patch.cFeatures = product.features;
    if (changed.mpn !== undefined)
      patch.cManufacturerPartNumber = product.mpn;
    if (changed.oemPartNumber !== undefined)
      patch.cOeOemPartNumber = product.oemPartNumber;
    if (changed.material !== undefined) patch.cMaterial = product.material;
    if (changed.placement !== undefined) patch.cPlacement = product.placement;
    if (changed.countryOfOrigin !== undefined)
      patch.countryOfOrigin = product.countryOfOrigin;

    if (Object.keys(patch).length === 0) return;

    await this.listingRepo.update({ customLabelSku: product.sku }, patch);
  }

  async bulkFixConditionMismatchTitles(pipelineJobId: string): Promise<{
    catalogUpdated: number;
    listingsUpdated: number;
  }> {
    const runner = this.productRepo.manager.connection.createQueryRunner();
    await runner.connect();
    try {
      const conditionFilter = `
        AND (
          condition_label ~* '\\m(used|refurbished|salvage)\\M'
          OR condition_id IN ('3000','4000','5000','6000','7000','2000','2500')
          OR condition_id ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
        )`;

      const catalogResult = await runner.query(
        `
        UPDATE catalog_products
           SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
               "updatedAt" = NOW()
         WHERE pipeline_job_id = $1
           AND title ~* '\\mNew\\M'
           ${conditionFilter}
      `,
        [pipelineJobId],
      );

      const listingResult = await runner.query(
        `
        UPDATE listing_records
           SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
               "updatedAt" = NOW()
         WHERE pipeline_job_id = $1
           AND title ~* '\\mNew\\M'
           AND (
             condition_label ~* '\\m(used|refurbished|salvage)\\M'
             OR "conditionId" IN ('3000','4000','5000','6000','7000','2000','2500')
             OR "conditionId" ~* '^(USED_|FOR_PARTS|SELLER_REFURB)'
           )
      `,
        [pipelineJobId],
      );

      return {
        catalogUpdated: catalogResult[1] ?? 0,
        listingsUpdated: listingResult[1] ?? 0,
      };
    } finally {
      await runner.release();
    }
  }

  /**
   * Strip VINs, part numbers, and duplicate make/model from all titles
   * belonging to a pipeline job.  Uses the same deterministic sanitization
   * as the post-AI guard so results are identical.
   */
  async bulkSanitizeTitles(pipelineJobId: string): Promise<{
    catalogUpdated: number;
    listingsUpdated: number;
  }> {
    let catalogUpdated = 0;
    let listingsUpdated = 0;

    const products = await this.productRepo.find({
      where: { pipelineJobId },
      select: ['id', 'title'],
    });
    for (const p of products) {
      const cleaned = sanitizeTitle(p.title);
      if (cleaned !== p.title) {
        await this.productRepo.update(p.id, { title: cleaned });
        catalogUpdated++;
      }
    }

    const listings = await this.listingRepo.find({
      where: { pipelineJobId },
      select: ['id', 'title'],
    });
    for (const l of listings) {
      if (!l.title) continue;
      const cleaned = sanitizeTitle(l.title);
      if (cleaned !== l.title) {
        await this.listingRepo.update(l.id, { title: cleaned });
        listingsUpdated++;
      }
    }

    this.logger.log(
      `bulkSanitizeTitles(${pipelineJobId}): catalog=${catalogUpdated}, listings=${listingsUpdated}`,
    );
    return { catalogUpdated, listingsUpdated };
  }
}

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
    if (dto.imageUrls !== undefined) product.imageUrls = dto.imageUrls;
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

    // Sync changes to all corresponding listing_records (matched by SKU)
    await this.syncToListingRecord(saved);

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
   */
  private async syncToListingRecord(product: CatalogProduct): Promise<void> {
    if (!product.sku) return;

    const listings = await this.listingRepo.findBy({
      customLabelSku: product.sku,
    });
    if (!listings.length) return;

    for (const listing of listings) {
      listing.title = product.title;
      listing.description = product.description;
      listing.startPrice = product.price != null ? String(product.price) : null;
      listing.startPriceNum = product.price;
      listing.quantity =
        product.quantity != null ? String(product.quantity) : null;
      listing.quantityNum = product.quantity;
      listing.itemPhotoUrl = product.imageUrls?.length
        ? product.imageUrls.join('|')
        : null;
      listing.conditionId = product.conditionId;
      listing.conditionLabel = product.conditionLabel;
      listing.categoryId = product.categoryId;
      listing.categoryName = product.categoryName;
      listing.format = product.format;
      listing.duration = product.duration;
      listing.location = product.location;
      listing.shippingProfileName = product.shippingProfile;
      listing.returnProfileName = product.returnProfile;
      listing.paymentProfileName = product.paymentProfile;
      listing.cBrand = product.brand;
      listing.cType = product.partType;
      listing.cFeatures = product.features;
      listing.cManufacturerPartNumber = product.mpn;
      listing.cOeOemPartNumber = product.oemPartNumber;
      listing.cMaterial = product.material;
      listing.cPlacement = product.placement;
      listing.countryOfOrigin = product.countryOfOrigin;
    }

    await this.listingRepo.save(listings);
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

      const catalogResult = await runner.query(`
        UPDATE catalog_products
           SET title = trim(regexp_replace(regexp_replace(title, '\\mNew\\M', '', 'gi'), '\\s+', ' ', 'g')),
               "updatedAt" = NOW()
         WHERE pipeline_job_id = $1
           AND title ~* '\\mNew\\M'
           ${conditionFilter}
      `, [pipelineJobId]);

      const listingResult = await runner.query(`
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
      `, [pipelineJobId]);

      return {
        catalogUpdated: catalogResult[1] ?? 0,
        listingsUpdated: listingResult[1] ?? 0,
      };
    } finally {
      await runner.release();
    }
  }
}

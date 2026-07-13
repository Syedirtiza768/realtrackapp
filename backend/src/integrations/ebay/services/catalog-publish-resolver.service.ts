import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogProduct } from '../../../catalog-import/entities/catalog-product.entity.js';
import { ListingRecord } from '../../../listings/listing-record.entity.js';
import { ImageAsset } from '../../../storage/entities/image-asset.entity.js';
import { sanitizeEbayImageUrls } from '../../../channels/ebay/ebay-listing-images.util.js';

/** Unified publish snapshot from catalog_products and/or listing_records. */
export interface CatalogPublishSnapshot {
  catalogProductId: string;
  listingRecordId: string | null;
  sku: string;
  title: string;
  description: string | null;
  brand: string | null;
  mpn: string | null;
  partType: string | null;
  price: number | null;
  quantity: number | null;
  categoryId: string | null;
  conditionId: string | null;
  conditionLabel: string | null;
  imageUrls: string[];
}

export interface ResolvedCatalogPublishSource {
  snapshot: CatalogPublishSnapshot;
  catalogProduct: CatalogProduct | null;
  listingRecord: ListingRecord | null;
  warnings: string[];
}

@Injectable()
export class CatalogPublishResolverService {
  constructor(
    @InjectRepository(CatalogProduct)
    private readonly catalogRepo: Repository<CatalogProduct>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
  ) {}

  /**
   * Resolve a catalog browse/publish reference ID.
   * Accepts either catalog_products.id or listing_records.id (catalog UI uses the latter).
   */
  async resolve(
    productRefId: string,
  ): Promise<ResolvedCatalogPublishSource | null> {
    const warnings: string[] = [];

    let catalogProduct = await this.catalogRepo.findOne({
      where: { id: productRefId },
    });
    let listingRecord = await this.listingRepo.findOne({
      where: { id: productRefId },
    });

    if (!catalogProduct && listingRecord?.customLabelSku) {
      catalogProduct = await this.catalogRepo.findOne({
        where: { sku: listingRecord.customLabelSku },
      });
      if (catalogProduct) {
        warnings.push('Resolved catalog product by SKU from listing record');
      }
    }

    if (!listingRecord && catalogProduct?.sku) {
      listingRecord = await this.listingRepo.findOne({
        where: { customLabelSku: catalogProduct.sku },
      });
    }

    if (!catalogProduct && !listingRecord) {
      return null;
    }

    if (!catalogProduct && listingRecord) {
      catalogProduct = await this.ensureCatalogProductFromListing(
        listingRecord,
        warnings,
      );
    } else if (catalogProduct && listingRecord) {
      catalogProduct = await this.backfillCatalogProductFromListing(
        catalogProduct,
        listingRecord,
        warnings,
      );
    }

    const imageUrls = await this.resolveImageUrls(
      catalogProduct,
      listingRecord,
      warnings,
    );

    const snapshot: CatalogPublishSnapshot = {
      catalogProductId: catalogProduct!.id,
      listingRecordId: listingRecord?.id ?? null,
      sku:
        catalogProduct?.sku?.trim() ||
        listingRecord?.customLabelSku?.trim() ||
        catalogProduct?.id ||
        listingRecord!.id,
      title: catalogProduct?.title || listingRecord?.title || '',
      description:
        catalogProduct?.description ?? listingRecord?.description ?? null,
      brand:
        catalogProduct?.brand ??
        listingRecord?.cBrand ??
        listingRecord?.manufacturerName ??
        null,
      mpn:
        catalogProduct?.mpn ?? listingRecord?.cManufacturerPartNumber ?? null,
      partType: catalogProduct?.partType ?? listingRecord?.cType ?? null,
      price:
        catalogProduct?.price != null
          ? Number(catalogProduct.price)
          : (listingRecord?.startPriceNum ?? null),
      quantity: catalogProduct?.quantity ?? listingRecord?.quantityNum ?? null,
      categoryId:
        catalogProduct?.categoryId ?? listingRecord?.categoryId ?? null,
      conditionId:
        catalogProduct?.conditionId ?? listingRecord?.conditionId ?? null,
      conditionLabel: catalogProduct?.conditionLabel ?? null,
      imageUrls,
    };

    return { snapshot, catalogProduct, listingRecord, warnings };
  }

  private async resolveImageUrls(
    catalogProduct: CatalogProduct | null,
    listingRecord: ListingRecord | null,
    warnings: string[],
  ): Promise<string[]> {
    const candidates: string[] = [];

    if (catalogProduct?.imageUrls?.length) {
      candidates.push(...catalogProduct.imageUrls);
    }

    if (listingRecord?.itemPhotoUrl) {
      candidates.push(listingRecord.itemPhotoUrl);
      if (!catalogProduct?.imageUrls?.length) {
        warnings.push('Using images from listing record itemPhotoUrl');
      }
    }

    if (listingRecord?.id) {
      const assets = await this.assetRepo.find({
        where: { listingId: listingRecord.id },
        order: { sortOrder: 'ASC', uploadedAt: 'ASC' },
      });
      for (const asset of assets) {
        if (asset.cdnUrl) candidates.push(asset.cdnUrl);
      }
      if (assets.length && !candidates.length) {
        warnings.push('Using images from linked image_assets records');
      }
    }

    const sanitized = sanitizeEbayImageUrls(candidates);
    warnings.push(...sanitized.warnings);
    return sanitized.imageUrls;
  }

  /**
   * Create a catalog_products row from a listing record so publish jobs / FKs
   * can reference catalog_products.id (catalog browse uses listing_records.id).
   */
  private async ensureCatalogProductFromListing(
    listing: ListingRecord,
    warnings: string[],
  ): Promise<CatalogProduct> {
    const sku = listing.customLabelSku?.trim() || `listing:${listing.id}`;
    const existing = await this.catalogRepo.findOne({ where: { sku } });
    if (existing) {
      warnings.push('Linked existing catalog product by SKU for publish');
      return this.backfillCatalogProductFromListing(
        existing,
        listing,
        warnings,
      );
    }

    const imageUrls = sanitizeEbayImageUrls(
      listing.itemPhotoUrl ? [listing.itemPhotoUrl] : [],
    ).imageUrls;

    const title =
      listing.title?.trim() ||
      listing.cBrand?.trim() ||
      sku ||
      'Automotive Part';

    const product = this.catalogRepo.create({
      sku,
      title,
      description: listing.description,
      brand: listing.cBrand,
      mpn: listing.cManufacturerPartNumber,
      partType: listing.cType,
      price: listing.startPriceNum,
      quantity: listing.quantityNum,
      categoryId: listing.categoryId,
      categoryName: listing.categoryName,
      conditionId: listing.conditionId,
      location: listing.location,
      format: listing.format,
      duration: listing.duration,
      shippingProfile: listing.shippingProfileName,
      returnProfile: listing.returnProfileName,
      paymentProfile: listing.paymentProfileName,
      imageUrls,
      sourceFile: listing.sourceFileName,
      sourceRow: listing.sourceRowNumber,
    });

    const saved = await this.catalogRepo.save(product);
    warnings.push('Created catalog product from listing record for publish');
    return saved;
  }

  /** Copy listing images/metadata onto catalog product when catalog row is stale or empty. */
  private async backfillCatalogProductFromListing(
    product: CatalogProduct,
    listing: ListingRecord,
    warnings: string[],
  ): Promise<CatalogProduct> {
    let dirty = false;
    const listingImages = sanitizeEbayImageUrls(
      listing.itemPhotoUrl ? [listing.itemPhotoUrl] : [],
    ).imageUrls;

    if (!product.imageUrls?.length && listingImages.length) {
      product.imageUrls = listingImages;
      dirty = true;
      warnings.push('Backfilled catalog product images from listing record');
    }
    if (!product.title?.trim() && listing.title?.trim()) {
      product.title = listing.title.trim();
      dirty = true;
    }
    if (product.price == null && listing.startPriceNum != null) {
      product.price = listing.startPriceNum;
      dirty = true;
    }
    if (product.quantity == null && listing.quantityNum != null) {
      product.quantity = listing.quantityNum;
      dirty = true;
    }
    if (!product.categoryId?.trim() && listing.categoryId?.trim()) {
      product.categoryId = listing.categoryId;
      product.categoryName = listing.categoryName;
      dirty = true;
    }

    // Sync business policy profile names from listing record to catalog.
    // listing_records is the source of truth for imported/configured profiles;
    // catalog_products should always reflect the latest values so the UI and
    // future publish jobs see consistent data.
    if (
      listing.shippingProfileName?.trim() &&
      listing.shippingProfileName.trim() !== (product.shippingProfile ?? '')
    ) {
      product.shippingProfile = listing.shippingProfileName.trim();
      dirty = true;
    }
    if (
      listing.returnProfileName?.trim() &&
      listing.returnProfileName.trim() !== (product.returnProfile ?? '')
    ) {
      product.returnProfile = listing.returnProfileName.trim();
      dirty = true;
    }
    if (
      listing.paymentProfileName?.trim() &&
      listing.paymentProfileName.trim() !== (product.paymentProfile ?? '')
    ) {
      product.paymentProfile = listing.paymentProfileName.trim();
      dirty = true;
    }

    return dirty ? this.catalogRepo.save(product) : product;
  }
}

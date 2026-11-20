"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogPublishResolverService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../../../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../../listings/listing-record.entity.js");
const image_asset_entity_js_1 = require("../../../storage/entities/image-asset.entity.js");
const storage_service_js_1 = require("../../../storage/storage.service.js");
const fashion_ebay_images_util_js_1 = require("../../../fashion-batch-publish/fashion-ebay-images.util.js");
const ebay_listing_images_util_js_1 = require("../../../channels/ebay/ebay-listing-images.util.js");
function filterTempUrls(urls) {
    const arr = Array.isArray(urls) ? urls : urls ? [urls] : [];
    const tempPattern = /\/temp\//;
    const durable = arr.filter((u) => u && !tempPattern.test(u));
    return durable.length > 0 ? durable : arr.filter(Boolean);
}
function isDurableUrl(url) {
    return !/\/temp\//.test(url);
}
let CatalogPublishResolverService = class CatalogPublishResolverService {
    catalogRepo;
    listingRepo;
    assetRepo;
    storageService;
    constructor(catalogRepo, listingRepo, assetRepo, storageService) {
        this.catalogRepo = catalogRepo;
        this.listingRepo = listingRepo;
        this.assetRepo = assetRepo;
        this.storageService = storageService;
    }
    async resolve(productRefId) {
        const warnings = [];
        let catalogProduct = await this.catalogRepo.findOne({
            where: { id: productRefId },
        });
        let listingRecord = await this.listingRepo.findOne({
            where: { id: productRefId },
        });
        const resolvedFromListingId = Boolean(listingRecord);
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
                order: {
                    publishedAt: { direction: 'DESC', nulls: 'LAST' },
                    updatedAt: 'DESC',
                },
            });
        }
        if (!catalogProduct && !listingRecord) {
            return null;
        }
        if (!catalogProduct && listingRecord) {
            catalogProduct = await this.ensureCatalogProductFromListing(listingRecord, warnings);
        }
        else if (catalogProduct && listingRecord) {
            catalogProduct = await this.backfillCatalogProductFromListing(catalogProduct, listingRecord, warnings);
        }
        const imageBrand = resolvedFromListingId
            ? (listingRecord?.cBrand ?? catalogProduct?.brand)
            : (catalogProduct?.brand ?? listingRecord?.cBrand);
        const resolvedImageUrls = await this.resolveImageUrls(catalogProduct, listingRecord, warnings, resolvedFromListingId, imageBrand);
        const imageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(imageBrand)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(resolvedImageUrls, imageBrand)
            : resolvedImageUrls;
        const preferListing = (listingValue, catalogValue) => resolvedFromListingId
            ? (listingValue ?? catalogValue ?? null)
            : (catalogValue ?? listingValue ?? null);
        const preferListingText = (listingValue, catalogValue) => {
            const listingText = listingValue?.trim();
            const catalogText = catalogValue?.trim();
            return resolvedFromListingId
                ? listingText || catalogText || null
                : catalogText || listingText || null;
        };
        const listingSku = listingRecord?.customLabelSku?.trim();
        const catalogSku = catalogProduct?.sku?.trim();
        if (listingSku && catalogSku && listingSku !== catalogSku) {
            warnings.push(resolvedFromListingId
                ? 'Catalog SKU differs from the reviewed listing custom label SKU; using the listing value for publish'
                : 'Listing custom label SKU differs from the catalog SKU; using the catalog value for publish');
        }
        const publishSku = resolvedFromListingId
            ? listingSku || catalogSku
            : catalogSku || listingSku;
        const snapshot = {
            catalogProductId: catalogProduct.id,
            listingRecordId: listingRecord?.id ?? null,
            sku: publishSku ||
                catalogProduct?.id ||
                listingRecord.id,
            title: preferListing(listingRecord?.title, catalogProduct?.title)?.trim() ||
                '',
            description: preferListing(listingRecord?.description, catalogProduct?.description),
            brand: preferListingText(listingRecord?.cBrand ?? listingRecord?.manufacturerName, catalogProduct?.brand),
            mpn: preferListingText(listingRecord?.cManufacturerPartNumber, catalogProduct?.mpn),
            partType: preferListingText(listingRecord?.cType, catalogProduct?.partType),
            price: preferListing(listingRecord?.startPriceNum, catalogProduct?.price != null ? Number(catalogProduct.price) : null),
            quantity: preferListing(listingRecord?.quantityNum, catalogProduct?.quantity),
            categoryId: preferListing(listingRecord?.categoryId, catalogProduct?.categoryId),
            conditionId: preferListing(listingRecord?.conditionId, catalogProduct?.conditionId),
            conditionLabel: catalogProduct?.conditionLabel ?? null,
            imageUrls,
            vertical: catalogProduct?.vertical ?? listingRecord?.vertical ?? null,
        };
        return { snapshot, catalogProduct, listingRecord, warnings };
    }
    async resolveImageUrls(catalogProduct, listingRecord, warnings, preferListingRecord = false, brandOrTitle) {
        const masters = (0, fashion_ebay_images_util_js_1.fashionEbayMasterImages)(catalogProduct);
        if (masters) {
            warnings.push(`Using ${masters.length} eBay master image(s) from the Fashion publish pipeline`);
            return masters;
        }
        const candidates = [];
        const addListingImages = () => {
            if (listingRecord?.itemPhotoUrl)
                candidates.push(...filterTempUrls(listingRecord.itemPhotoUrl));
        };
        const addCatalogImages = () => {
            if (catalogProduct?.imageUrls?.length) {
                candidates.push(...filterTempUrls(catalogProduct.imageUrls));
            }
        };
        if (preferListingRecord) {
            addListingImages();
            addCatalogImages();
        }
        else {
            addCatalogImages();
            addListingImages();
        }
        if (listingRecord?.itemPhotoUrl && !catalogProduct?.imageUrls?.length) {
            warnings.push('Using images from listing record itemPhotoUrl');
        }
        const hasOnlyTempUrls = candidates.length > 0 && !candidates.some(isDurableUrl);
        if (listingRecord?.id && (!candidates.length || hasOnlyTempUrls)) {
            const assets = await this.assetRepo.find({
                where: { listingId: listingRecord.id },
                order: { sortOrder: 'ASC', uploadedAt: 'ASC' },
            });
            const durableAssets = assets
                .filter((a) => a.cdnUrl && isDurableUrl(a.cdnUrl))
                .map((a) => a.cdnUrl);
            if (durableAssets.length) {
                if (hasOnlyTempUrls) {
                    warnings.push(`Replaced ${candidates.length} temp S3 URL(s) with ${durableAssets.length} durable image_assets URL(s)`);
                    candidates.length = 0;
                }
                candidates.push(...durableAssets);
                warnings.push('Using images from linked image_assets records');
            }
            else if (!candidates.length) {
                for (const asset of assets) {
                    if (asset.cdnUrl)
                        candidates.push(asset.cdnUrl);
                }
                if (assets.length) {
                    warnings.push('Using images from linked image_assets records');
                }
            }
        }
        const sanitized = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(candidates, (0, ebay_listing_images_util_js_1.isSingleImageBrand)(brandOrTitle)
            ? {
                maxImages: Math.max((0, ebay_listing_images_util_js_1.flattenImageUrlInputs)(candidates).length, 1),
            }
            : undefined);
        warnings.push(...sanitized.warnings);
        return Promise.all(sanitized.imageUrls.map((url) => this.storageService.getPreferredImageUrl(url)));
    }
    async ensureCatalogProductFromListing(listing, warnings) {
        const sku = listing.customLabelSku?.trim() || `listing:${listing.id}`;
        const existing = await this.catalogRepo.findOne({ where: { sku } });
        if (existing) {
            warnings.push('Linked existing catalog product by SKU for publish');
            return this.backfillCatalogProductFromListing(existing, listing, warnings);
        }
        const listingImages = filterTempUrls(listing.itemPhotoUrl);
        const imageUrls = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(listing.cBrand)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(listingImages, listing.cBrand)
            : (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(listingImages).imageUrls;
        const title = listing.title?.trim() ||
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
            vertical: listing.vertical,
            verticalAttributes: listing.verticalAttributes ?? {},
            sourceFile: listing.sourceFileName,
            sourceRow: listing.sourceRowNumber,
        });
        const saved = await this.catalogRepo.save(product);
        warnings.push('Created catalog product from listing record for publish');
        return saved;
    }
    async backfillCatalogProductFromListing(product, listing, warnings) {
        let dirty = false;
        const rawListingImages = filterTempUrls(listing.itemPhotoUrl);
        const listingImages = (0, ebay_listing_images_util_js_1.isSingleImageBrand)(listing.cBrand)
            ? (0, ebay_listing_images_util_js_1.selectPrimaryImageForBrand)(rawListingImages, listing.cBrand)
            : (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(rawListingImages).imageUrls;
        if (!product.vertical && listing.vertical) {
            product.vertical = listing.vertical;
            product.verticalAttributes = listing.verticalAttributes ?? {};
            dirty = true;
        }
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
        if (listing.shippingProfileName?.trim() &&
            listing.shippingProfileName.trim() !== (product.shippingProfile ?? '')) {
            product.shippingProfile = listing.shippingProfileName.trim();
            dirty = true;
        }
        if (listing.returnProfileName?.trim() &&
            listing.returnProfileName.trim() !== (product.returnProfile ?? '')) {
            product.returnProfile = listing.returnProfileName.trim();
            dirty = true;
        }
        if (listing.paymentProfileName?.trim() &&
            listing.paymentProfileName.trim() !== (product.paymentProfile ?? '')) {
            product.paymentProfile = listing.paymentProfileName.trim();
            dirty = true;
        }
        return dirty ? this.catalogRepo.save(product) : product;
    }
};
exports.CatalogPublishResolverService = CatalogPublishResolverService;
exports.CatalogPublishResolverService = CatalogPublishResolverService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        storage_service_js_1.StorageService])
], CatalogPublishResolverService);
//# sourceMappingURL=catalog-publish-resolver.service.js.map
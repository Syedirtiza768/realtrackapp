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
var CleanupProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const image_asset_entity_js_1 = require("../entities/image-asset.entity.js");
const storage_service_js_1 = require("../storage.service.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
let CleanupProcessor = CleanupProcessor_1 = class CleanupProcessor extends bullmq_1.WorkerHost {
    assetRepo;
    listingRepo;
    catalogRepo;
    storageService;
    logger = new common_1.Logger(CleanupProcessor_1.name);
    constructor(assetRepo, listingRepo, catalogRepo, storageService) {
        super();
        this.assetRepo = assetRepo;
        this.listingRepo = listingRepo;
        this.catalogRepo = catalogRepo;
        this.storageService = storageService;
    }
    async process(_job) {
        this.logger.log('Starting orphan image cleanup');
        let cleaned = 0;
        let healed = 0;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const deletedAssets = await this.assetRepo.find({
            where: { deletedAt: (0, typeorm_2.LessThan)(sevenDaysAgo) },
            withDeleted: true,
        });
        for (const asset of deletedAssets) {
            try {
                await this.storageService.deleteObject(asset.s3Key);
                if (asset.s3KeyThumb) {
                    await this.storageService.deleteObject(asset.s3KeyThumb);
                }
                await this.assetRepo.delete(asset.id);
                cleaned++;
            }
            catch (err) {
                this.logger.error(`Failed to clean asset=${asset.id}`, err);
            }
        }
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const orphanedAssets = await this.assetRepo.find({
            where: {
                listingId: (0, typeorm_2.IsNull)(),
                jobId: (0, typeorm_2.IsNull)(),
                uploadedAt: (0, typeorm_2.LessThan)(oneDayAgo),
            },
        });
        for (const asset of orphanedAssets) {
            try {
                if (this.storageService.isTempKey(asset.s3Key)) {
                    const rowsHealed = await this.healIfReferenced(asset);
                    if (rowsHealed > 0) {
                        healed++;
                        this.logger.warn(`Orphan temp asset ${asset.id} (${asset.s3Key}) was still referenced by ${rowsHealed} row(s) — mirrored to durable storage and repointed before deleting the original.`);
                    }
                }
                await this.storageService.deleteObject(asset.s3Key);
                if (asset.s3KeyThumb) {
                    await this.storageService.deleteObject(asset.s3KeyThumb);
                }
                await this.assetRepo.delete(asset.id);
                cleaned++;
            }
            catch (err) {
                this.logger.error(`Failed to clean orphan asset=${asset.id}`, err);
            }
        }
        const strandedTemps = await this.assetRepo.find({
            where: {
                listingId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
                s3Key: (0, typeorm_2.Like)('%temp/%'),
                uploadedAt: (0, typeorm_2.LessThan)(oneDayAgo),
            },
        });
        for (const asset of strandedTemps) {
            try {
                const newKey = await this.storageService.confirmUpload(asset.s3Key, asset.listingId, asset.id);
                asset.s3Key = newKey;
                asset.cdnUrl = this.storageService.getCdnUrl(newKey);
                await this.assetRepo.save(asset);
                healed++;
                this.logger.warn(`Stranded temp asset ${asset.id} (${asset.s3Key}) had listingId=${asset.listingId} — moved to originals/.`);
            }
            catch (err) {
                this.logger.error(`Failed to move stranded temp asset=${asset.id}`, err);
            }
        }
        this.logger.log(`Cleanup complete: ${cleaned} images removed, ${healed} still-referenced temp uploads healed first`);
        return { cleaned, healed };
    }
    async healIfReferenced(asset) {
        const oldUrl = this.storageService.getCdnUrl(asset.s3Key);
        const [listingMatches, catalogMatches] = await Promise.all([
            this.listingRepo
                .createQueryBuilder('r')
                .where('r."itemPhotoUrl" LIKE :pattern', { pattern: `%${oldUrl}%` })
                .getMany(),
            this.catalogRepo
                .createQueryBuilder('c')
                .where(':url = ANY(c.image_urls)', { url: oldUrl })
                .getMany(),
        ]);
        if (listingMatches.length === 0 && catalogMatches.length === 0) {
            return 0;
        }
        const buf = await this.storageService.getObjectBuffer(asset.s3Key);
        const basename = asset.s3Key.split('/').pop();
        const destKey = this.storageService.buildDurableKey(`catalog-images/healed/${basename}`);
        await this.storageService.putObject(destKey, buf, asset.mimeType);
        const newUrl = this.storageService.getCdnUrl(destKey);
        if (listingMatches.length > 0) {
            await this.listingRepo
                .createQueryBuilder()
                .update()
                .set({
                itemPhotoUrl: () => `replace("itemPhotoUrl", :old, :new)`,
            })
                .where('"itemPhotoUrl" LIKE :pattern', { pattern: `%${oldUrl}%` })
                .setParameters({ old: oldUrl, new: newUrl })
                .execute();
        }
        if (catalogMatches.length > 0) {
            await this.catalogRepo
                .createQueryBuilder()
                .update()
                .set({
                imageUrls: () => `array_replace(image_urls, :old, :new)`,
            })
                .where(':old = ANY(image_urls)', { old: oldUrl })
                .setParameters({ old: oldUrl, new: newUrl })
                .execute();
        }
        return listingMatches.length + catalogMatches.length;
    }
};
exports.CleanupProcessor = CleanupProcessor;
exports.CleanupProcessor = CleanupProcessor = CleanupProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('storage-cleanup', { concurrency: 1 }),
    __param(0, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(2, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        storage_service_js_1.StorageService])
], CleanupProcessor);
//# sourceMappingURL=cleanup.processor.js.map
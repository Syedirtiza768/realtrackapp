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
var ThumbnailProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const image_asset_entity_js_1 = require("../entities/image-asset.entity.js");
const image_drive_asset_entity_js_1 = require("../entities/image-drive-asset.entity.js");
const image_processor_service_js_1 = require("../image-processor.service.js");
const storage_service_js_1 = require("../storage.service.js");
const THUMBNAIL_WORKER_CONCURRENCY = Math.max(1, Number(process.env.STORAGE_THUMBNAIL_CONCURRENCY ?? '3') || 3);
let ThumbnailProcessor = ThumbnailProcessor_1 = class ThumbnailProcessor extends bullmq_1.WorkerHost {
    imageProcessor;
    storageService;
    assetRepo;
    driveAssetRepo;
    logger = new common_1.Logger(ThumbnailProcessor_1.name);
    constructor(imageProcessor, storageService, assetRepo, driveAssetRepo) {
        super();
        this.imageProcessor = imageProcessor;
        this.storageService = storageService;
        this.assetRepo = assetRepo;
        this.driveAssetRepo = driveAssetRepo;
    }
    async process(job) {
        if (job.name === 'generate-catalog-variants') {
            const { s3Key } = job.data;
            this.logger.log(`Generating catalog-image variants for key=${s3Key}`);
            try {
                await this.imageProcessor.processImage(s3Key);
            }
            catch (err) {
                this.logger.error(`Catalog variant generation failed for ${s3Key}`, err);
                throw err;
            }
            return;
        }
        if (job.name === 'generate-drive-variants') {
            const { assetId, s3Key } = job.data;
            this.logger.log(`Generating drive variants for asset=${assetId}`);
            try {
                const result = await this.imageProcessor.processImage(s3Key);
                await this.driveAssetRepo.update(assetId, {
                    s3KeyThumb: result.thumbnailKey,
                    s3KeyMedium: result.mediumKey,
                    width: result.width,
                    height: result.height,
                    blurhash: result.blurhash,
                });
                this.logger.log(`Drive variants generated for asset=${assetId}`);
            }
            catch (err) {
                this.logger.error(`Drive variant generation failed for asset=${assetId}`, err);
                throw err;
            }
            return;
        }
        const { assetId, s3Key } = job.data;
        this.logger.log(`Generating thumbnails for asset=${assetId}`);
        try {
            const result = await this.imageProcessor.processImage(s3Key);
            await this.assetRepo.update(assetId, {
                s3KeyThumb: result.thumbnailKey,
                s3KeyMedium: result.mediumKey,
                cdnUrl: this.storageService.getCdnUrl(s3Key),
                width: result.width,
                height: result.height,
                blurhash: result.blurhash,
            });
            this.logger.log(`Thumbnails generated for asset=${assetId}`);
        }
        catch (err) {
            this.logger.error(`Thumbnail generation failed for asset=${assetId}`, err);
            throw err;
        }
    }
};
exports.ThumbnailProcessor = ThumbnailProcessor;
exports.ThumbnailProcessor = ThumbnailProcessor = ThumbnailProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('storage-thumbnails', { concurrency: THUMBNAIL_WORKER_CONCURRENCY }),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(3, (0, typeorm_1.InjectRepository)(image_drive_asset_entity_js_1.ImageDriveAsset)),
    __metadata("design:paramtypes", [image_processor_service_js_1.ImageProcessorService,
        storage_service_js_1.StorageService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ThumbnailProcessor);
//# sourceMappingURL=thumbnail.processor.js.map
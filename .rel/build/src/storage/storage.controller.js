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
var StorageController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const swagger_1 = require("@nestjs/swagger");
const typeorm_2 = require("typeorm");
const throttler_1 = require("@nestjs/throttler");
const image_asset_entity_js_1 = require("./entities/image-asset.entity.js");
const storage_service_js_1 = require("./storage.service.js");
const image_processor_service_js_1 = require("./image-processor.service.js");
const request_upload_dto_js_1 = require("./dto/request-upload.dto.js");
const image_transform_dto_js_1 = require("./dto/image-transform.dto.js");
const require_permissions_decorator_js_1 = require("../rbac/decorators/require-permissions.decorator.js");
const public_decorator_js_1 = require("../auth/decorators/public.decorator.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
let StorageController = class StorageController {
    static { StorageController_1 = this; }
    storageService;
    imageProcessor;
    assetRepo;
    listingRepo;
    catalogProductRepo;
    thumbnailQueue;
    logger = new common_1.Logger(StorageController_1.name);
    static VARIANT_RE = /_(thumb|sm|medium|lg)\.webp$/;
    static ORIGINAL_EXTS = [
        '.webp',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.heic',
        '.avif',
    ];
    static WEBP_FALLBACK_EXTS = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.bmp',
        '.heic',
        '.avif',
    ];
    static MAX_VARIANT_GEN = 4;
    variantGenInflight = new Map();
    activeVariantGen = 0;
    constructor(storageService, imageProcessor, assetRepo, listingRepo, catalogProductRepo, thumbnailQueue) {
        this.storageService = storageService;
        this.imageProcessor = imageProcessor;
        this.assetRepo = assetRepo;
        this.listingRepo = listingRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.thumbnailQueue = thumbnailQueue;
    }
    async getUploadUrl(dto) {
        const { uploadUrl, s3Key, assetId } = await this.storageService.generateUploadUrl(dto.filename, dto.mimeType, dto.listingId);
        const asset = this.assetRepo.create({
            id: assetId,
            listingId: dto.listingId ?? null,
            s3Bucket: this.storageService.getBucket(),
            s3Key,
            mimeType: dto.mimeType,
            fileSizeBytes: dto.fileSize ?? 0,
            originalFilename: dto.filename,
        });
        await this.assetRepo.save(asset);
        return { uploadUrl, s3Key, assetId };
    }
    async confirmUpload(body) {
        const asset = await this.assetRepo.findOneBy({ id: body.assetId });
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${body.assetId} not found`);
        }
        if (body.listingId && this.storageService.isTempKey(asset.s3Key)) {
            const newKey = await this.storageService.confirmUpload(asset.s3Key, body.listingId, asset.id);
            asset.s3Key = newKey;
            asset.listingId = body.listingId;
        }
        asset.cdnUrl = this.storageService.getCdnUrl(asset.s3Key);
        await this.assetRepo.save(asset);
        await this.thumbnailQueue.add('generate', { assetId: asset.id, s3Key: asset.s3Key }, {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
        });
        return { asset };
    }
    async getListingImages(listingId) {
        const images = await this.assetRepo.find({
            where: { listingId },
            order: { sortOrder: 'ASC', uploadedAt: 'ASC' },
        });
        return { images };
    }
    async updateAsset(assetId, dto) {
        const asset = await this.assetRepo.findOneBy({ id: assetId });
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${assetId} not found`);
        }
        if (dto.isPrimary && asset.listingId) {
            await this.assetRepo.update({ listingId: asset.listingId, isPrimary: true, id: (0, typeorm_2.Not)(assetId) }, { isPrimary: false });
        }
        Object.assign(asset, dto);
        await this.assetRepo.save(asset);
        return { asset };
    }
    async deleteAsset(assetId) {
        const asset = await this.assetRepo.findOneBy({ id: assetId });
        if (!asset) {
            throw new common_1.NotFoundException(`Asset ${assetId} not found`);
        }
        await this.assetRepo.softDelete(assetId);
        return { deleted: true };
    }
    async getBulkUploadUrls(body) {
        const results = await this.storageService.generateBulkUploadUrls(body.files, body.listingId);
        const assets = results.map((r) => this.assetRepo.create({
            id: r.assetId,
            listingId: body.listingId ?? null,
            s3Bucket: this.storageService.getBucket(),
            s3Key: r.s3Key,
            mimeType: body.files.find((f) => r.s3Key.includes(f.filename.split('.')[0]))
                ?.mimeType ?? 'image/webp',
            fileSizeBytes: 0,
        }));
        await this.assetRepo.save(assets);
        return { uploads: results };
    }
    async backfillVariants(batchSizeParam) {
        const batchSize = Math.min(Math.max(parseInt(batchSizeParam ?? '50', 10) || 50, 1), 500);
        const candidates = await this.assetRepo
            .createQueryBuilder('a')
            .where('a.deleted_at IS NULL')
            .andWhere('a.s3_key IS NOT NULL')
            .andWhere('a.s3_key_medium IS NULL')
            .andWhere('a.s3_key NOT LIKE :temp', { temp: '%temp/%' })
            .orderBy('a.uploaded_at', 'DESC')
            .limit(batchSize)
            .getMany();
        if (candidates.length === 0) {
            return {
                queued: 0,
                remaining: 0,
                message: 'All images already have responsive variants',
            };
        }
        let queued = 0;
        for (const asset of candidates) {
            try {
                await this.thumbnailQueue.add('generate', { assetId: asset.id, s3Key: asset.s3Key }, {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 5000 },
                    jobId: `backfill-${asset.id}`,
                });
                queued++;
            }
            catch (err) {
                this.logger.warn(`Failed to queue backfill for asset ${asset.id}: ${err instanceof Error ? err.message : err}`);
            }
        }
        const remaining = await this.assetRepo
            .createQueryBuilder('a')
            .where('a.deleted_at IS NULL')
            .andWhere('a.s3_key IS NOT NULL')
            .andWhere('a.s3_key_medium IS NULL')
            .andWhere('a.s3_key NOT LIKE :temp', { temp: '%temp/%' })
            .getCount();
        this.logger.log(`Backfill: queued ${queued} images for reprocessing, ${remaining} remaining`);
        return {
            queued,
            remaining,
            message: remaining > 0
                ? `${remaining} images still need processing. Call again to continue.`
                : 'All images queued for processing',
        };
    }
    async backfillCatalogVariants(batchSizeParam) {
        const batchSize = Math.min(Math.max(parseInt(batchSizeParam ?? '50', 10) || 50, 1), 500);
        const candidates = await this.catalogProductRepo
            .createQueryBuilder('p')
            .where('p.images_variants_generated_at IS NULL')
            .andWhere('p.image_urls IS NOT NULL')
            .andWhere('array_length(p.image_urls, 1) > 0')
            .orderBy('p.createdAt', 'DESC')
            .limit(batchSize)
            .getMany();
        if (candidates.length === 0) {
            return {
                productsQueued: 0,
                imagesQueued: 0,
                remaining: 0,
                message: 'All catalog products already have responsive variants',
            };
        }
        let imagesQueued = 0;
        let productsQueued = 0;
        for (const product of candidates) {
            try {
                for (const url of product.imageUrls ?? []) {
                    const key = this.storageService.keyFromUrl(url);
                    if (!key)
                        continue;
                    await this.storageService.queueVariantGeneration(key);
                    imagesQueued++;
                }
                await this.catalogProductRepo.update(product.id, {
                    imagesVariantsGeneratedAt: new Date(),
                });
                productsQueued++;
            }
            catch (err) {
                this.logger.warn(`Failed to queue variant backfill for catalog product ${product.id}: ${err instanceof Error ? err.message : err}`);
            }
        }
        const remaining = await this.catalogProductRepo
            .createQueryBuilder('p')
            .where('p.images_variants_generated_at IS NULL')
            .andWhere('p.image_urls IS NOT NULL')
            .andWhere('array_length(p.image_urls, 1) > 0')
            .getCount();
        this.logger.log(`Catalog variant backfill: ${productsQueued} products / ${imagesQueued} images queued, ${remaining} products remaining`);
        return {
            productsQueued,
            imagesQueued,
            remaining,
            message: remaining > 0
                ? `${remaining} catalog products still need processing. Call again to continue.`
                : 'All catalog products queued for processing',
        };
    }
    async serve(req, res) {
        const fullPath = req.url.split('?')[0];
        const prefix = '/api/storage/serve/';
        const idx = fullPath.indexOf(prefix);
        const s3Key = idx >= 0
            ? fullPath.substring(idx + prefix.length)
            : String(req.params['key'] ?? '')
                .replace(/,/g, '/')
                .replace(/^\//, '');
        if (!s3Key) {
            throw new common_1.NotFoundException('Missing S3 key');
        }
        const preferredKey = this.preferredWebpKey(s3Key);
        if (preferredKey !== s3Key &&
            (await this.storageService.objectExists(preferredKey))) {
            this.redirectToKey(preferredKey, res);
            return;
        }
        try {
            await this.streamObject(s3Key, res);
            return;
        }
        catch (err) {
            const code = err?.$metadata?.httpStatusCode;
            const isMissing = code === 404 || err?.name === 'NoSuchKey';
            if (!isMissing) {
                this.logger.warn(`S3 serve failed for key=${s3Key}: ${err?.message}`);
                throw new common_1.NotFoundException(`Image not found: ${s3Key}`);
            }
        }
        for (const fallbackKey of this.webpFallbackKeys(s3Key)) {
            if (await this.storageService.objectExists(fallbackKey)) {
                this.redirectToKey(fallbackKey, res);
                return;
            }
        }
        const generated = await this.ensureVariant(s3Key);
        if (generated) {
            try {
                await this.streamObject(s3Key, res);
                return;
            }
            catch (err) {
                this.logger.warn(`S3 serve retry failed after on-demand gen for key=${s3Key}: ${err?.message}`);
            }
        }
        throw new common_1.NotFoundException(`Image not found: ${s3Key}`);
    }
    async serveNapaImage(imageId, requestedPreset, res) {
        if (!/^\d{1,16}$/.test(imageId)) {
            throw new common_1.NotFoundException('NAPA image not found');
        }
        const allowedPresets = new Set([
            'webproof',
            'webprooflarge',
            'webproofxlarge',
        ]);
        const preset = requestedPreset && allowedPresets.has(requestedPreset)
            ? requestedPreset
            : 'webprooflarge';
        const imageUrl = new URL(`https://media.napaonline.com/is/image/GenuinePartsCompany/${imageId}/`);
        imageUrl.searchParams.set('format', 'webp');
        imageUrl.searchParams.set('preset', preset);
        try {
            const upstream = await fetch(imageUrl, {
                redirect: 'error',
                signal: AbortSignal.timeout(15_000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; OmniCore-image-proxy/1.0)',
                    Accept: 'image/webp,image/*;q=0.8',
                },
            });
            if (!upstream.ok) {
                throw new common_1.NotFoundException('NAPA image unavailable');
            }
            const contentType = (upstream.headers.get('content-type') ?? '')
                .split(';', 1)[0]
                .trim()
                .toLowerCase();
            if (!['image/webp', 'image/jpeg', 'image/png'].includes(contentType)) {
                throw new common_1.NotFoundException('NAPA image unavailable');
            }
            const contentLength = Number(upstream.headers.get('content-length') ?? 0);
            if (contentLength > 8 * 1024 * 1024) {
                throw new common_1.NotFoundException('NAPA image is too large');
            }
            const image = Buffer.from(await upstream.arrayBuffer());
            if (image.length === 0 || image.length > 8 * 1024 * 1024) {
                throw new common_1.NotFoundException('NAPA image unavailable');
            }
            res.set({
                'Content-Type': contentType,
                'Content-Length': String(image.length),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
                'X-Content-Type-Options': 'nosniff',
            });
            return res.status(common_1.HttpStatus.OK).send(image);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.warn(`NAPA image fetch failed for id=${imageId}`);
            throw new common_1.NotFoundException('NAPA image unavailable');
        }
    }
    preferredWebpKey(s3Key) {
        if (StorageController_1.VARIANT_RE.test(s3Key) ||
            /\.webp$/i.test(s3Key) ||
            !/\.(?:jpe?g|png|gif|bmp|heic|avif)$/i.test(s3Key)) {
            return s3Key;
        }
        return s3Key.replace(/\.[^./]+$/i, '.webp');
    }
    webpFallbackKeys(s3Key) {
        if (!/\.webp$/i.test(s3Key) || StorageController_1.VARIANT_RE.test(s3Key)) {
            return [];
        }
        const base = s3Key.slice(0, -'.webp'.length);
        return StorageController_1.WEBP_FALLBACK_EXTS.map((ext) => base + ext);
    }
    redirectToKey(s3Key, res) {
        const encodedKey = s3Key
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
        res.redirect(common_1.HttpStatus.TEMPORARY_REDIRECT, `/api/storage/serve/${encodedKey}`);
    }
    async streamObject(s3Key, res) {
        const { stream, contentType, contentLength, etag } = await this.storageService.getObjectStream(s3Key);
        res.set({
            'Content-Type': contentType,
            ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
            ...(etag ? { ETag: etag } : {}),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
        });
        const body = stream;
        if (typeof body?.pipe === 'function') {
            body.pipe(res);
        }
        else {
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            res.send(Buffer.concat(chunks));
        }
    }
    async ensureVariant(variantKey) {
        const m = variantKey.match(StorageController_1.VARIANT_RE);
        if (!m)
            return false;
        const base = variantKey.slice(0, -m[0].length);
        const existing = this.variantGenInflight.get(base);
        if (existing)
            return existing;
        const p = this.doEnsureVariant(base);
        this.variantGenInflight.set(base, p);
        try {
            return await p;
        }
        finally {
            this.variantGenInflight.delete(base);
        }
    }
    async doEnsureVariant(base) {
        let originalKey = null;
        for (const ext of StorageController_1.ORIGINAL_EXTS) {
            try {
                if (await this.storageService.objectExists(base + ext)) {
                    originalKey = base + ext;
                    break;
                }
            }
            catch {
            }
        }
        if (!originalKey)
            return false;
        if (this.activeVariantGen >= StorageController_1.MAX_VARIANT_GEN) {
            return false;
        }
        this.activeVariantGen++;
        try {
            await this.imageProcessor.processImage(originalKey);
            this.logger.log(`On-demand variants generated for ${originalKey}`);
            return true;
        }
        catch (err) {
            this.logger.warn(`On-demand variant generation failed for ${originalKey}: ${err instanceof Error ? err.message : err}`);
            return false;
        }
        finally {
            this.activeVariantGen--;
        }
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Post)('upload-url'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.upload'),
    (0, swagger_1.ApiOperation)({ summary: 'Get pre-signed S3 upload URL' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_upload_dto_js_1.RequestUploadDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getUploadUrl", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm upload and trigger thumbnail processing' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "confirmUpload", null);
__decorate([
    (0, common_1.Get)('listing/:listingId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all images for a listing' }),
    __param(0, (0, common_1.Param)('listingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getListingImages", null);
__decorate([
    (0, common_1.Patch)(':assetId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Update image sort order or primary flag' }),
    __param(0, (0, common_1.Param)('assetId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, image_transform_dto_js_1.UpdateAssetDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "updateAsset", null);
__decorate([
    (0, common_1.Delete)(':assetId'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.manage'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete an image' }),
    __param(0, (0, common_1.Param)('assetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "deleteAsset", null);
__decorate([
    (0, common_1.Post)('bulk-upload-urls'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.upload'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate multiple pre-signed upload URLs' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_upload_dto_js_1.BulkRequestUploadDto]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getBulkUploadUrls", null);
__decorate([
    (0, common_1.Post)('backfill-variants'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Backfill responsive variants for existing images',
    }),
    __param(0, (0, common_1.Query)('batchSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "backfillVariants", null);
__decorate([
    (0, common_1.Post)('backfill-catalog-variants'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.manage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Backfill responsive variants for catalog-imported images',
    }),
    __param(0, (0, common_1.Query)('batchSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "backfillCatalogVariants", null);
__decorate([
    (0, common_1.Get)('serve/*key'),
    (0, public_decorator_js_1.Public)(),
    (0, throttler_1.SkipThrottle)({ short: true, medium: true, long: true }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "serve", null);
__decorate([
    (0, common_1.Get)('napa-image/:imageId'),
    (0, public_decorator_js_1.Public)(),
    (0, throttler_1.SkipThrottle)({ short: true, medium: true, long: true }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('imageId')),
    __param(1, (0, common_1.Query)('preset')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "serveNapaImage", null);
exports.StorageController = StorageController = StorageController_1 = __decorate([
    (0, swagger_1.ApiTags)('Storage'),
    (0, common_1.Controller)('storage'),
    (0, require_permissions_decorator_js_1.RequirePermissions)('storage.view'),
    __param(2, (0, typeorm_1.InjectRepository)(image_asset_entity_js_1.ImageAsset)),
    __param(3, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(4, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(5, (0, bullmq_1.InjectQueue)('storage-thumbnails')),
    __metadata("design:paramtypes", [storage_service_js_1.StorageService,
        image_processor_service_js_1.ImageProcessorService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository, Function])
], StorageController);
//# sourceMappingURL=storage.controller.js.map
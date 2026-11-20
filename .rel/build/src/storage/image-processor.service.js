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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ImageProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessorService = void 0;
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const storage_service_js_1 = require("./storage.service.js");
const VARIANTS = [
    { suffix: '_thumb', width: 200, height: 200, fit: 'cover', quality: 75 },
    { suffix: '_sm', width: 320, height: 320, fit: 'inside', quality: 78 },
    { suffix: '_medium', width: 800, height: 800, fit: 'inside', quality: 80 },
    { suffix: '_lg', width: 1200, height: 1200, fit: 'inside', quality: 82 },
];
const MAX_ORIGINAL_DIMENSION = 2048;
const MAX_PIXEL_COUNT = 4096 * 4096;
sharp_1.default.concurrency(Math.max(1, Number(process.env.SHARP_CONCURRENCY ?? '1') || 1));
sharp_1.default.cache({
    memory: Math.max(8, Number(process.env.SHARP_CACHE_MB ?? '32') || 32),
    files: 0,
    items: 50,
});
let ImageProcessorService = ImageProcessorService_1 = class ImageProcessorService {
    storage;
    logger = new common_1.Logger(ImageProcessorService_1.name);
    constructor(storage) {
        this.storage = storage;
    }
    async convertBufferToWebp(buffer, options = {}) {
        const validation = this.validateMagicBytes(buffer);
        if (!validation.valid)
            throw new Error('Invalid image data');
        const maxPixelCount = options.maxPixelCount ?? MAX_PIXEL_COUNT;
        if (!Number.isSafeInteger(maxPixelCount) || maxPixelCount <= 0)
            throw new Error('Invalid maximum image pixel count');
        const metadata = await (0, sharp_1.default)(buffer).metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        if (width * height > maxPixelCount)
            throw new Error('Image exceeds the maximum pixel count');
        const converted = await (0, sharp_1.default)(buffer)
            .rotate()
            .resize(MAX_ORIGINAL_DIMENSION, MAX_ORIGINAL_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .webp({ quality: 85 })
            .toBuffer();
        return { buffer: converted, width: width || null, height: height || null };
    }
    async processImage(s3Key) {
        this.logger.log(`Processing image: ${s3Key}`);
        const buffer = await this.storage.getObjectBuffer(s3Key);
        const validation = this.validateMagicBytes(buffer);
        if (!validation.valid) {
            this.logger.warn(`Rejected ${s3Key}: failed magic byte validation (not a valid image)`);
            return {
                thumbnailKey: null,
                mediumKey: null,
                smallKey: null,
                largeKey: null,
                width: null,
                height: null,
                blurhash: null,
                dominantColor: null,
            };
        }
        const metadata = await (0, sharp_1.default)(buffer).metadata();
        const originalWidth = metadata.width ?? 0;
        const originalHeight = metadata.height ?? 0;
        if (originalWidth * originalHeight > MAX_PIXEL_COUNT) {
            this.logger.warn(`Image ${s3Key} exceeds max pixel count (${originalWidth}x${originalHeight}) — skipping variants`);
            return {
                thumbnailKey: null,
                mediumKey: null,
                smallKey: null,
                largeKey: null,
                width: originalWidth || null,
                height: originalHeight || null,
                blurhash: null,
                dominantColor: null,
            };
        }
        const orientedBuffer = metadata.orientation && metadata.orientation > 1
            ? await (0, sharp_1.default)(buffer).rotate().toBuffer()
            : buffer;
        const needsResize = originalWidth > MAX_ORIGINAL_DIMENSION ||
            originalHeight > MAX_ORIGINAL_DIMENSION;
        if (!/\.webp$/i.test(s3Key)) {
            const webpPipeline = (0, sharp_1.default)(orientedBuffer);
            if (needsResize) {
                webpPipeline.resize(MAX_ORIGINAL_DIMENSION, MAX_ORIGINAL_DIMENSION, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }
            const webpBuffer = await webpPipeline.webp({ quality: 85 }).toBuffer();
            const webpKey = s3Key.replace(/\.\w+$/, '.webp');
            await this.storage.putObject(webpKey, webpBuffer, 'image/webp');
            this.logger.debug(`Generated canonical WebP → ${webpKey}`);
        }
        const results = {};
        for (const variant of VARIANTS) {
            try {
                const processed = await (0, sharp_1.default)(orientedBuffer)
                    .resize(variant.width, variant.height, {
                    fit: variant.fit,
                    withoutEnlargement: true,
                })
                    .webp({ quality: variant.quality })
                    .toBuffer();
                const variantKey = s3Key.replace(/\.\w+$/, `${variant.suffix}.webp`);
                await this.storage.putObject(variantKey, processed, 'image/webp');
                results[variant.suffix] = variantKey;
                this.logger.debug(`Generated variant ${variant.suffix}: ${variantKey} (${processed.length} bytes)`);
            }
            catch (err) {
                this.logger.error(`Failed to generate variant ${variant.suffix} for ${s3Key}`, err);
                results[variant.suffix] = null;
            }
        }
        let dominantColor = null;
        try {
            const { data } = await (0, sharp_1.default)(orientedBuffer)
                .resize(6, 6, { fit: 'cover' })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            let r = 0, g = 0, b = 0;
            const pixels = data.length / 3;
            for (let i = 0; i < data.length; i += 3) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
            }
            const rr = Math.round(r / pixels);
            const gg = Math.round(g / pixels);
            const bb = Math.round(b / pixels);
            dominantColor = `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
        }
        catch {
            this.logger.warn(`Dominant color extraction failed for ${s3Key}`);
        }
        let blurhash = null;
        try {
            const tiny = await (0, sharp_1.default)(orientedBuffer)
                .resize(32, 32, { fit: 'inside' })
                .webp({ quality: 20 })
                .toBuffer();
            blurhash = `data:image/webp;base64,${tiny.toString('base64')}`;
        }
        catch {
            this.logger.warn(`Blurhash generation failed for ${s3Key}`);
        }
        return {
            thumbnailKey: results['_thumb'] ?? null,
            mediumKey: results['_medium'] ?? null,
            smallKey: results['_sm'] ?? null,
            largeKey: results['_lg'] ?? null,
            width: originalWidth || null,
            height: originalHeight || null,
            blurhash,
            dominantColor,
        };
    }
    validateMagicBytes(buffer) {
        if (buffer.length < 4)
            return { valid: false, type: null };
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
            return { valid: true, type: 'image/jpeg' };
        }
        if (buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47) {
            return { valid: true, type: 'image/png' };
        }
        if (buffer[0] === 0x52 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x46 &&
            buffer.length >= 12 &&
            buffer[8] === 0x57 &&
            buffer[9] === 0x45 &&
            buffer[10] === 0x42 &&
            buffer[11] === 0x50) {
            return { valid: true, type: 'image/webp' };
        }
        if (buffer.length >= 12 &&
            buffer[4] === 0x66 &&
            buffer[5] === 0x74 &&
            buffer[6] === 0x79 &&
            buffer[7] === 0x70) {
            const brand = buffer.slice(8, 12).toString('ascii');
            if (brand.startsWith('avif'))
                return { valid: true, type: 'image/avif' };
            return { valid: true, type: 'image/heic' };
        }
        if (buffer[0] === 0x47 &&
            buffer[1] === 0x49 &&
            buffer[2] === 0x46 &&
            buffer[3] === 0x38) {
            return { valid: true, type: 'image/gif' };
        }
        if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
            return { valid: true, type: 'image/bmp' };
        }
        return { valid: false, type: null };
    }
};
exports.ImageProcessorService = ImageProcessorService;
exports.ImageProcessorService = ImageProcessorService = ImageProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_service_js_1.StorageService])
], ImageProcessorService);
//# sourceMappingURL=image-processor.service.js.map
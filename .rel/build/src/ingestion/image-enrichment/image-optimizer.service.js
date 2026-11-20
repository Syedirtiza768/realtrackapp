"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ImageOptimizerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageOptimizerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sharp_1 = __importDefault(require("sharp"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const axios_1 = __importDefault(require("axios"));
const pipeline_paths_util_js_1 = require("../utils/pipeline-paths.util.js");
let ImageOptimizerService = ImageOptimizerService_1 = class ImageOptimizerService {
    config;
    logger = new common_1.Logger(ImageOptimizerService_1.name);
    storageDir;
    maxDownloadBytes;
    constructor(config) {
        this.config = config;
        const root = (0, pipeline_paths_util_js_1.resolvePipelineProjectRoot)();
        this.storageDir = path.resolve(root, 'uploads', 'enriched-images');
        this.maxDownloadBytes = 50 * 1024 * 1024;
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }
    async downloadAndOptimize(url, options = {}) {
        const targetFormat = options.targetFormat ?? 'webp';
        const maxWidth = options.maxWidth ?? 1600;
        const quality = options.quality ?? 82;
        try {
            const buffer = await this.downloadImage(url);
            if (!buffer)
                return null;
            const metadata = await (0, sharp_1.default)(buffer).metadata();
            if (!metadata.width || !metadata.height) {
                this.logger.debug(`No dimensions detected for ${url}`);
                return null;
            }
            if (metadata.width < 300 || metadata.height < 300) {
                this.logger.debug(`Image too small (${metadata.width}x${metadata.height}): ${url}`);
                return null;
            }
            const hash = await this.computePerceptualHash(buffer);
            let pipeline = (0, sharp_1.default)(buffer);
            if (metadata.width > maxWidth) {
                pipeline = pipeline.resize(maxWidth, null, {
                    withoutEnlargement: true,
                });
            }
            let outputBuffer;
            if (targetFormat === 'webp') {
                outputBuffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
            }
            else {
                outputBuffer = await pipeline
                    .jpeg({ quality, mozjpeg: true })
                    .toBuffer();
            }
            const finalMeta = await (0, sharp_1.default)(outputBuffer).metadata();
            const finalWidth = finalMeta.width ?? metadata.width;
            const finalHeight = finalMeta.height ?? metadata.height;
            const filename = `${hash}.${targetFormat}`;
            const localPath = path.join(this.storageDir, filename);
            if (!fs.existsSync(localPath)) {
                fs.writeFileSync(localPath, outputBuffer);
            }
            return {
                localPath,
                originalUrl: url,
                width: finalWidth,
                height: finalHeight,
                format: targetFormat,
                fileSizeBytes: outputBuffer.length,
                hash,
                aspectRatio: Math.round((finalWidth / finalHeight) * 100) / 100,
            };
        }
        catch (err) {
            this.logger.debug(`Failed to optimize image from ${url}: ${err}`);
            return null;
        }
    }
    async detectWatermark(imageBuffer) {
        try {
            const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
            if (!metadata.width || !metadata.height) {
                return { hasWatermark: false, confidence: 0 };
            }
            const w = metadata.width;
            const h = metadata.height;
            const cropHeight = Math.max(30, Math.round(h * 0.15));
            const bottomStrip = await (0, sharp_1.default)(imageBuffer)
                .extract({ left: 0, top: h - cropHeight, width: w, height: cropHeight })
                .greyscale()
                .raw()
                .toBuffer();
            const pixels = new Uint8Array(bottomStrip);
            let sum = 0;
            let sumSq = 0;
            for (let i = 0; i < pixels.length; i++) {
                sum += pixels[i];
                sumSq += pixels[i] * pixels[i];
            }
            const mean = sum / pixels.length;
            const variance = sumSq / pixels.length - mean * mean;
            const hasWatermark = variance > 3500 && mean > 180;
            const confidence = hasWatermark ? Math.min(0.7, variance / 10000) : 0;
            return { hasWatermark, confidence };
        }
        catch {
            return { hasWatermark: false, confidence: 0 };
        }
    }
    async computePerceptualHash(imageBuffer) {
        try {
            const thumbBuffer = await (0, sharp_1.default)(imageBuffer)
                .resize(16, 16, { fit: 'fill' })
                .greyscale()
                .raw()
                .toBuffer();
            const pixels = new Uint8Array(thumbBuffer);
            let sum = 0;
            for (let i = 0; i < pixels.length; i++)
                sum += pixels[i];
            const mean = sum / pixels.length;
            let bits = '';
            for (let i = 0; i < pixels.length; i++) {
                bits += pixels[i] > mean ? '1' : '0';
            }
            return crypto.createHash('md5').update(bits).digest('hex');
        }
        catch {
            return crypto.createHash('md5').update(imageBuffer).digest('hex');
        }
    }
    async validateForEbay(imageBuffer) {
        const issues = [];
        try {
            const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
            const width = metadata.width ?? 0;
            const height = metadata.height ?? 0;
            const aspectRatio = height > 0 ? Math.round((width / height) * 100) / 100 : 0;
            if (width < 500 || height < 500) {
                issues.push(`Image too small: ${width}x${height} (min 500x500)`);
            }
            if (aspectRatio < 0.5 || aspectRatio > 2.0) {
                issues.push(`Aspect ratio ${aspectRatio} outside recommended range (0.5-2.0)`);
            }
            return { valid: issues.length === 0, width, height, aspectRatio, issues };
        }
        catch {
            return {
                valid: false,
                width: 0,
                height: 0,
                aspectRatio: 0,
                issues: ['Unable to read image metadata'],
            };
        }
    }
    async downloadImage(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return null;
        }
        try {
            const response = await axios_1.default.get(url, {
                responseType: 'arraybuffer',
                timeout: 15_000,
                maxContentLength: this.maxDownloadBytes,
                headers: {
                    'User-Agent': 'ListingPro/1.0 Image Enrichment Bot',
                    Accept: 'image/*',
                },
                maxRedirects: 3,
            });
            const contentType = String(response.headers['content-type'] ?? '');
            if (!contentType.startsWith('image/')) {
                return null;
            }
            return Buffer.from(response.data);
        }
        catch (err) {
            if (err?.response?.status === 403 || err?.response?.status === 404) {
                return null;
            }
            this.logger.debug(`Image download failed for ${url}: ${err.message ?? err}`);
            return null;
        }
    }
};
exports.ImageOptimizerService = ImageOptimizerService;
exports.ImageOptimizerService = ImageOptimizerService = ImageOptimizerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ImageOptimizerService);
//# sourceMappingURL=image-optimizer.service.js.map
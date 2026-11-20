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
var FashionImagePipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionImagePipelineService = exports.IMAGE_VARIANTS = exports.EBAY_MAX_IMAGES = exports.EBAY_MASTER_MAX_LONGEST_SIDE = exports.LOW_QUALITY_LONGEST_SIDE = exports.EBAY_MIN_LONGEST_SIDE = void 0;
exports.dimensionFlags = dimensionFlags;
exports.orientedSize = orientedSize;
exports.ebayMasterUrls = ebayMasterUrls;
exports.renderVariants = renderVariants;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const sharp_1 = __importDefault(require("sharp"));
const storage_service_js_1 = require("../storage/storage.service.js");
exports.EBAY_MIN_LONGEST_SIDE = 500;
exports.LOW_QUALITY_LONGEST_SIDE = 1600;
exports.EBAY_MASTER_MAX_LONGEST_SIDE = 2000;
exports.EBAY_MAX_IMAGES = 24;
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_ATTEMPTS = 3;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
exports.IMAGE_VARIANTS = [
    { name: 'thumb', ext: 'webp', contentType: 'image/webp', longest: 200, quality: 75 },
    { name: 'small', ext: 'webp', contentType: 'image/webp', longest: 600, quality: 80 },
    { name: 'large', ext: 'webp', contentType: 'image/webp', longest: 1600, quality: 82 },
    {
        name: 'ebay_master',
        ext: 'jpg',
        contentType: 'image/jpeg',
        longest: exports.EBAY_MASTER_MAX_LONGEST_SIDE,
        quality: 90,
    },
];
function dimensionFlags(width, height) {
    const longest = Math.max(width, height);
    const flags = [];
    if (longest < exports.EBAY_MIN_LONGEST_SIDE)
        flags.push('below_min');
    if (longest < exports.LOW_QUALITY_LONGEST_SIDE)
        flags.push('low_quality');
    return flags;
}
function orientedSize(meta) {
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    return (meta.orientation ?? 1) >= 5 ? { width: h, height: w } : { width: w, height: h };
}
const EXT_BY_FORMAT = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    tiff: 'tif',
    heif: 'heic',
    avif: 'avif',
    bmp: 'bmp',
};
let FashionImagePipelineService = FashionImagePipelineService_1 = class FashionImagePipelineService {
    storage;
    logger = new common_1.Logger(FashionImagePipelineService_1.name);
    constructor(storage) {
        this.storage = storage;
    }
    async process(listingId, sourceUrls, previous = []) {
        const urls = sourceUrls
            .map((u) => u?.trim())
            .filter((u) => !!u && /^https?:\/\//i.test(u));
        const byHash = new Map();
        for (const p of previous)
            if (p.hash && !p.error)
                byHash.set(p.hash, p);
        const images = [];
        const seenHashes = new Set();
        for (const [index, sourceUrl] of urls.entries()) {
            const image = await this.processOne(listingId, index, sourceUrl, byHash);
            if (image.hash && seenHashes.has(image.hash)) {
                image.excluded = {
                    code: 'IMAGE_DUPLICATE',
                    reason: 'Same photo appears earlier in the listing',
                };
            }
            if (image.hash)
                seenHashes.add(image.hash);
            images.push(image);
        }
        let kept = 0;
        for (const image of images) {
            if (image.excluded || image.error)
                continue;
            if (kept >= exports.EBAY_MAX_IMAGES) {
                image.excluded = {
                    code: 'IMAGE_OVER_LIMIT',
                    reason: `eBay allows ${exports.EBAY_MAX_IMAGES} photos per listing`,
                };
                continue;
            }
            kept += 1;
        }
        return { images, masterUrls: ebayMasterUrls(images) };
    }
    async processOne(listingId, index, sourceUrl, previousByHash) {
        const image = {
            index,
            sourceUrl,
            hash: null,
            width: null,
            height: null,
            bytes: null,
            format: null,
            keys: {},
            urls: {},
            flags: [],
            excluded: null,
            error: null,
        };
        try {
            const buffer = await this.fetchImage(sourceUrl);
            image.bytes = buffer.length;
            image.hash = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
            const meta = await (0, sharp_1.default)(buffer, { failOn: 'none' }).metadata();
            if (!meta.format || !meta.width || !meta.height)
                throw new Error('File is not a readable image');
            image.format = meta.format;
            const { width, height } = orientedSize(meta);
            image.width = width;
            image.height = height;
            image.flags = dimensionFlags(width, height);
            const baseKey = this.storage.buildDurableKey(`catalog/${listingId}/${image.hash}`);
            const ext = EXT_BY_FORMAT[meta.format] ?? 'bin';
            image.keys.original = `${baseKey}/original.${ext}`;
            for (const v of exports.IMAGE_VARIANTS)
                image.keys[v.name] = `${baseKey}/${v.name}.${v.ext}`;
            const previous = previousByHash.get(image.hash);
            const alreadyStored = previous?.keys.ebay_master === image.keys.ebay_master &&
                (await this.storage.objectExists(image.keys.ebay_master));
            if (alreadyStored) {
                image.reused = true;
            }
            else {
                await this.storage.putObject(image.keys.original, buffer, `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`);
                const variants = await renderVariants(buffer);
                for (const v of exports.IMAGE_VARIANTS) {
                    await this.storage.putObject(image.keys[v.name], variants[v.name], v.contentType);
                }
            }
            for (const name of Object.keys(image.keys))
                image.urls[name] = this.storage.getCdnUrl(image.keys[name]);
            if (image.flags.includes('below_min')) {
                image.excluded = {
                    code: 'IMAGE_TOO_SMALL',
                    reason: `Longest side ${Math.max(width, height)}px is under eBay's ${exports.EBAY_MIN_LONGEST_SIDE}px minimum`,
                };
            }
        }
        catch (error) {
            image.error = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Image ${index} for ${listingId} failed: ${image.error} (${sourceUrl.slice(0, 120)})`);
        }
        return image;
    }
    async fetchImage(url) {
        const key = this.storage.keyFromUrl(url);
        if (key) {
            const buf = await this.storage.getObjectBuffer(key);
            if (!buf.length)
                throw new Error('Stored image is empty');
            return buf;
        }
        let lastError;
        for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
            try {
                const res = await fetch(url, {
                    redirect: 'follow',
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                    headers: { 'User-Agent': 'OmniCore-fashion-publish/1.0' },
                });
                if (!res.ok) {
                    const err = new Error(`HTTP ${res.status} fetching image`);
                    if (res.status < 500 && res.status !== 408 && res.status !== 429)
                        throw Object.assign(err, { permanent: true });
                    throw err;
                }
                const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
                if (type && !type.startsWith('image/') && type !== 'application/octet-stream')
                    throw Object.assign(new Error(`Not an image (content-type ${type})`), {
                        permanent: true,
                    });
                const length = Number(res.headers.get('content-length') ?? 0);
                if (length > MAX_SOURCE_BYTES)
                    throw Object.assign(new Error('Image is larger than 30 MB'), {
                        permanent: true,
                    });
                const buf = Buffer.from(await res.arrayBuffer());
                if (!buf.length)
                    throw new Error('Empty response');
                return buf;
            }
            catch (error) {
                lastError = error;
                if (error.permanent || attempt === FETCH_ATTEMPTS)
                    break;
                await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
};
exports.FashionImagePipelineService = FashionImagePipelineService;
exports.FashionImagePipelineService = FashionImagePipelineService = FashionImagePipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_service_js_1.StorageService])
], FashionImagePipelineService);
function ebayMasterUrls(images) {
    return images
        .filter((i) => !i.excluded && !i.error && i.urls.ebay_master)
        .slice(0, exports.EBAY_MAX_IMAGES)
        .map((i) => i.urls.ebay_master);
}
async function renderVariants(buffer) {
    const base = (0, sharp_1.default)(buffer, { failOn: 'none' }).rotate().toColourspace('srgb');
    const out = {};
    for (const v of exports.IMAGE_VARIANTS) {
        const pipeline = base.clone().resize(v.longest, v.longest, {
            fit: 'inside',
            withoutEnlargement: true,
        });
        out[v.name] =
            v.ext === 'jpg'
                ? await pipeline
                    .flatten({ background: '#ffffff' })
                    .jpeg({ quality: v.quality, chromaSubsampling: '4:4:4', mozjpeg: true })
                    .toBuffer()
                : await pipeline.webp({ quality: v.quality }).toBuffer();
    }
    return out;
}
//# sourceMappingURL=fashion-image-pipeline.service.js.map
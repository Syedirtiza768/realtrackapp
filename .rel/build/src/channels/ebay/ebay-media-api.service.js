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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayMediaApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayMediaApiService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = __importDefault(require("axios"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const form_data_1 = __importDefault(require("form-data"));
const typeorm_2 = require("typeorm");
const ebay_hosted_image_entity_js_1 = require("../../integrations/ebay/entities/ebay-hosted-image.entity.js");
const storage_service_js_1 = require("../../storage/storage.service.js");
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_listing_images_util_js_1 = require("./ebay-listing-images.util.js");
const IMAGE_CACHE_EXPIRY_BUFFER_MS = 60 * 60 * 1000;
const IMAGE_UPLOAD_CONCURRENCY = 3;
const IMAGE_UPLOAD_MAX_ATTEMPTS = 3;
const IMAGE_UPLOAD_RETRY_DELAYS_MS = [500, 1_500];
const NEW_CONDITION_IMAGE_FILES = ['F1.webp', 'F2.webp', 'F3.webp'];
const NEW_CONDITION_IMAGE_DIRECTORY = 'new-condition-listing-images';
let EbayMediaApiService = EbayMediaApiService_1 = class EbayMediaApiService {
    auth;
    hostedImageRepo;
    storage;
    logger = new common_1.Logger(EbayMediaApiService_1.name);
    newConditionImageUrlsPromise = null;
    constructor(auth, hostedImageRepo, storage) {
        this.auth = auth;
        this.hostedImageRepo = hostedImageRepo;
        this.storage = storage;
    }
    async hostImages(storeId, sourceUrls) {
        const sanitized = (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)(sourceUrls);
        if (sanitized.warnings.length) {
            this.logger.warn(`Image source normalization for store ${storeId}: ${sanitized.warnings.join('; ')}`);
        }
        const urls = [
            ...new Set(sanitized.imageUrls
                .map((url) => url?.trim())
                .filter((url) => Boolean(url))),
        ];
        const resolutions = await this.mapWithConcurrency(urls, IMAGE_UPLOAD_CONCURRENCY, async (sourceUrl) => {
            try {
                return {
                    sourceUrl,
                    hostedUrl: await this.hostImage(storeId, sourceUrl),
                };
            }
            catch (error) {
                return {
                    sourceUrl,
                    error: error instanceof Error ? error : new Error(String(error)),
                };
            }
        });
        const failures = resolutions.filter((resolution) => Boolean(resolution.error));
        const fatalFailure = failures.find((resolution) => !this.isRecoverableImageFailure(resolution.error));
        if (fatalFailure?.error)
            throw fatalFailure.error;
        const hosted = resolutions
            .filter((resolution) => typeof resolution.hostedUrl === 'string' &&
            resolution.hostedUrl.length > 0)
            .map(({ hostedUrl }) => hostedUrl);
        if (!hosted.length && failures.length) {
            throw failures[0].error;
        }
        if (failures.length) {
            this.logger.warn(`Skipped ${failures.length} recoverable listing image failure(s) after eBay Picture Services errors for store ${storeId}`);
        }
        this.logger.debug(`Resolved ${hosted.length} listing image(s) to eBay Picture Services for store ${storeId}`);
        return hosted;
    }
    async getNewConditionImageUrls(options) {
        if (options?.uploadIfMissing === false) {
            return this.buildNewConditionImageUrls(false);
        }
        if (!this.newConditionImageUrlsPromise) {
            this.newConditionImageUrlsPromise = this.ensureNewConditionImageUrls().catch((error) => {
                this.newConditionImageUrlsPromise = null;
                throw error;
            });
        }
        return [...(await this.newConditionImageUrlsPromise)];
    }
    async ensureNewConditionImageUrls() {
        return this.buildNewConditionImageUrls(true);
    }
    async buildNewConditionImageUrls(uploadIfMissing) {
        const urls = [];
        for (const fileName of NEW_CONDITION_IMAGE_FILES) {
            const buffer = await this.readBundledNewConditionImage(fileName);
            if (buffer.toString('ascii', 0, 4) !== 'RIFF' ||
                buffer.toString('ascii', 8, 12) !== 'WEBP') {
                throw new Error(`${fileName} is not a valid WebP image`);
            }
            const digest = (0, node_crypto_1.createHash)('sha256').update(buffer).digest('hex');
            const key = this.storage.buildDurableKey(`shared/${NEW_CONDITION_IMAGE_DIRECTORY}/${digest}-${fileName}`);
            if (uploadIfMissing &&
                !(await this.storage.objectExists(key))) {
                await this.storage.putObject(key, buffer, 'image/webp');
                this.logger.log(`Uploaded shared New-condition image ${fileName}`);
            }
            urls.push(this.storage.getCdnUrl(key));
        }
        return urls;
    }
    async readBundledNewConditionImage(fileName) {
        const candidates = [
            (0, node_path_1.join)(process.cwd(), 'assets', NEW_CONDITION_IMAGE_DIRECTORY, fileName),
            (0, node_path_1.join)(process.cwd(), 'backend', 'assets', NEW_CONDITION_IMAGE_DIRECTORY, fileName),
        ];
        for (const path of candidates) {
            try {
                return await (0, promises_1.readFile)(path);
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
        }
        throw new Error(`Bundled New-condition image ${fileName} was not found`);
    }
    async hostImage(storeId, sourceUrl) {
        if (this.isEbayHostedUrl(sourceUrl))
            return sourceUrl;
        const sourceKey = this.cacheKey(sourceUrl);
        const cached = await this.hostedImageRepo.findOne({
            where: { storeId, sourceUrl: sourceKey },
        });
        if (cached && this.cacheEntryIsUsable(cached)) {
            return cached.hostedUrl;
        }
        const token = await this.auth.getAccessToken(storeId);
        const apiBaseUrl = await this.auth.getApiBaseUrlForStore(storeId);
        const mediaBaseUrl = this.mediaApiBaseUrl(apiBaseUrl);
        let response;
        let lastError;
        for (let attempt = 1; attempt <= IMAGE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                const storageKey = this.storage.keyFromUrl(sourceUrl);
                if (storageKey) {
                    const imageBuffer = await this.storage.getObjectBuffer(storageKey);
                    const form = new form_data_1.default();
                    form.append('image', imageBuffer, {
                        filename: this.imageFileName(sourceUrl),
                        contentType: this.imageContentType(sourceUrl),
                    });
                    response = await axios_1.default.post(`${mediaBaseUrl}/commerce/media/v1_beta/image/create_image_from_file`, form, {
                        timeout: 30_000,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/json',
                            ...form.getHeaders(),
                        },
                    });
                }
                else {
                    response = await axios_1.default.post(`${mediaBaseUrl}/commerce/media/v1_beta/image/create_image_from_url`, { imageUrl: sourceUrl }, {
                        timeout: 30_000,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                        },
                    });
                }
                break;
            }
            catch (error) {
                lastError = error;
                if (attempt >= IMAGE_UPLOAD_MAX_ATTEMPTS ||
                    !this.isTransientMediaFailure(error)) {
                    throw this.formatUploadError(error);
                }
                await this.sleep(IMAGE_UPLOAD_RETRY_DELAYS_MS[attempt - 1] ?? 1_500);
            }
        }
        if (!response) {
            throw this.formatUploadError(lastError);
        }
        const hostedUrl = response.data.maxDimensionImageUrl?.trim() ||
            response.data.imageUrl?.trim();
        if (!hostedUrl) {
            throw new Error('eBay Picture Services returned no hosted image URL; the listing was not published');
        }
        const responseHeaders = response.headers;
        const locationValue = responseHeaders['location'] ?? responseHeaders['Location'];
        const imageId = typeof locationValue === 'string'
            ? locationValue.split('/').filter(Boolean).pop()
            : null;
        const expirationDate = response.data.expirationDate
            ? new Date(response.data.expirationDate)
            : null;
        await this.hostedImageRepo.upsert({
            storeId,
            sourceUrl: sourceKey,
            hostedUrl,
            imageId,
            expirationDate: expirationDate && Number.isFinite(expirationDate.getTime())
                ? expirationDate
                : null,
        }, ['storeId', 'sourceUrl']);
        return hostedUrl;
    }
    imageFileName(sourceUrl) {
        try {
            const pathname = new URL(sourceUrl).pathname;
            const filename = decodeURIComponent(pathname.split('/').pop() ?? '').trim();
            return filename || 'listing-image.jpg';
        }
        catch {
            return 'listing-image.jpg';
        }
    }
    imageContentType(sourceUrl) {
        const filename = this.imageFileName(sourceUrl).toLowerCase();
        if (filename.endsWith('.webp'))
            return 'image/webp';
        if (filename.endsWith('.png'))
            return 'image/png';
        if (filename.endsWith('.gif'))
            return 'image/gif';
        if (filename.endsWith('.bmp'))
            return 'image/bmp';
        if (filename.endsWith('.tif') || filename.endsWith('.tiff')) {
            return 'image/tiff';
        }
        if (filename.endsWith('.avif'))
            return 'image/avif';
        if (filename.endsWith('.heic'))
            return 'image/heic';
        return 'image/jpeg';
    }
    isTransientMediaFailure(error) {
        const status = axios_1.default.isAxiosError(error)
            ? error.response?.status
            : undefined;
        const code = axios_1.default.isAxiosError(error) ? error.code : undefined;
        const message = error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();
        return ([408, 425, 429, 500, 502, 503, 504].includes(status ?? 0) ||
            ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(code ?? '') ||
            /timeout|timed out|connection reset|socket hang up|upstream/.test(message));
    }
    isRecoverableImageFailure(error) {
        const message = error.message.toLowerCase();
        return (/no valid image can be downloaded/.test(message) ||
            /ebay picture services upload failed \((408|425|429|500|502|503|504)\)/i.test(message) ||
            /timeout|timed out|connection reset|socket hang up|upstream/.test(message));
    }
    formatUploadError(error) {
        const status = axios_1.default.isAxiosError(error)
            ? error.response?.status
            : undefined;
        const detail = axios_1.default.isAxiosError(error) && error.response?.data
            ? this.readApiError(error.response.data)
            : error instanceof Error
                ? error.message
                : String(error);
        return new Error(`eBay Picture Services upload failed${status ? ` (${status})` : ''}: ${detail}`);
    }
    async sleep(delayMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    cacheEntryIsUsable(entry) {
        if (!entry.hostedUrl?.trim())
            return false;
        if (!entry.expirationDate)
            return true;
        return (entry.expirationDate.getTime() > Date.now() + IMAGE_CACHE_EXPIRY_BUFFER_MS);
    }
    cacheKey(sourceUrl) {
        try {
            const parsed = new URL(sourceUrl);
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        }
        catch {
            return sourceUrl;
        }
    }
    isEbayHostedUrl(sourceUrl) {
        try {
            const hostname = new URL(sourceUrl).hostname.toLowerCase();
            return (hostname === 'ebayimg.com' ||
                hostname.endsWith('.ebayimg.com') ||
                hostname === 'ebaystatic.com' ||
                hostname.endsWith('.ebaystatic.com'));
        }
        catch {
            return false;
        }
    }
    mediaApiBaseUrl(apiBaseUrl) {
        const normalized = apiBaseUrl.replace(/\/+$/, '');
        return normalized.replace(/^https:\/\/api(?=\.|$)/i, 'https://apim');
    }
    readApiError(value) {
        if (typeof value === 'string')
            return value;
        if (!value || typeof value !== 'object')
            return 'unknown eBay error';
        const body = value;
        if (typeof body.message === 'string')
            return body.message;
        if (Array.isArray(body.errors)) {
            const messages = body.errors
                .map((error) => {
                if (typeof error === 'string')
                    return error;
                if (error && typeof error === 'object') {
                    const message = error.message;
                    return typeof message === 'string' ? message : null;
                }
                return null;
            })
                .filter((message) => Boolean(message));
            if (messages.length)
                return messages.join('; ');
        }
        return 'unknown eBay error';
    }
    async mapWithConcurrency(items, concurrency, worker) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const run = async () => {
            while (true) {
                const index = nextIndex++;
                if (index >= items.length)
                    return;
                results[index] = await worker(items[index]);
            }
        };
        await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => run()));
        return results;
    }
};
exports.EbayMediaApiService = EbayMediaApiService;
exports.EbayMediaApiService = EbayMediaApiService = EbayMediaApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_hosted_image_entity_js_1.EbayHostedImage)),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService,
        typeorm_2.Repository,
        storage_service_js_1.StorageService])
], EbayMediaApiService);
//# sourceMappingURL=ebay-media-api.service.js.map
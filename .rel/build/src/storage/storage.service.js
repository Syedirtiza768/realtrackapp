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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
let StorageService = StorageService_1 = class StorageService {
    config;
    thumbnailQueue;
    logger = new common_1.Logger(StorageService_1.name);
    s3;
    bucket;
    keyPrefix;
    cdnDomain;
    signedUrlExpiry;
    constructor(config, thumbnailQueue) {
        this.config = config;
        this.thumbnailQueue = thumbnailQueue;
        this.bucket =
            this.config.get('AWS_S3_BUCKET')?.trim() ||
                this.config.get('S3_BUCKET')?.trim() ||
                'realtrack-images';
        this.keyPrefix = this.normalizeKeyPrefix(this.config.get('AWS_S3_PREFIX') ||
            this.config.get('S3_PREFIX', ''));
        this.cdnDomain = this.config.get('AWS_CLOUDFRONT_DOMAIN', '');
        this.signedUrlExpiry = Number(this.config.get('S3_SIGNED_URL_EXPIRY', '300'));
        const region = this.config.get('AWS_S3_REGION')?.trim() ||
            this.config.get('S3_REGION')?.trim() ||
            'us-east-1';
        const accessKey = this.config.get('AWS_ACCESS_KEY_ID')?.trim();
        const secretKey = this.config.get('AWS_SECRET_ACCESS_KEY')?.trim();
        this.s3 = new client_s3_1.S3Client({
            region,
            ...(accessKey && secretKey
                ? {
                    credentials: {
                        accessKeyId: accessKey,
                        secretAccessKey: secretKey,
                    },
                }
                : {}),
        });
    }
    getBucket() {
        return this.bucket;
    }
    isTempKey(s3Key) {
        return this.relativeKey(s3Key).startsWith('temp/');
    }
    async generateUploadUrl(filename, mimeType, listingId) {
        const assetId = (0, crypto_1.randomUUID)();
        const ext = this.sanitizeExtension(filename);
        const pathPrefix = listingId ? `originals/${listingId}` : 'temp';
        const s3Key = this.withKeyPrefix(`${pathPrefix}/${assetId}${ext}`);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: s3Key,
            ContentType: mimeType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, {
            expiresIn: this.signedUrlExpiry,
        });
        this.logger.debug(`Generated upload URL for key=${s3Key}`);
        return { uploadUrl, s3Key, assetId };
    }
    async generateDownloadUrl(s3Key) {
        const key = s3Key.trim();
        if (!key)
            throw new Error('S3 object key is required');
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        const downloadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, {
            expiresIn: this.signedUrlExpiry,
        });
        this.logger.debug('Generated download URL for key=' + key);
        return downloadUrl;
    }
    async generateBulkUploadUrls(files, listingId) {
        return Promise.all(files.map((f) => this.generateUploadUrl(f.filename, f.mimeType, listingId)));
    }
    async getObjectBuffer(key) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        const response = await this.s3.send(command);
        const stream = response.Body;
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
    async getObjectStream(key) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        const response = await this.s3.send(command);
        return {
            stream: response.Body,
            contentType: response.ContentType ?? 'application/octet-stream',
            contentLength: response.ContentLength,
            etag: response.ETag,
        };
    }
    async putObject(key, body, contentType) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        });
        await this.s3.send(command);
        this.logger.debug(`Uploaded object key=${key} size=${body.length}`);
    }
    async objectExists(key) {
        try {
            await this.s3.send(new client_s3_1.HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return true;
        }
        catch {
            return false;
        }
    }
    async copyObject(sourceKey, destKey) {
        const command = new client_s3_1.CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${sourceKey}`,
            Key: destKey,
            CacheControl: 'public, max-age=31536000, immutable',
        });
        await this.s3.send(command);
        this.logger.debug(`Copied object ${sourceKey} → ${destKey}`);
    }
    async moveObject(sourceKey, destKey) {
        await this.copyObject(sourceKey, destKey);
        await this.deleteObject(sourceKey);
        this.logger.debug(`Moved object ${sourceKey} → ${destKey}`);
    }
    async deleteObject(key) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        });
        await this.s3.send(command);
        this.logger.debug(`Deleted object key=${key}`);
    }
    getCdnUrl(s3Key) {
        if (this.cdnDomain) {
            return `https://${this.cdnDomain}/${s3Key}`;
        }
        return `https://${this.bucket}.s3.amazonaws.com/${s3Key}`;
    }
    async getPreferredImageUrl(url) {
        const key = this.keyFromUrl(url);
        if (!key ||
            /\.webp$/i.test(key) ||
            !/\.(?:jpe?g|png|gif|bmp|heic|avif)$/i.test(key)) {
            return url;
        }
        const webpKey = key.replace(/\.[^./]+$/i, '.webp');
        return (await this.objectExists(webpKey)) ? this.getCdnUrl(webpKey) : url;
    }
    async mirrorRemoteImageUrls(urls, namespace, parallel = 1) {
        const mirrored = await this.mirrorRemoteImages(urls, namespace, parallel);
        return mirrored.map((m, i) => m.url || urls[i]?.trim() || '');
    }
    async mirrorRemoteImages(urls, namespace, parallel = 1) {
        const sanitizedNs = namespace
            .replace(/[^a-zA-Z0-9/_-]/g, '_')
            .replace(/\/+/g, '/');
        const out = new Array(urls.length);
        const conc = Math.max(1, Math.min(16, parallel));
        const skipExisting = !/^(0|false|no|off)$/i.test(String(this.config.get('PIPELINE_MIRROR_SKIP_EXISTING', 'true')).trim());
        const mirrorOne = async (i) => {
            const raw = urls[i];
            const u = raw?.trim();
            if (!u) {
                out[i] = { url: '', s3Key: null };
                return;
            }
            if (!/^https?:\/\//i.test(u)) {
                out[i] = { url: u, s3Key: null };
                return;
            }
            if (this.urlLooksLikeOurBucket(u)) {
                const existingKey = this.tryKeyFromOurUrl(u);
                if (existingKey && this.isTempKey(existingKey)) {
                    const candidates = [existingKey];
                    const webpVariant = existingKey.replace(/\.[a-z0-9]+$/i, '.webp');
                    if (webpVariant !== existingKey)
                        candidates.push(webpVariant);
                    for (const srcKey of candidates) {
                        try {
                            const buf = await this.getObjectBuffer(srcKey);
                            const ext = srcKey.slice(srcKey.lastIndexOf('.')).toLowerCase() || '.jpg';
                            const key = this.mirroredObjectKey(sanitizedNs, srcKey, ext);
                            await this.putObject(key, buf, this.mimeFromExt(ext));
                            out[i] = { url: this.getCdnUrl(key), s3Key: key };
                            return;
                        }
                        catch {
                        }
                    }
                    this.logger.warn(`mirrorRemoteImages: temp key ${existingKey} (and .webp variant) not found — referencing as-is`);
                }
                if (existingKey && !this.isTempKey(existingKey)) {
                    const exists = await this.objectExists(existingKey);
                    if (!exists) {
                        const webpKey = existingKey.replace(/\.[a-z0-9]+$/i, '.webp');
                        const webpExists = await this.objectExists(webpKey);
                        if (webpExists) {
                            out[i] = { url: this.getCdnUrl(webpKey), s3Key: webpKey };
                            return;
                        }
                        this.logger.warn(`mirrorRemoteImages: permanent key ${existingKey} not found in S3 — will attempt re-download`);
                    }
                    else {
                        out[i] = { url: u, s3Key: existingKey };
                        return;
                    }
                }
                else {
                    out[i] = { url: u, s3Key: existingKey };
                    return;
                }
            }
            if (skipExisting) {
                const candidateExts = [
                    ...new Set([
                        this.extFromUrlOrMime(u, ''),
                        '.webp',
                        '.jpg',
                        '.png',
                        '.jpeg',
                    ]),
                ];
                for (const ext of candidateExts) {
                    const key = this.mirroredObjectKey(sanitizedNs, u, ext);
                    if (await this.objectExists(key)) {
                        out[i] = { url: this.getCdnUrl(key), s3Key: key };
                        return;
                    }
                }
            }
            try {
                const res = await fetch(u, {
                    redirect: 'follow',
                    signal: AbortSignal.timeout(120_000),
                    headers: {
                        'User-Agent': 'OmniCore-catalog-import/1.0 (image mirror; by sku)',
                    },
                });
                if (!res.ok) {
                    this.logger.warn(`mirrorRemoteImages: HTTP ${res.status} for ${u.slice(0, 80)}`);
                    out[i] = { url: u, s3Key: null };
                    return;
                }
                const buf = Buffer.from(await res.arrayBuffer());
                const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ||
                    'application/octet-stream';
                const ext = this.extFromUrlOrMime(u, contentType);
                const key = this.mirroredObjectKey(sanitizedNs, u, ext);
                await this.putObject(key, buf, contentType);
                out[i] = { url: this.getCdnUrl(key), s3Key: key };
                await this.queueVariantGeneration(key);
            }
            catch (e) {
                this.logger.warn(`mirrorRemoteImages failed for ${u.slice(0, 96)}: ${e instanceof Error ? e.message : e}`);
                out[i] = { url: u, s3Key: null };
            }
        };
        for (let start = 0; start < urls.length; start += conc) {
            const slice = Array.from({ length: Math.min(conc, urls.length - start) }, (_, j) => start + j);
            await Promise.all(slice.map((idx) => mirrorOne(idx)));
        }
        return out.map((v, i) => {
            if (v)
                return v;
            const fallback = urls[i]?.trim() ?? '';
            return { url: fallback, s3Key: null };
        });
    }
    async queueVariantGeneration(s3Key) {
        try {
            await this.thumbnailQueue.add('generate-catalog-variants', { s3Key }, {
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                jobId: `catalog-variants-${s3Key}`,
            });
        }
        catch (err) {
            this.logger.warn(`Failed to queue variant generation for ${s3Key}: ${err instanceof Error ? err.message : err}`);
        }
    }
    async queueDriveVariantGeneration(assetId, s3Key) {
        try {
            await this.thumbnailQueue.add('generate-drive-variants', { assetId, s3Key }, {
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                jobId: `drive-variants-${assetId}`,
            });
        }
        catch (err) {
            this.logger.warn(`Failed to queue drive variant generation for ${s3Key}: ${err instanceof Error ? err.message : err}`);
        }
    }
    keyFromUrl(url) {
        return this.tryKeyFromOurUrl(url);
    }
    tryKeyFromOurUrl(url) {
        try {
            const parsed = new URL(url);
            const host = parsed.hostname.toLowerCase();
            if (this.cdnDomain && host === this.cdnDomain.toLowerCase()) {
                return parsed.pathname.replace(/^\//, '');
            }
            const bucketHost = `${this.bucket.toLowerCase()}.s3`;
            if (host.includes(bucketHost)) {
                return parsed.pathname.replace(/^\//, '');
            }
        }
        catch {
        }
        return null;
    }
    urlLooksLikeOurBucket(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            if (host.includes(`${this.bucket.toLowerCase()}.s3`))
                return true;
            if (this.cdnDomain && host === this.cdnDomain.toLowerCase())
                return true;
        }
        catch {
        }
        return false;
    }
    extFromUrlOrMime(url, mime) {
        try {
            const path = new URL(url).pathname;
            const m = path.match(/\.([a-zA-Z0-9]+)$/);
            if (m && m[1]) {
                const e = `.${m[1].toLowerCase()}`;
                if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic'].includes(e)) {
                    return e;
                }
            }
        }
        catch {
        }
        const mt = mime.toLowerCase();
        if (mt.includes('jpeg'))
            return '.jpg';
        if (mt.includes('png'))
            return '.png';
        if (mt.includes('webp'))
            return '.webp';
        if (mt.includes('gif'))
            return '.gif';
        if (mt.includes('heic'))
            return '.heic';
        return '.jpg';
    }
    async confirmUpload(tempKey, listingId, assetId) {
        const ext = tempKey.substring(tempKey.lastIndexOf('.'));
        const finalKey = this.withKeyPrefix(`originals/${listingId}/${assetId}${ext}`);
        const buffer = await this.getObjectBuffer(tempKey);
        const mimeType = this.mimeFromExt(ext);
        await this.putObject(finalKey, buffer, mimeType);
        await this.deleteObject(tempKey);
        this.logger.log(`Confirmed upload: ${tempKey} → ${finalKey}`);
        return finalKey;
    }
    normalizeKeyPrefix(raw) {
        const t = raw?.trim();
        if (!t)
            return '';
        let p = t.replace(/^\/+/, '');
        if (!p.endsWith('/'))
            p += '/';
        return p;
    }
    buildDurableKey(relativeKey) {
        return this.withKeyPrefix(relativeKey);
    }
    withKeyPrefix(relativeKey) {
        if (!this.keyPrefix)
            return relativeKey;
        return `${this.keyPrefix}${relativeKey}`;
    }
    buildDrivePrefix(folderName) {
        const sanitized = folderName
            .trim()
            .replace(/[^a-zA-Z0-9\-_ ./]/g, '')
            .replace(/\s+/g, ' ');
        return this.withKeyPrefix(`image-drive/${sanitized}/`);
    }
    mirroredObjectKey(namespace, sourceIdentity, ext) {
        const digest = (0, crypto_1.createHash)('sha256')
            .update(sourceIdentity.trim())
            .digest('hex')
            .slice(0, 20);
        const safeExt = ext.startsWith('.')
            ? ext.toLowerCase()
            : `.${ext.toLowerCase()}`;
        return this.withKeyPrefix(`catalog-images/${namespace}/${digest}${safeExt}`);
    }
    relativeKey(fullKey) {
        if (!this.keyPrefix)
            return fullKey;
        if (fullKey.startsWith(this.keyPrefix)) {
            return fullKey.slice(this.keyPrefix.length);
        }
        return fullKey;
    }
    sanitizeExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        if (lastDot < 0)
            return '.webp';
        const ext = filename.substring(lastDot).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
        return allowed.includes(ext) ? ext : '.webp';
    }
    mimeFromExt(ext) {
        const map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.heic': 'image/heic',
        };
        return map[ext] ?? 'image/webp';
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)('storage-thumbnails')),
    __metadata("design:paramtypes", [config_1.ConfigService, Function])
], StorageService);
//# sourceMappingURL=storage.service.js.map
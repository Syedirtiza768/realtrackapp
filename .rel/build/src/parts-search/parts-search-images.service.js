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
var PartsSearchImagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsSearchImagesService = void 0;
exports.upgradeEbayUrl = upgradeEbayUrl;
exports.isPrivateAddress = isPrivateAddress;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const archiver = __importStar(require("archiver"));
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
const node_stream_1 = require("node:stream");
const typeorm_1 = require("typeorm");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const parts_search_service_js_1 = require("./parts-search.service.js");
const PARTSBAZAR360_ORIGIN = 'https://partsbazar360.com';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_IMAGES = 30;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const EXT_BY_TYPE = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/heic': 'heic',
    'image/tiff': 'tif',
};
const VARIANT_RE = /_(thumb|sm|medium|lg)\.webp$/i;
function upgradeEbayUrl(url) {
    return url
        .replace('/thumbs/images/', '/images/')
        .replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1')
        .replace(/\/\$_\d+\.(jpg|jpeg|png|webp)/i, '/$_57.$1');
}
function isEbayHost(host) {
    return /(^|\.)ebayimg\.com$/i.test(host) || /(^|\.)ebaystatic\.com$/i.test(host);
}
function isPrivateAddress(address) {
    const version = (0, node_net_1.isIP)(address);
    if (version === 4) {
        const [a, b] = address.split('.').map(Number);
        return (a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19)) ||
            a >= 224);
    }
    if (version === 6) {
        const lower = address.toLowerCase();
        if (lower === '::' || lower === '::1')
            return true;
        if (lower.startsWith('::ffff:'))
            return isPrivateAddress(lower.slice(7));
        return /^(fc|fd|fe8|fe9|fea|feb)/.test(lower);
    }
    return true;
}
function safeName(value) {
    return (value
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'part');
}
let PartsSearchImagesService = PartsSearchImagesService_1 = class PartsSearchImagesService {
    partsSearch;
    storage;
    config;
    dataSource;
    userOrgs;
    logger = new common_1.Logger(PartsSearchImagesService_1.name);
    bucket;
    constructor(partsSearch, storage, config, dataSource, userOrgs) {
        this.partsSearch = partsSearch;
        this.storage = storage;
        this.config = config;
        this.dataSource = dataSource;
        this.userOrgs = userOrgs;
        this.bucket =
            this.config.get('AWS_S3_BUCKET')?.trim() || this.config.get('S3_BUCKET')?.trim() || 'realtrack-images';
    }
    resolve(raw) {
        const value = String(raw ?? '').trim();
        if (!value)
            return null;
        if (value.startsWith('/api/storage/serve/')) {
            return this.bucketSource(decodeURIComponent(value.slice('/api/storage/serve/'.length)));
        }
        let url;
        try {
            url = new URL(value.startsWith('/') ? `${PARTSBAZAR360_ORIGIN}${value}` : value.startsWith('//') ? `https:${value}` : value);
        }
        catch {
            return null;
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:')
            return null;
        const host = url.hostname.toLowerCase();
        const bucket = this.bucket.toLowerCase();
        if (host === `${bucket}.s3.amazonaws.com` || (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com'))) {
            return this.bucketSource(decodeURIComponent(url.pathname.replace(/^\/+/, '')));
        }
        if ((host === 's3.amazonaws.com' || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(host)) && url.pathname.startsWith(`/${this.bucket}/`)) {
            return this.bucketSource(decodeURIComponent(url.pathname.slice(this.bucket.length + 2)));
        }
        if (isEbayHost(host)) {
            const upgraded = upgradeEbayUrl(url.toString());
            return upgraded === url.toString() ? { kind: 'remote', url: upgraded } : { kind: 'remote', url: upgraded, fallbackUrl: url.toString() };
        }
        return { kind: 'remote', url: url.toString() };
    }
    bucketSource(key) {
        const clean = key.replace(/^\/+/, '').split('?')[0];
        if (!clean || clean.includes('..'))
            return null;
        if (!VARIANT_RE.test(clean))
            return { kind: 'bucket', key: clean, candidates: [clean] };
        const base = clean.replace(VARIANT_RE, '');
        return { kind: 'bucket', key: clean, candidates: ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `${base}.${ext}`).concat(clean) };
    }
    previewUrl(source) {
        return source.kind === 'bucket' ? `/api/storage/serve/${source.candidates[0]}` : source.url;
    }
    originOf(source) {
        if (source.kind === 'bucket')
            return 'omni-core-storage';
        const host = new URL(source.url).hostname;
        if (isEbayHost(host))
            return 'ebay';
        if (/partsbazar360\.com$/i.test(host))
            return 'partsbazar360';
        return 'web';
    }
    async partImageUrls(partId) {
        const part = (await this.partsSearch.part(partId));
        const urls = (Array.isArray(part.imageUrls) ? part.imageUrls : [])
            .map((url) => String(url ?? '').trim())
            .filter((url) => url && !/\.svg(\?|$)/i.test(url));
        const label = [part.brand, part.manufacturerPartNumber].filter(Boolean).join(' ') || part.title || partId;
        return { urls: [...new Set(urls)], label };
    }
    async listPartImages(partId) {
        const { urls, label } = await this.partImageUrls(partId);
        const images = [];
        urls.forEach((url, index) => {
            const source = this.resolve(url);
            if (!source)
                return;
            images.push({
                index,
                previewUrl: this.previewUrl(source),
                filename: `${safeName(label)}-${index + 1}`,
                origin: this.originOf(source),
            });
        });
        return { partId, label, images };
    }
    async downloadPartImage(partId, index, res) {
        const { urls, label } = await this.partImageUrls(partId);
        const raw = urls[index];
        if (raw === undefined)
            throw new common_1.NotFoundException('Image not found');
        const source = this.resolve(raw);
        if (!source)
            throw new common_1.NotFoundException('Image is not downloadable');
        const file = await this.fetchBest(source);
        this.send(res, file, `${safeName(label)}-${index + 1}`);
    }
    async downloadPartZip(partId, res) {
        const { urls, label } = await this.partImageUrls(partId);
        if (!urls.length)
            throw new common_1.NotFoundException('This part has no images');
        const name = safeName(label);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${name}-images.zip"`);
        res.setHeader('Cache-Control', 'private, no-store');
        const zip = archiver.default('zip', { store: true });
        zip.on('error', (error) => {
            this.logger.warn(`zip failed for ${partId}: ${error.message}`);
            res.destroy(error);
        });
        zip.pipe(res);
        const failed = [];
        for (const [index, raw] of urls.slice(0, MAX_ZIP_IMAGES).entries()) {
            const source = this.resolve(raw);
            try {
                if (!source)
                    throw new Error('unsupported URL');
                const file = await this.fetchBest(source);
                zip.append(file.body, { name: `${name}-${index + 1}.${file.ext}` });
            }
            catch (error) {
                failed.push(`${index + 1}: ${raw} (${error.message})`);
            }
        }
        if (failed.length)
            zip.append(`These images could not be downloaded:\n${failed.join('\n')}\n`, { name: 'MISSING.txt' });
        await zip.finalize();
    }
    async downloadOmniImage(inventoryItemId, user, res) {
        const orgIds = (await this.userOrgs.listForUser(user.id)).map((org) => org.organizationId);
        if (!orgIds.length)
            throw new common_1.NotFoundException('Image not found');
        const rows = await this.dataSource.query(`SELECT coalesce(ii.image_url, cp.image_urls[1]) AS image, coalesce(cp.mpn, ii.sku) AS label
         FROM inventory_items ii LEFT JOIN catalog_products cp ON cp.id = ii.catalog_product_id
        WHERE ii.id = $1 AND ii.organization_id = ANY($2::uuid[]) LIMIT 1`, [inventoryItemId, orgIds]);
        const raw = rows[0]?.image;
        const source = raw ? this.resolve(raw) : null;
        if (!source)
            throw new common_1.NotFoundException('Image not found');
        const file = await this.fetchBest(source);
        this.send(res, file, safeName(rows[0]?.label ?? 'omni-core-part'));
    }
    send(res, file, base) {
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Length', String(file.body.length));
        res.setHeader('Content-Disposition', `attachment; filename="${base}.${file.ext}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end(file.body);
    }
    async fetchBest(source) {
        if (source.kind === 'bucket') {
            let lastError;
            for (const key of source.candidates) {
                try {
                    const object = await this.storage.getObjectStream(key);
                    const body = await this.readLimited(object.stream);
                    return this.typed(body, object.contentType);
                }
                catch (error) {
                    lastError = error;
                }
            }
            this.logger.debug(`bucket image missing: ${source.key} (${lastError?.message})`);
            throw new common_1.NotFoundException('Image not found in storage');
        }
        try {
            return await this.fetchRemote(source.url);
        }
        catch (error) {
            if (source.fallbackUrl && error instanceof common_1.NotFoundException)
                return this.fetchRemote(source.fallbackUrl);
            throw error;
        }
    }
    async fetchRemote(start) {
        let url = start;
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
                throw new common_1.BadRequestException('Unsupported image URL');
            if (parsed.port && !['80', '443'].includes(parsed.port))
                throw new common_1.BadRequestException('Unsupported image port');
            await this.assertPublicHost(parsed.hostname);
            let response;
            try {
                response = await fetch(url, {
                    redirect: 'manual',
                    headers: { Accept: 'image/*', 'User-Agent': 'OmniCore-PartsSearch/1.0' },
                    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                });
            }
            catch (error) {
                throw new common_1.ServiceUnavailableException(`Image host did not answer: ${error.message}`);
            }
            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location)
                    throw new common_1.ServiceUnavailableException('Image host redirected without a location');
                url = new URL(location, url).toString();
                continue;
            }
            if (!response.ok) {
                if (response.status === 404 && url !== start)
                    throw new common_1.NotFoundException('Image not found');
                throw new common_1.NotFoundException(`Image host returned HTTP ${response.status}`);
            }
            const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
            if (!contentType.startsWith('image/'))
                throw new common_1.BadRequestException('The URL is not an image');
            const length = Number(response.headers.get('content-length') ?? 0);
            if (length > MAX_BYTES)
                throw new common_1.BadRequestException('Image is larger than 25 MB');
            if (!response.body)
                throw new common_1.NotFoundException('Image host returned an empty body');
            const body = await this.readLimited(node_stream_1.Readable.fromWeb(response.body));
            return this.typed(body, contentType);
        }
        throw new common_1.ServiceUnavailableException('Too many redirects');
    }
    async assertPublicHost(hostname) {
        const host = hostname.replace(/^\[|\]$/g, '');
        if (/^(localhost|.*\.local|.*\.internal)$/i.test(host))
            throw new common_1.BadRequestException('Image host is not public');
        const addresses = (0, node_net_1.isIP)(host) ? [{ address: host }] : await (0, promises_1.lookup)(host, { all: true, verbatim: true }).catch(() => []);
        if (!addresses.length)
            throw new common_1.NotFoundException('Image host not found');
        if (addresses.some(({ address }) => isPrivateAddress(address)))
            throw new common_1.BadRequestException('Image host is not public');
    }
    async readLimited(stream) {
        const chunks = [];
        let total = 0;
        for await (const chunk of stream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += buffer.length;
            if (total > MAX_BYTES) {
                stream.destroy();
                throw new common_1.BadRequestException('Image is larger than 25 MB');
            }
            chunks.push(buffer);
        }
        return Buffer.concat(chunks);
    }
    typed(body, contentType) {
        const type = contentType.split(';')[0].trim().toLowerCase();
        const ext = EXT_BY_TYPE[type] ?? (type.startsWith('image/') ? type.slice(6).replace(/[^a-z0-9]/g, '') || 'img' : 'img');
        return { body, contentType: type.startsWith('image/') ? type : 'application/octet-stream', ext };
    }
};
exports.PartsSearchImagesService = PartsSearchImagesService;
exports.PartsSearchImagesService = PartsSearchImagesService = PartsSearchImagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [parts_search_service_js_1.PartsSearchService,
        storage_service_js_1.StorageService,
        config_1.ConfigService,
        typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService])
], PartsSearchImagesService);
//# sourceMappingURL=parts-search-images.service.js.map
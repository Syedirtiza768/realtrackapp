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
var PartsBazar360Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartsBazar360Service = exports.PARTSBAZAR360_STATUS_JOB = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("@nestjs/typeorm");
const bullmq_2 = require("bullmq");
const sharp_1 = __importDefault(require("sharp"));
const typeorm_2 = require("typeorm");
const catalog_product_entity_js_1 = require("../../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const channel_connection_entity_js_1 = require("../entities/channel-connection.entity.js");
const listing_channel_instance_entity_js_1 = require("../entities/listing-channel-instance.entity.js");
const store_entity_js_1 = require("../entities/store.entity.js");
const storage_service_js_1 = require("../../storage/storage.service.js");
const token_encryption_service_js_1 = require("../token-encryption.service.js");
const partsbazar360_client_js_1 = require("./partsbazar360.client.js");
const partsbazar360_listing_mapper_js_1 = require("./partsbazar360-listing.mapper.js");
const partsbazar360_types_js_1 = require("./partsbazar360.types.js");
exports.PARTSBAZAR360_STATUS_JOB = 'partsbazar-status-check';
const MAX_STATUS_CHECKS = 6;
const OUTCOME_MESSAGES = {
    skipped_non_english_title: 'the title is not in English',
    skipped_inactive_or_zero_stock: 'the listing is inactive or has no stock',
    skipped_wrong_marketplace: 'the listing is not on the US Motors marketplace',
    skipped_ebay_mag: 'the listing uses eBay Mag images',
    skipped_excluded_brand: 'the brand is handled by another supplier feed',
    skipped_no_seller: 'no PartsBazar360 seller is mapped to this store',
    skipped_wrong_store: 'the listing belongs to a different store',
};
let PartsBazar360Service = PartsBazar360Service_1 = class PartsBazar360Service {
    client;
    config;
    encryption;
    storage;
    listingRepo;
    catalogRepo;
    connectionRepo;
    storeRepo;
    instanceRepo;
    channelsQueue;
    logger = new common_1.Logger(PartsBazar360Service_1.name);
    constructor(client, config, encryption, storage, listingRepo, catalogRepo, connectionRepo, storeRepo, instanceRepo, channelsQueue) {
        this.client = client;
        this.config = config;
        this.encryption = encryption;
        this.storage = storage;
        this.listingRepo = listingRepo;
        this.catalogRepo = catalogRepo;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
        this.instanceRepo = instanceRepo;
        this.channelsQueue = channelsQueue;
    }
    async getStatus() {
        const stores = await this.storeRepo.find({
            where: { channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL },
            order: { createdAt: 'ASC' },
        });
        return {
            configured: this.client.isConfigured(),
            apiUrl: this.client.baseUrl,
            stores: stores.map((store) => ({
                storeId: store.id,
                connectionId: store.connectionId,
                storeName: store.storeName,
                sellerStoreId: store.externalStoreId,
                status: store.status,
            })),
        };
    }
    async connect(userId, input) {
        if (!this.client.isConfigured()) {
            throw new common_1.BadRequestException('PARTSBAZAR360_API_KEY is not configured on this server');
        }
        const sellerStoreId = input.sellerStoreId.trim();
        let seller;
        try {
            seller = (await this.client.health(sellerStoreId)).seller;
        }
        catch (error) {
            throw new common_1.BadRequestException(`Could not verify PartsBazar360 seller: ${this.errorMessage(error)}`);
        }
        const existing = await this.storeRepo.findOne({
            where: { channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL, externalStoreId: sellerStoreId },
        });
        if (existing) {
            return {
                connectionId: existing.connectionId,
                storeId: existing.id,
                seller,
            };
        }
        const connection = await this.connectionRepo.save(this.connectionRepo.create({
            channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL,
            userId,
            accountName: input.accountName?.trim() || seller?.name || 'PartsBazar360',
            externalAccountId: sellerStoreId,
            encryptedTokens: this.encryption.encrypt(JSON.stringify({
                accessToken: 'server-managed',
                expiresAt: new Date('2100-01-01T00:00:00Z').toISOString(),
            })),
            tokenExpiresAt: null,
            status: 'active',
        }));
        const store = await this.storeRepo.save(this.storeRepo.create({
            connectionId: connection.id,
            channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL,
            storeName: input.storeName.trim(),
            storeUrl: 'https://partsbazar360.com',
            externalStoreId: sellerStoreId,
            isPrimary: true,
            config: { marketplaceId: 'EBAY_MOTORS_US', currency: 'USD' },
        }));
        this.logger.log(`Connected PartsBazar360 seller ${seller?.name ?? sellerStoreId} as store ${store.id}`);
        return { connectionId: connection.id, storeId: store.id, seller };
    }
    async testConnection(connectionId) {
        const target = await this.targetFor(connectionId);
        try {
            const { seller } = await this.client.health(target.sellerStoreId);
            return { ok: true, seller };
        }
        catch (error) {
            return { ok: false, error: this.errorMessage(error) };
        }
    }
    async publish(connectionId, listingId, overrides) {
        const target = await this.targetFor(connectionId);
        const listing = await this.listingRepo.findOneBy({ id: listingId });
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${listingId} not found`);
        const catalog = (await this.catalogRepo.findOne({ where: { id: listingId } })) ??
            (listing.customLabelSku
                ? await this.catalogRepo.findOne({
                    where: { sku: listing.customLabelSku },
                })
                : null);
        const instance = await this.instanceFor(target, listingId);
        const storedPhotos = (0, partsbazar360_listing_mapper_js_1.storedImageUrls)(listing, catalog);
        const imageUrls = await this.publicImageUrls(storedPhotos);
        if (storedPhotos.length > 0 && imageUrls.length === 0) {
            await this.refuseWithoutPhotos(instance, target.sellerStoreId, listingId, 'None of this listing’s photos could be fetched or found in storage, so there is nothing to publish');
        }
        const mapped = (0, partsbazar360_listing_mapper_js_1.buildPartsBazarPushItem)(listing, catalog, {
            marketplaceId: this.storeMarketplace(target.store),
            currency: this.storeCurrency(target.store),
            overrides,
            imageUrls,
        });
        if (!mapped.ok) {
            if (/image/i.test(mapped.reason)) {
                await this.refuseWithoutPhotos(instance, target.sellerStoreId, listingId, mapped.reason);
            }
            await this.fail(instance, mapped.reason);
            throw new bullmq_2.UnrecoverableError(mapped.reason);
        }
        instance.syncStatus = 'publishing';
        instance.lastError = null;
        instance.lastPushedVersion = listing.version;
        instance.channelSpecificData = {
            ...instance.channelSpecificData,
            warnings: mapped.warnings,
        };
        await this.instanceRepo.save(instance);
        let accepted;
        try {
            [accepted] = await this.client.push(target.sellerStoreId, [mapped.item]);
        }
        catch (error) {
            await this.fail(instance, this.errorMessage(error));
            throw this.isPermanent(error)
                ? new bullmq_2.UnrecoverableError(this.errorMessage(error))
                : error;
        }
        if (!accepted || accepted.status === 'rejected') {
            const reason = accepted?.reason ?? 'PartsBazar360 rejected the listing';
            await this.fail(instance, reason);
            throw new bullmq_2.UnrecoverableError(reason);
        }
        const remote = await this.awaitOutcome(target.sellerStoreId, listingId);
        await this.applyRemote(instance, remote);
        if (this.isPending(remote)) {
            await this.scheduleStatusCheck(instance.id, 1);
        }
        return instance;
    }
    async reconcile(instanceId, attempt = 1) {
        const instance = await this.instanceRepo.findOneBy({ id: instanceId });
        if (!instance || instance.syncStatus !== 'publishing')
            return;
        const target = await this.targetFor(instance.connectionId);
        const remote = await this.client.status(target.sellerStoreId, instance.listingId);
        if (this.isPending(remote)) {
            if (attempt < MAX_STATUS_CHECKS) {
                await this.scheduleStatusCheck(instance.id, attempt + 1);
            }
            else {
                await this.fail(instance, 'PartsBazar360 did not confirm the import in time. Check the worker is running, then republish.');
            }
            return;
        }
        await this.applyRemote(instance, remote);
    }
    async refresh(listingId) {
        const instances = await this.instanceRepo.find({
            where: { listingId, channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL },
        });
        for (const instance of instances) {
            const target = await this.targetFor(instance.connectionId);
            const remote = await this.client.status(target.sellerStoreId, listingId);
            if (!this.isPending(remote))
                await this.applyRemote(instance, remote);
        }
        return instances.map((i) => ({
            storeId: i.storeId,
            status: i.syncStatus,
            externalId: i.externalId,
            externalUrl: i.externalUrl,
            lastError: i.lastError,
        }));
    }
    async end(listingId) {
        const instances = await this.instanceRepo.find({
            where: { listingId, channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL },
        });
        if (instances.length === 0) {
            throw new common_1.NotFoundException(`No PartsBazar360 listing found for ${listingId}`);
        }
        for (const instance of instances) {
            const target = await this.targetFor(instance.connectionId);
            await this.client.end(target.sellerStoreId, [listingId]);
            instance.syncStatus = 'ended';
            instance.lastError = null;
            await this.instanceRepo.save(instance);
        }
        return { success: true };
    }
    async targetFor(connectionId) {
        const store = await this.storeRepo.findOne({
            where: { connectionId, channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL },
            order: { isPrimary: 'DESC', createdAt: 'ASC' },
        });
        if (!store?.externalStoreId) {
            throw new bullmq_2.UnrecoverableError(`No PartsBazar360 seller is linked to connection ${connectionId}`);
        }
        return { store, sellerStoreId: store.externalStoreId, connectionId };
    }
    async instanceFor(target, listingId) {
        const existing = await this.instanceRepo.findOne({
            where: { listingId, storeId: target.store.id },
        });
        if (existing)
            return existing;
        return this.instanceRepo.save(this.instanceRepo.create({
            listingId,
            connectionId: target.connectionId,
            storeId: target.store.id,
            channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL,
            syncStatus: 'pending',
            channelSpecificData: {},
        }));
    }
    async publicImageUrls(urls) {
        const base = (this.config.get('PARTSBAZAR360_IMAGE_BASE_URL') ||
            this.config.get('FRONTEND_BASE_URL') ||
            '')
            .trim()
            .replace(/\/+$/, '');
        const mirror = !/^(0|false|no|off)$/i.test(String(this.config.get('PARTSBAZAR360_MIRROR_IMAGES') ?? 'true').trim());
        const resolveOne = async (url) => {
            const key = this.storage.keyFromUrl(url);
            let s3Key;
            if (key) {
                if (this.storage.isTempKey(key))
                    return null;
                s3Key = await this.webpKeyFor(key);
            }
            else if (mirror) {
                s3Key = await this.mirrorExternalAsWebp(url);
            }
            else {
                return url;
            }
            if (!s3Key)
                return null;
            if (!base) {
                this.logger.warn('PARTSBAZAR360_IMAGE_BASE_URL / FRONTEND_BASE_URL not set; cannot expose photos publicly');
                return null;
            }
            const path = s3Key.split('/').map(encodeURIComponent).join('/');
            return `${base}/api/storage/serve/${path}`;
        };
        const resolved = new Array(urls.length).fill(null);
        let next = 0;
        const worker = async () => {
            while (next < urls.length) {
                const i = next++;
                resolved[i] = await resolveOne(urls[i]);
            }
        };
        await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
        return resolved.filter((u) => Boolean(u));
    }
    async toWebp(input, options = {}) {
        try {
            const image = (0, sharp_1.default)(input, { failOn: 'none' });
            const meta = await image.metadata();
            if (options.minSide &&
                Math.min(meta.width ?? 0, meta.height ?? 0) < options.minSide) {
                return null;
            }
            return await image
                .rotate()
                .resize({
                width: 1600,
                height: 1600,
                fit: 'inside',
                withoutEnlargement: true,
            })
                .webp({ quality: 85 })
                .toBuffer();
        }
        catch {
            return null;
        }
    }
    async webpKeyFor(key) {
        const webp = key.replace(/\.[a-z0-9]+$/i, '.webp');
        if (webp !== key && (await this.storage.objectExists(webp)))
            return webp;
        if (!(await this.storage.objectExists(key)))
            return null;
        if (webp === key)
            return key;
        try {
            const out = await this.toWebp(await this.storage.getObjectBuffer(key));
            if (!out)
                return key;
            await this.storage.putObject(webp, out, 'image/webp');
            return webp;
        }
        catch {
            return key;
        }
    }
    async mirrorExternalAsWebp(url) {
        const s3Key = this.storage.mirroredObjectKey('partsbazar360', url, '.webp');
        if (await this.storage.objectExists(s3Key))
            return s3Key;
        const source = url
            .replace('//media.napacanada.com/', '//media.napaonline.com/')
            .replace(/\/s-l\d+\.(jpg|jpeg|png|webp)/i, '/s-l1600.$1');
        try {
            const res = await fetch(source, {
                redirect: 'follow',
                signal: AbortSignal.timeout(30_000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; OmniCore-image-mirror/1.0)',
                    Accept: 'image/*',
                },
            });
            if (!res.ok) {
                this.logger.warn(`Photo fetch HTTP ${res.status}: ${source.slice(0, 90)}`);
                return null;
            }
            if (!/^image\//i.test(res.headers.get('content-type') ?? ''))
                return null;
            const out = await this.toWebp(Buffer.from(await res.arrayBuffer()), {
                minSide: 100,
            });
            if (!out)
                return null;
            await this.storage.putObject(s3Key, out, 'image/webp');
            return s3Key;
        }
        catch (error) {
            this.logger.warn(`Photo mirror failed for ${source.slice(0, 90)}: ${this.errorMessage(error)}`);
            return null;
        }
    }
    async refuseWithoutPhotos(instance, sellerStoreId, listingId, reason) {
        let message = reason;
        if (instance.externalId) {
            try {
                await this.client.end(sellerStoreId, [listingId]);
                message = `${reason} — taken off sale on PartsBazar360`;
            }
            catch (error) {
                message = `${reason} — could NOT be taken off sale: ${this.errorMessage(error)}`;
            }
        }
        await this.fail(instance, message);
        throw new bullmq_2.UnrecoverableError(message);
    }
    async awaitOutcome(sellerStoreId, listingId) {
        const tries = this.number('PARTSBAZAR360_CONFIRM_TRIES', 5);
        const interval = this.number('PARTSBAZAR360_CONFIRM_INTERVAL_MS', 3_000);
        let remote = await this.client.status(sellerStoreId, listingId);
        for (let i = 1; i < tries && this.isPending(remote); i++) {
            if (interval > 0)
                await new Promise((r) => setTimeout(r, interval));
            remote = await this.client.status(sellerStoreId, listingId);
        }
        return remote;
    }
    isPending(remote) {
        return remote.status === 'queued' || remote.status === 'unknown';
    }
    async applyRemote(instance, remote) {
        instance.channelSpecificData = {
            ...instance.channelSpecificData,
            remote: {
                status: remote.status,
                outcome: remote.outcome,
                offerId: remote.offer?.id ?? null,
                partId: remote.part?.id ?? null,
                checkedAt: new Date().toISOString(),
            },
        };
        switch (remote.status) {
            case 'imported':
                instance.syncStatus = 'synced';
                instance.externalId = remote.offer?.id ?? instance.externalId;
                instance.externalUrl = remote.part?.url ?? instance.externalUrl;
                instance.lastSyncedAt = new Date();
                instance.lastError = null;
                instance.retryCount = 0;
                await this.instanceRepo.save(instance);
                return;
            case 'ended':
                instance.syncStatus = 'ended';
                await this.instanceRepo.save(instance);
                return;
            case 'rejected': {
                const why = remote.outcome
                    ? (OUTCOME_MESSAGES[remote.outcome] ?? remote.outcome)
                    : 'unknown reason';
                await this.fail(instance, `PartsBazar360 declined the listing: ${why}`);
                return;
            }
            case 'failed':
                await this.fail(instance, `PartsBazar360 failed to import the listing: ${remote.error ?? 'unknown error'}`);
                return;
            default:
                await this.instanceRepo.save(instance);
        }
    }
    async fail(instance, message) {
        instance.syncStatus = 'error';
        instance.lastError = message.slice(0, 1000);
        instance.retryCount = (instance.retryCount ?? 0) + 1;
        await this.instanceRepo.save(instance);
    }
    scheduleStatusCheck(instanceId, attempt) {
        return this.channelsQueue.add(exports.PARTSBAZAR360_STATUS_JOB, { instanceId, attempt }, {
            delay: 30_000 * attempt,
            attempts: 2,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
    }
    isPermanent(error) {
        return (error instanceof partsbazar360_client_js_1.PartsBazarApiError &&
            !error.retryable &&
            error.status !== null);
    }
    storeMarketplace(store) {
        const value = store.config?.['marketplaceId'];
        return typeof value === 'string' && value ? value : 'EBAY_MOTORS_US';
    }
    storeCurrency(store) {
        const value = store.config?.['currency'];
        return typeof value === 'string' && value ? value : 'USD';
    }
    number(name, fallback) {
        const value = Number(this.config.get(name));
        return Number.isFinite(value) && value >= 0 ? value : fallback;
    }
    errorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }
};
exports.PartsBazar360Service = PartsBazar360Service;
exports.PartsBazar360Service = PartsBazar360Service = PartsBazar360Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(6, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(7, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(8, (0, typeorm_1.InjectRepository)(listing_channel_instance_entity_js_1.ListingChannelInstance)),
    __param(9, (0, bullmq_1.InjectQueue)('channels')),
    __metadata("design:paramtypes", [partsbazar360_client_js_1.PartsBazar360Client,
        config_1.ConfigService,
        token_encryption_service_js_1.TokenEncryptionService,
        storage_service_js_1.StorageService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        bullmq_2.Queue])
], PartsBazar360Service);
//# sourceMappingURL=partsbazar360.service.js.map
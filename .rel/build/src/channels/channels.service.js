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
var ChannelsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const channel_connection_entity_js_1 = require("./entities/channel-connection.entity.js");
const listing_channel_instance_entity_js_1 = require("./entities/listing-channel-instance.entity.js");
const channel_webhook_log_entity_js_1 = require("./entities/channel-webhook-log.entity.js");
const store_entity_js_1 = require("./entities/store.entity.js");
const token_encryption_service_js_1 = require("./token-encryption.service.js");
const ebay_adapter_js_1 = require("./adapters/ebay/ebay.adapter.js");
const partsbazar360_service_js_1 = require("./partsbazar360/partsbazar360.service.js");
const partsbazar360_types_js_1 = require("./partsbazar360/partsbazar360.types.js");
let ChannelsService = ChannelsService_1 = class ChannelsService {
    connectionRepo;
    instanceRepo;
    webhookLogRepo;
    storeRepo;
    channelsQueue;
    encryption;
    ebayAdapter;
    config;
    eventEmitter;
    partsbazar;
    logger = new common_1.Logger(ChannelsService_1.name);
    adapters;
    constructor(connectionRepo, instanceRepo, webhookLogRepo, storeRepo, channelsQueue, encryption, ebayAdapter, config, eventEmitter, partsbazar) {
        this.connectionRepo = connectionRepo;
        this.instanceRepo = instanceRepo;
        this.webhookLogRepo = webhookLogRepo;
        this.storeRepo = storeRepo;
        this.channelsQueue = channelsQueue;
        this.encryption = encryption;
        this.ebayAdapter = ebayAdapter;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.partsbazar = partsbazar;
        this.adapters = new Map([
            ['ebay', this.ebayAdapter],
        ]);
    }
    get isDemoMode() {
        return this.config.get('CHANNEL_DEMO_MODE', 'true') === 'true';
    }
    getAdapter(channel) {
        const adapter = this.adapters.get(channel);
        if (!adapter && channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            throw new common_1.BadRequestException('PartsBazar360 does not use OAuth. Link a seller with POST /channels/partsbazar360/connect.');
        }
        if (!adapter) {
            throw new common_1.BadRequestException(`Unsupported channel: ${channel}`);
        }
        return adapter;
    }
    async getConnections(userId) {
        return this.connectionRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
    getAuthUrl(channel, state) {
        return this.getAdapter(channel).getAuthUrl(state);
    }
    async handleOAuthCallback(channel, code, userId) {
        const adapter = this.getAdapter(channel);
        const tokens = await adapter.exchangeCode(code);
        const connection = this.connectionRepo.create({
            channel,
            userId,
            encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
            tokenExpiresAt: tokens.expiresAt,
            scope: tokens.scope ?? null,
            status: 'active',
        });
        const saved = await this.connectionRepo.save(connection);
        this.logger.log(`Created ${channel} connection ${saved.id} for user ${userId}`);
        this.eventEmitter.emit('channel.connected', {
            connectionId: saved.id,
            channel,
            userId,
        });
        return saved;
    }
    async connectEbayLegacyToken(legacyToken, storesService, userId) {
        const existing = await this.connectionRepo.find({
            where: { channel: 'ebay', userId },
        });
        for (const conn of existing) {
            await this.connectionRepo.delete(conn.id);
            this.logger.log(`Removed previous eBay connection ${conn.id} before re-linking`);
        }
        const tokens = this.ebayAdapter.exchangeLegacyToken(legacyToken);
        const connection = this.connectionRepo.create({
            channel: 'ebay',
            userId,
            accountName: 'eBay Sandbox (User Token)',
            externalAccountId: `${legacyToken.slice(0, 20)}…`,
            encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
            tokenExpiresAt: tokens.expiresAt,
            scope: tokens.scope ?? null,
            status: 'active',
        });
        const savedConn = await this.connectionRepo.save(connection);
        this.logger.log(`Created eBay legacy-token connection ${savedConn.id}`);
        let store;
        const existingStore = await this.storeRepo.findOne({
            where: { connectionId: savedConn.id },
        });
        if (existingStore) {
            store = existingStore;
        }
        else {
            store = await storesService.createStore({
                connectionId: savedConn.id,
                channel: 'ebay',
                storeName: 'MHN eBay Sandbox Store',
                storeUrl: 'https://www.sandbox.ebay.com',
                externalStoreId: this.ebayAdapter['clientId'],
                isPrimary: true,
                config: {
                    marketplace: 'EBAY_MOTORS_US',
                    sandbox: true,
                    tokenType: 'legacy',
                    legacyTokenStored: true,
                },
            });
        }
        this.eventEmitter.emit('channel.connected', {
            connectionId: savedConn.id,
            channel: 'ebay',
            userId,
            storeId: store.id,
        });
        return {
            connection: savedConn,
            storeId: store.id,
            message: 'eBay sandbox connected successfully. Demo mode active — publish operations are simulated locally.',
        };
    }
    async disconnectChannel(connectionId, userId) {
        const result = await this.connectionRepo.delete({
            id: connectionId,
            userId,
        });
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Connection ${connectionId} not found`);
        }
    }
    async testConnection(connectionId, userId) {
        const conn = await this.connectionRepo.findOneBy({
            id: connectionId,
            userId,
        });
        if (!conn)
            throw new common_1.NotFoundException(`Connection ${connectionId} not found`);
        if (conn.channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            return this.partsbazar.testConnection(conn.id);
        }
        try {
            const tokens = this.decryptTokens(conn);
            const adapter = this.getAdapter(conn.channel);
            if (tokens.refreshToken) {
                await adapter.refreshTokens(tokens.refreshToken);
            }
            return { ok: true };
        }
        catch (error) {
            conn.status = 'error';
            conn.lastError = error.message;
            await this.connectionRepo.save(conn);
            return { ok: false, error: error.message };
        }
    }
    async enqueuePublish(connectionId, listingId) {
        const job = await this.channelsQueue.add('publish', { connectionId, listingId }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        return { jobId: job.id };
    }
    async publishListing(connectionId, listingId, listingData) {
        const conn = await this.connectionRepo.findOneBy({ id: connectionId });
        if (!conn)
            throw new common_1.NotFoundException('Connection not found');
        if (this.isDemoMode) {
            const demoId = `DEMO-${conn.channel.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const demoUrl = conn.channel === 'ebay'
                ? `https://www.sandbox.ebay.com/itm/${demoId}`
                : `https://demo.example.com/${conn.channel}/${demoId}`;
            const existing = await this.instanceRepo.findOne({
                where: { connectionId, listingId },
            });
            if (existing) {
                existing.externalId = demoId;
                existing.externalUrl = demoUrl;
                existing.syncStatus = 'synced';
                existing.lastSyncedAt = new Date();
                existing.lastError = null;
                this.logger.log(`[DEMO] Updated channel instance for listing ${listingId} on ${conn.channel}`);
                return this.instanceRepo.save(existing);
            }
            let storeId = listingData['storeId'];
            if (!storeId) {
                const store = await this.storeRepo.findOne({
                    where: { connectionId },
                    order: { isPrimary: 'DESC', createdAt: 'ASC' },
                });
                if (!store)
                    throw new common_1.BadRequestException(`No store found for connection ${connectionId}.`);
                storeId = store.id;
            }
            this.logger.log(`[DEMO] Simulated publish of listing ${listingId} to ${conn.channel} → ${demoUrl}`);
            const instance = this.instanceRepo.create({
                connectionId,
                listingId,
                storeId,
                channel: conn.channel,
                externalId: demoId,
                externalUrl: demoUrl,
                syncStatus: 'synced',
                lastSyncedAt: new Date(),
            });
            return this.instanceRepo.save(instance);
        }
        const tokens = await this.getValidTokens(conn);
        const adapter = this.getAdapter(conn.channel);
        const result = await adapter.publishListing(tokens, listingData);
        if (result.status === 'error') {
            throw new common_1.BadRequestException(result.error ?? 'Publish failed');
        }
        const existing = await this.instanceRepo.findOne({
            where: { connectionId, listingId },
        });
        if (existing) {
            existing.externalId = result.externalId;
            existing.externalUrl = result.externalUrl ?? null;
            existing.syncStatus = 'synced';
            existing.lastSyncedAt = new Date();
            existing.lastError = null;
            return this.instanceRepo.save(existing);
        }
        let storeId = listingData['storeId'];
        if (!storeId) {
            const store = await this.storeRepo.findOne({
                where: { connectionId },
                order: { isPrimary: 'DESC', createdAt: 'ASC' },
            });
            if (!store) {
                throw new common_1.BadRequestException(`No store found for connection ${connectionId}. Create a store first.`);
            }
            storeId = store.id;
        }
        const instance = this.instanceRepo.create({
            connectionId,
            listingId,
            storeId,
            channel: conn.channel,
            externalId: result.externalId,
            externalUrl: result.externalUrl ?? null,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
        });
        return this.instanceRepo.save(instance);
    }
    async recordEbayPublishSuccess(connectionId, listingId, storeId, result) {
        const conn = await this.connectionRepo.findOneBy({ id: connectionId });
        if (!conn)
            throw new common_1.NotFoundException('Connection not found');
        const externalId = result.listingId ?? result.offerId ?? '';
        const externalUrl = result.listingId
            ? `https://www.ebay.com/itm/${result.listingId}`
            : null;
        const existing = await this.instanceRepo.findOne({
            where: { connectionId, listingId, storeId },
        });
        if (existing) {
            existing.externalId = externalId;
            existing.externalUrl = externalUrl;
            existing.syncStatus = 'synced';
            existing.lastSyncedAt = new Date();
            existing.lastError = null;
            return this.instanceRepo.save(existing);
        }
        const instance = this.instanceRepo.create({
            connectionId,
            listingId,
            storeId,
            channel: conn.channel,
            externalId,
            externalUrl,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
        });
        return this.instanceRepo.save(instance);
    }
    async enqueueSync(connectionId) {
        const job = await this.channelsQueue.add('sync-inventory', { connectionId }, {
            attempts: 2,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 50,
        });
        return { jobId: job.id };
    }
    async getChannelListings(connectionId) {
        return this.instanceRepo.find({
            where: { connectionId },
            order: { createdAt: 'DESC' },
        });
    }
    async getListingChannelStatuses(listingId) {
        const instances = await this.instanceRepo.find({
            where: { listingId },
            order: { createdAt: 'DESC' },
        });
        return instances.map((inst) => ({
            channel: inst.channel,
            connectionId: inst.connectionId,
            status: inst.syncStatus,
            externalId: inst.externalId,
            externalUrl: inst.externalUrl,
            lastSyncedAt: inst.lastSyncedAt,
            lastError: inst.lastError,
        }));
    }
    async publishMulti(listingId, channels, overrides, storeId) {
        const results = [];
        for (const channel of channels) {
            try {
                const targetStore = storeId
                    ? await this.storeRepo.findOne({ where: { id: storeId, channel } })
                    : null;
                if (storeId && !targetStore) {
                    results.push({
                        channel,
                        error: `Store ${storeId} is not a ${channel} store`,
                    });
                    continue;
                }
                const connection = targetStore
                    ? await this.connectionRepo.findOne({
                        where: { id: targetStore.connectionId, status: 'active' },
                    })
                    : await this.connectionRepo.findOne({
                        where: { channel, status: 'active' },
                        order: { createdAt: 'DESC' },
                    });
                if (!connection) {
                    results.push({
                        channel,
                        error: `No active ${channel} connection found`,
                    });
                    continue;
                }
                const job = await this.channelsQueue.add('publish', {
                    connectionId: connection.id,
                    listingId,
                    overrides: overrides?.[channel],
                    storeId: targetStore?.id,
                }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 10_000 },
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                const store = targetStore ??
                    (await this.storeRepo.findOne({
                        where: { connectionId: connection.id },
                        order: { isPrimary: 'DESC', createdAt: 'ASC' },
                    }));
                if (!store) {
                    results.push({
                        channel,
                        error: `No store found for ${channel} connection. Create a store first.`,
                    });
                    continue;
                }
                const existing = await this.instanceRepo.findOne({
                    where: { connectionId: connection.id, listingId },
                });
                if (!existing) {
                    await this.instanceRepo.save(this.instanceRepo.create({
                        connectionId: connection.id,
                        listingId,
                        storeId: store.id,
                        channel,
                        syncStatus: 'pending',
                    }));
                }
                else {
                    existing.syncStatus = 'pending';
                    existing.lastError = null;
                    await this.instanceRepo.save(existing);
                }
                results.push({ channel, jobId: job.id });
            }
            catch (error) {
                results.push({ channel, error: error.message });
            }
        }
        return { results };
    }
    async updateChannelListing(listingId, channel) {
        const instance = await this.instanceRepo.findOne({
            where: { listingId, channel },
        });
        if (!instance) {
            throw new common_1.NotFoundException(`No channel listing found for listing ${listingId} on ${channel}`);
        }
        const job = await this.channelsQueue.add('update', {
            connectionId: instance.connectionId,
            listingId,
            channelListingId: instance.id,
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        instance.syncStatus = 'pending';
        await this.instanceRepo.save(instance);
        return { jobId: job.id };
    }
    async endChannelListing(listingId, channel) {
        const instance = await this.instanceRepo.findOne({
            where: { listingId, channel },
        });
        if (!instance) {
            throw new common_1.NotFoundException(`No channel listing found for listing ${listingId} on ${channel}`);
        }
        if (channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            return this.partsbazar.end(listingId);
        }
        instance.syncStatus = 'ended';
        await this.instanceRepo.save(instance);
        return { success: true };
    }
    async bulkPublish(listingIds, channels, storeId) {
        let enqueued = 0;
        const errors = [];
        for (const listingId of listingIds) {
            const result = await this.publishMulti(listingId, channels, undefined, storeId);
            for (const r of result.results) {
                if (r.jobId) {
                    enqueued++;
                }
                else if (r.error) {
                    errors.push(`${listingId}@${r.channel}: ${r.error}`);
                }
            }
        }
        return { total: listingIds.length * channels.length, enqueued, errors };
    }
    async logWebhook(channel, eventType, payload, externalId, storeId) {
        const log = this.webhookLogRepo.create({
            channel,
            eventType,
            externalId: externalId ?? null,
            payload,
            processingStatus: 'received',
            storeId: storeId ?? null,
        });
        return this.webhookLogRepo.save(log);
    }
    async resolveStoreFromWebhook(channel, externalStoreId) {
        if (!externalStoreId)
            return null;
        const store = await this.connectionRepo.manager
            .getRepository('Store')
            .findOne({ where: { channel, externalStoreId } });
        return store?.id ?? null;
    }
    async seedDemoEbayConnection(storesService) {
        const existing = await this.connectionRepo.findOne({
            where: { channel: 'ebay', accountName: 'eBay Sandbox Demo' },
        });
        if (existing) {
            const store = await this.connectionRepo.manager
                .getRepository('Store')
                .findOne({ where: { connectionId: existing.id } });
            return {
                connectionId: existing.id,
                storeId: store?.id ?? '',
                message: 'Demo eBay sandbox connection already exists',
            };
        }
        const demoTokens = {
            accessToken: `DEMO_SANDBOX_TOKEN_${Date.now()}`,
            refreshToken: `DEMO_SANDBOX_REFRESH_${Date.now()}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account',
            tokenType: 'User Access Token',
        };
        const userId = '00000000-0000-0000-0000-000000000001';
        const connection = this.connectionRepo.create({
            channel: 'ebay',
            userId,
            accountName: 'eBay Sandbox Demo',
            externalAccountId: this.ebayAdapter.channelName,
            encryptedTokens: this.encryption.encrypt(JSON.stringify(demoTokens)),
            tokenExpiresAt: demoTokens.expiresAt,
            scope: demoTokens.scope ?? null,
            status: 'active',
        });
        const savedConn = await this.connectionRepo.save(connection);
        this.logger.log(`Created demo eBay connection: ${savedConn.id}`);
        const store = await storesService.createStore({
            connectionId: savedConn.id,
            channel: 'ebay',
            storeName: 'MHN eBay Sandbox Store',
            storeUrl: 'https://sandbox.ebay.com',
            externalStoreId: 'IrtizaHa-listingp-SBX-e6e5fa804-178dade4',
            isPrimary: true,
            config: {
                marketplace: 'EBAY_MOTORS_US',
                sandbox: true,
            },
        });
        return {
            connectionId: savedConn.id,
            storeId: store.id,
            message: 'Demo eBay sandbox connection and store created successfully',
        };
    }
    decryptTokens(conn) {
        const json = this.encryption.decrypt(conn.encryptedTokens);
        return JSON.parse(json);
    }
    async getValidTokens(conn) {
        let tokens = this.decryptTokens(conn);
        if (tokens.expiresAt &&
            new Date(tokens.expiresAt).getTime() < Date.now() + 5 * 60 * 1000) {
            if (tokens.refreshToken) {
                const adapter = this.getAdapter(conn.channel);
                tokens = await adapter.refreshTokens(tokens.refreshToken);
                conn.encryptedTokens = this.encryption.encrypt(JSON.stringify(tokens));
                conn.tokenExpiresAt = tokens.expiresAt;
                await this.connectionRepo.save(conn);
                this.logger.log(`Refreshed tokens for connection ${conn.id}`);
            }
        }
        return tokens;
    }
    async syncConnectionInventory(connectionId) {
        const conn = await this.connectionRepo.findOneBy({ id: connectionId });
        if (!conn)
            throw new common_1.NotFoundException(`Connection ${connectionId} not found`);
        if (conn.channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            return { succeeded: 0, failed: 0 };
        }
        const adapter = this.getAdapter(conn.channel);
        const tokens = await this.getValidTokens(conn);
        const channelListings = await this.instanceRepo.find({
            where: { connectionId },
        });
        if (channelListings.length === 0) {
            return { succeeded: 0, failed: 0 };
        }
        const items = channelListings
            .filter((cl) => cl.externalId)
            .map((cl) => ({
            externalId: cl.externalId,
            quantity: 1,
            price: undefined,
        }));
        return adapter.syncInventory(tokens, items);
    }
    async syncAllInventory(channel) {
        const where = { status: 'active' };
        if (channel)
            where['channel'] = channel;
        const connections = await this.connectionRepo.find({ where });
        this.logger.log(`Syncing inventory for ${connections.length} connections (channel=${channel ?? 'all'})`);
        for (const conn of connections) {
            try {
                const result = await this.syncConnectionInventory(conn.id);
                this.logger.log(`Inventory sync for ${conn.channel}:${conn.id}: ${result.succeeded} OK, ${result.failed} failed`);
            }
            catch (error) {
                this.logger.error(`Inventory sync failed for ${conn.channel}:${conn.id}: ${error.message}`);
            }
        }
    }
};
exports.ChannelsService = ChannelsService;
exports.ChannelsService = ChannelsService = ChannelsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_channel_instance_entity_js_1.ListingChannelInstance)),
    __param(2, (0, typeorm_1.InjectRepository)(channel_webhook_log_entity_js_1.ChannelWebhookLog)),
    __param(3, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(4, (0, bullmq_1.InjectQueue)('channels')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        bullmq_2.Queue,
        token_encryption_service_js_1.TokenEncryptionService,
        ebay_adapter_js_1.EbayAdapter,
        config_1.ConfigService,
        event_emitter_1.EventEmitter2,
        partsbazar360_service_js_1.PartsBazar360Service])
], ChannelsService);
//# sourceMappingURL=channels.service.js.map
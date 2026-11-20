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
var StoresService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoresService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const store_entity_js_1 = require("./entities/store.entity.js");
const listing_channel_instance_entity_js_1 = require("./entities/listing-channel-instance.entity.js");
const demo_simulation_log_entity_js_1 = require("./entities/demo-simulation-log.entity.js");
const channel_connection_entity_js_1 = require("./entities/channel-connection.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const config_1 = require("@nestjs/config");
const ebay_publish_service_js_1 = require("./ebay/ebay-publish.service.js");
const store_access_service_js_1 = require("./store-access.service.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_business_policy_entity_js_1 = require("../integrations/ebay/entities/ebay-business-policy.entity.js");
const shipping_profile_entity_js_1 = require("../settings/entities/shipping-profile.entity.js");
let StoresService = StoresService_1 = class StoresService {
    storeRepo;
    instanceRepo;
    demoLogRepo;
    connectionRepo;
    listingRepo;
    connectedAccountRepo;
    policyRepo;
    shippingProfileRepo;
    dataSource;
    config;
    ebayPublish;
    storeAccess;
    logger = new common_1.Logger(StoresService_1.name);
    constructor(storeRepo, instanceRepo, demoLogRepo, connectionRepo, listingRepo, connectedAccountRepo, policyRepo, shippingProfileRepo, dataSource, config, ebayPublish, storeAccess) {
        this.storeRepo = storeRepo;
        this.instanceRepo = instanceRepo;
        this.demoLogRepo = demoLogRepo;
        this.connectionRepo = connectionRepo;
        this.listingRepo = listingRepo;
        this.connectedAccountRepo = connectedAccountRepo;
        this.policyRepo = policyRepo;
        this.shippingProfileRepo = shippingProfileRepo;
        this.dataSource = dataSource;
        this.config = config;
        this.ebayPublish = ebayPublish;
        this.storeAccess = storeAccess;
    }
    get isDemoMode() {
        return this.config.get('CHANNEL_DEMO_MODE', 'true') === 'true';
    }
    async getStores(connectionId) {
        const where = connectionId ? { connectionId } : {};
        return this.storeRepo.find({
            where,
            order: { isPrimary: 'DESC', createdAt: 'ASC' },
        });
    }
    async getStoresByChannel(channel, user) {
        let accessibleIds;
        if (user) {
            accessibleIds = await this.storeAccess.resolveStoreFilter(user);
            if (accessibleIds?.length === 0)
                return [];
        }
        const where = { channel };
        if (accessibleIds)
            where.id = (0, typeorm_2.In)(accessibleIds);
        const stores = await this.storeRepo.find({
            where,
            order: { isPrimary: 'DESC', createdAt: 'ASC' },
        });
        if (!user || channel !== 'ebay')
            return stores;
        const connectionIds = stores.map((s) => s.connectionId);
        const accounts = await this.connectedAccountRepo.find({
            where: { channelConnectionId: (0, typeorm_2.In)(connectionIds) },
            relations: ['marketplaces'],
        });
        const accountByConnId = new Map(accounts.map((a) => [a.channelConnectionId, a]));
        const eligible = [];
        for (const store of stores) {
            const account = accountByConnId.get(store.connectionId);
            if (!account)
                continue;
            if (account.connectionStatus !== 'active')
                continue;
            const mkt = (account.marketplaces ?? []).find((m) => m.marketplaceId === store.ebayMarketplaceId);
            if (!mkt)
                continue;
            if (account.connectionSource === 'native_oauth' &&
                (!mkt.defaultFulfillmentPolicyId ||
                    !mkt.defaultPaymentPolicyId ||
                    !mkt.defaultReturnPolicyId))
                continue;
            const policies = await this.policyRepo.find({
                where: {
                    ebayAccountId: account.id,
                    marketplaceId: mkt.marketplaceId,
                },
            });
            const policyByName = new Map(policies.map((p) => [p.policyType, p.name]));
            eligible.push({
                ...store,
                marketplaceLabel: mkt.marketplaceId,
                fulfillmentPolicyName: policyByName.get('fulfillment') ?? null,
                paymentPolicyName: policyByName.get('payment') ?? null,
                returnPolicyName: policyByName.get('return') ?? null,
            });
        }
        return eligible;
    }
    async getStore(storeId) {
        const store = await this.storeRepo.findOneBy({ id: storeId });
        if (!store)
            throw new common_1.NotFoundException(`Store ${storeId} not found`);
        return store;
    }
    async getStoreProfiles(storeId) {
        const store = await this.getStore(storeId);
        let shippingProfiles = [];
        const localShipping = await this.shippingProfileRepo.find({
            where: { active: true },
            order: { isDefault: 'DESC', name: 'ASC' },
        });
        shippingProfiles = localShipping;
        let returnProfiles = [];
        let paymentProfiles = [];
        if (store.channel === 'ebay' && store.connectionId) {
            const account = await this.connectedAccountRepo.findOne({
                where: { channelConnectionId: store.connectionId },
            });
            if (account && store.ebayMarketplaceId) {
                const policies = await this.policyRepo.find({
                    where: {
                        ebayAccountId: account.id,
                        marketplaceId: store.ebayMarketplaceId,
                    },
                    order: { isDefault: 'DESC', name: 'ASC' },
                });
                const fulfillPolicies = policies.filter((p) => p.policyType === 'fulfillment');
                const ebayShippingProfiles = fulfillPolicies.map((p) => {
                    let shippingCost;
                    let currency;
                    try {
                        const raw = p.rawPayload;
                        const shippingOptions = raw?.shippingOptions;
                        if (shippingOptions?.[0]?.shippingServices) {
                            const services = shippingOptions[0].shippingServices;
                            if (services[0]?.shippingCost) {
                                const cost = services[0].shippingCost;
                                shippingCost = cost.value
                                    ? parseFloat(cost.value)
                                    : undefined;
                                currency = cost.currency;
                            }
                        }
                    }
                    catch (e) {
                    }
                    return {
                        id: p.id,
                        name: p.name,
                        carrier: '',
                        service: '',
                        costType: '',
                        ebayPolicyId: p.ebayPolicyId,
                        shippingCost,
                        currency,
                    };
                });
                const byName = new Map();
                for (const profile of [...ebayShippingProfiles, ...shippingProfiles]) {
                    const key = profile.name.trim().toLocaleLowerCase();
                    if (key && !byName.has(key))
                        byName.set(key, profile);
                }
                shippingProfiles = [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
                returnProfiles = policies
                    .filter((p) => p.policyType === 'return')
                    .map((p) => ({
                    id: p.id,
                    name: p.name,
                    ebayPolicyId: p.ebayPolicyId,
                }));
                paymentProfiles = policies
                    .filter((p) => p.policyType === 'payment')
                    .map((p) => ({
                    id: p.id,
                    name: p.name,
                    ebayPolicyId: p.ebayPolicyId,
                }));
            }
        }
        return { shippingProfiles, returnProfiles, paymentProfiles };
    }
    async createStore(data) {
        const conn = await this.connectionRepo.findOneBy({ id: data.connectionId });
        if (!conn)
            throw new common_1.NotFoundException(`Connection ${data.connectionId} not found`);
        const store = this.storeRepo.create({
            connectionId: data.connectionId,
            channel: data.channel,
            storeName: data.storeName,
            storeUrl: data.storeUrl ?? null,
            externalStoreId: data.externalStoreId ?? null,
            isPrimary: data.isPrimary ?? false,
            config: data.config ?? {},
        });
        const saved = await this.storeRepo.save(store);
        this.logger.log(`Created store "${saved.storeName}" (${saved.id}) for ${data.channel}`);
        if (this.isDemoMode) {
            await this.logDemo({
                operationType: 'auth_simulated',
                channel: data.channel,
                storeId: saved.id,
                notes: `Demo store "${saved.storeName}" created`,
            });
        }
        return saved;
    }
    async updateStore(storeId, data) {
        const store = await this.getStore(storeId);
        Object.assign(store, data);
        return this.storeRepo.save(store);
    }
    async deleteStore(storeId) {
        const result = await this.storeRepo.delete(storeId);
        if (result.affected === 0)
            throw new common_1.NotFoundException(`Store ${storeId} not found`);
    }
    async getInstances(filters) {
        const qb = this.instanceRepo
            .createQueryBuilder('i')
            .leftJoinAndSelect('i.store', 'store')
            .leftJoinAndSelect('i.connection', 'conn');
        if (filters.listingId)
            qb.andWhere('i.listing_id = :listingId', {
                listingId: filters.listingId,
            });
        if (filters.storeId)
            qb.andWhere('i.store_id = :storeId', { storeId: filters.storeId });
        if (filters.connectionId)
            qb.andWhere('i.connection_id = :connectionId', {
                connectionId: filters.connectionId,
            });
        if (filters.channel)
            qb.andWhere('i.channel = :channel', { channel: filters.channel });
        if (filters.syncStatus)
            qb.andWhere('i.sync_status = :syncStatus', {
                syncStatus: filters.syncStatus,
            });
        return qb.orderBy('i.created_at', 'DESC').getMany();
    }
    async getInstance(instanceId) {
        const inst = await this.instanceRepo.findOne({
            where: { id: instanceId },
            relations: ['store', 'connection'],
        });
        if (!inst)
            throw new common_1.NotFoundException(`Instance ${instanceId} not found`);
        return inst;
    }
    async createInstance(data) {
        const store = await this.getStore(data.storeId);
        const listing = await this.listingRepo.findOneBy({ id: data.listingId });
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${data.listingId} not found`);
        const existing = await this.instanceRepo.findOneBy({
            listingId: data.listingId,
            storeId: data.storeId,
        });
        if (existing) {
            throw new common_1.ConflictException(`Listing ${data.listingId} already has an instance at store ${store.storeName}`);
        }
        const instance = this.instanceRepo.create({
            listingId: data.listingId,
            connectionId: store.connectionId,
            storeId: data.storeId,
            channel: store.channel,
            overridePrice: data.overridePrice ?? null,
            overrideQuantity: data.overrideQuantity ?? null,
            overrideTitle: data.overrideTitle ?? null,
            channelSpecificData: data.channelSpecificData ?? {},
            syncStatus: 'draft',
            isDemo: this.isDemoMode,
        });
        const saved = await this.instanceRepo.save(instance);
        this.logger.log(`Created instance ${saved.id} for listing ${data.listingId} at store ${store.storeName}`);
        await this.updateStoreListingCount(data.storeId);
        return saved;
    }
    async publishInstance(instanceId) {
        const instance = await this.getInstance(instanceId);
        if (instance.syncStatus === 'synced') {
            throw new common_1.BadRequestException('Instance is already published');
        }
        instance.syncStatus = 'publishing';
        await this.instanceRepo.save(instance);
        if (this.isDemoMode) {
            const simulatedDelay = 200 + Math.random() * 800;
            await new Promise((r) => setTimeout(r, simulatedDelay));
            const externalId = `DEMO-${instance.channel.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalUrl = this.generateDemoUrl(instance.channel, externalId);
            instance.externalId = externalId;
            instance.externalUrl = externalUrl;
            instance.syncStatus = 'synced';
            instance.lastSyncedAt = new Date();
            instance.lastError = null;
            instance.isDemo = true;
            await this.instanceRepo.save(instance);
            await this.logDemo({
                operationType: 'publish',
                channel: instance.channel,
                storeId: instance.storeId,
                listingId: instance.listingId,
                instanceId: instance.id,
                simulatedExternalId: externalId,
                requestPayload: {
                    listingId: instance.listingId,
                    overridePrice: instance.overridePrice,
                    overrideQuantity: instance.overrideQuantity,
                },
                responsePayload: {
                    externalId,
                    externalUrl,
                    status: 'active',
                },
                simulatedLatencyMs: Math.round(simulatedDelay),
            });
            this.logger.log(`[DEMO] Published instance ${instanceId} → ${externalId}`);
        }
        else {
            const listing = await this.listingRepo.findOneBy({
                id: instance.listingId,
            });
            if (!listing) {
                instance.syncStatus = 'error';
                instance.lastError = `Listing ${instance.listingId} not found`;
                await this.instanceRepo.save(instance);
                throw new common_1.NotFoundException(instance.lastError);
            }
            const stub = this.ebayPublish.stubPublishRequest(instance.listingId, [
                instance.storeId,
            ]);
            if (instance.overrideTitle)
                stub.title = instance.overrideTitle;
            if (instance.overridePrice != null)
                stub.price = Number(instance.overridePrice);
            if (instance.overrideQuantity != null)
                stub.quantity = instance.overrideQuantity;
            const results = await this.ebayPublish.publish(stub);
            const result = results[0];
            if (!result?.success) {
                instance.syncStatus = 'error';
                instance.lastError = result?.error ?? 'Publish failed';
                await this.instanceRepo.save(instance);
                throw new common_1.BadRequestException(instance.lastError);
            }
            instance.externalId = result.listingId ?? result.offerId ?? null;
            instance.externalUrl = result.listingId
                ? `https://www.ebay.com/itm/${result.listingId}`
                : null;
            instance.syncStatus = 'synced';
            instance.lastSyncedAt = new Date();
            instance.lastError = null;
            await this.instanceRepo.save(instance);
            await this.updateStoreListingCount(instance.storeId);
        }
        return instance;
    }
    async bulkPublishInstances(instanceIds) {
        const results = [];
        for (const id of instanceIds) {
            try {
                const inst = await this.publishInstance(id);
                results.push({
                    instanceId: id,
                    status: 'published',
                    externalId: inst.externalId ?? undefined,
                });
            }
            catch (error) {
                results.push({
                    instanceId: id,
                    status: 'error',
                    error: error.message,
                });
            }
        }
        return { results };
    }
    async endInstance(instanceId) {
        const instance = await this.getInstance(instanceId);
        if (this.isDemoMode) {
            instance.syncStatus = 'ended';
            instance.lastSyncedAt = new Date();
            await this.instanceRepo.save(instance);
            await this.logDemo({
                operationType: 'end_listing',
                channel: instance.channel,
                storeId: instance.storeId,
                listingId: instance.listingId,
                instanceId: instance.id,
                simulatedExternalId: instance.externalId,
                notes: 'Demo listing ended',
            });
        }
        else {
            instance.syncStatus = 'ended';
            await this.instanceRepo.save(instance);
        }
        await this.updateStoreListingCount(instance.storeId);
        return instance;
    }
    async publishToMultipleStores(listingId, storeIds, overrides) {
        const results = [];
        for (const storeId of storeIds) {
            try {
                const storeOverrides = overrides?.[storeId] ?? {};
                let instance;
                const existing = await this.instanceRepo.findOneBy({
                    listingId,
                    storeId,
                });
                if (existing) {
                    instance = existing;
                    if (storeOverrides.price !== undefined)
                        instance.overridePrice = storeOverrides.price;
                    if (storeOverrides.quantity !== undefined)
                        instance.overrideQuantity = storeOverrides.quantity;
                    if (storeOverrides.title !== undefined)
                        instance.overrideTitle = storeOverrides.title;
                    await this.instanceRepo.save(instance);
                }
                else {
                    instance = await this.createInstance({
                        listingId,
                        storeId,
                        overridePrice: storeOverrides.price,
                        overrideQuantity: storeOverrides.quantity,
                        overrideTitle: storeOverrides.title,
                    });
                }
                const published = await this.publishInstance(instance.id);
                results.push({
                    storeId,
                    instanceId: published.id,
                    status: 'published',
                });
            }
            catch (error) {
                results.push({
                    storeId,
                    status: 'error',
                    error: error.message,
                });
            }
        }
        return { results };
    }
    async getListingChannelOverview(listingId) {
        const instances = await this.instanceRepo.find({
            where: { listingId },
            relations: ['store', 'connection'],
            order: { channel: 'ASC', createdAt: 'ASC' },
        });
        const channelMap = new Map();
        for (const inst of instances) {
            const existing = channelMap.get(inst.channel) ?? [];
            existing.push(inst);
            channelMap.set(inst.channel, existing);
        }
        const channelSummary = Array.from(channelMap.entries()).map(([channel, insts]) => ({
            channel,
            storeCount: insts.length,
            publishedCount: insts.filter((i) => i.syncStatus === 'synced').length,
            totalStores: insts.map((i) => ({
                storeId: i.storeId,
                storeName: i.store?.storeName ?? 'Unknown',
                syncStatus: i.syncStatus,
                externalId: i.externalId,
            })),
        }));
        return { instances, channelSummary };
    }
    async getDemoLogs(filters) {
        const qb = this.demoLogRepo.createQueryBuilder('d');
        if (filters.channel)
            qb.andWhere('d.channel = :channel', { channel: filters.channel });
        if (filters.operationType)
            qb.andWhere('d.operation_type = :opType', {
                opType: filters.operationType,
            });
        if (filters.listingId)
            qb.andWhere('d.listing_id = :listingId', {
                listingId: filters.listingId,
            });
        const [logs, total] = await qb
            .orderBy('d.created_at', 'DESC')
            .take(filters.limit ?? 50)
            .skip(filters.offset ?? 0)
            .getManyAndCount();
        return { logs, total };
    }
    async simulateIncomingOrder(instanceId) {
        const instance = await this.getInstance(instanceId);
        if (instance.syncStatus !== 'synced') {
            throw new common_1.BadRequestException('Can only simulate orders for published instances');
        }
        const simulatedOrderId = `DEMO-ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const simulatedPrice = instance.overridePrice ?? 29.99;
        const log = await this.logDemo({
            operationType: 'order_received',
            channel: instance.channel,
            storeId: instance.storeId,
            listingId: instance.listingId,
            instanceId: instance.id,
            simulatedExternalId: simulatedOrderId,
            requestPayload: {
                orderId: simulatedOrderId,
                buyerUsername: `demo_buyer_${Math.random().toString(36).slice(2, 6)}`,
                quantity: 1,
                itemPrice: simulatedPrice,
                shippingCost: 9.99,
            },
            responsePayload: {
                orderStatus: 'awaiting_shipment',
                paymentStatus: 'paid',
                totalPrice: Number(simulatedPrice) + 9.99,
            },
            simulatedLatencyMs: Math.round(100 + Math.random() * 300),
            notes: 'Simulated incoming order for demo',
        });
        this.logger.log(`[DEMO] Simulated order ${simulatedOrderId} for instance ${instanceId}`);
        return log;
    }
    async updateStoreListingCount(storeId) {
        const count = await this.instanceRepo.count({
            where: { storeId, syncStatus: 'synced' },
        });
        await this.storeRepo.update(storeId, { listingCount: count });
    }
    generateDemoUrl(channel, externalId) {
        switch (channel) {
            case 'ebay':
                return `https://www.sandbox.ebay.com/itm/${externalId}`;
            case 'shopify':
                return `https://demo-store.myshopify.com/products/${externalId}`;
            case 'amazon':
                return `https://www.amazon.com/dp/${externalId}`;
            case 'walmart':
                return `https://www.walmart.com/ip/${externalId}`;
            default:
                return `https://demo.marketplace.com/${channel}/${externalId}`;
        }
    }
    async logDemo(data) {
        const log = this.demoLogRepo.create(data);
        return this.demoLogRepo.save(log);
    }
};
exports.StoresService = StoresService;
exports.StoresService = StoresService = StoresService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_channel_instance_entity_js_1.ListingChannelInstance)),
    __param(2, (0, typeorm_1.InjectRepository)(demo_simulation_log_entity_js_1.DemoSimulationLog)),
    __param(3, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(4, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(6, (0, typeorm_1.InjectRepository)(ebay_business_policy_entity_js_1.EbayBusinessPolicy)),
    __param(7, (0, typeorm_1.InjectRepository)(shipping_profile_entity_js_1.ShippingProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        config_1.ConfigService,
        ebay_publish_service_js_1.EbayPublishService,
        store_access_service_js_1.StoreAccessService])
], StoresService);
//# sourceMappingURL=stores.service.js.map
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
var ChannelPublishProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelPublishProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const channels_service_js_1 = require("../channels.service.js");
const listing_record_entity_js_1 = require("../../listings/listing-record.entity.js");
const channel_connection_entity_js_1 = require("../entities/channel-connection.entity.js");
const store_entity_js_1 = require("../entities/store.entity.js");
const ebay_publish_service_js_1 = require("../ebay/ebay-publish.service.js");
const ebay_listing_images_util_js_1 = require("../ebay/ebay-listing-images.util.js");
const ebay_listing_condition_util_js_1 = require("../ebay/ebay-listing-condition.util.js");
const partsbazar360_service_js_1 = require("../partsbazar360/partsbazar360.service.js");
const partsbazar360_types_js_1 = require("../partsbazar360/partsbazar360.types.js");
let ChannelPublishProcessor = ChannelPublishProcessor_1 = class ChannelPublishProcessor extends bullmq_1.WorkerHost {
    channelsService;
    ebayPublish;
    partsbazar;
    listingRepo;
    connectionRepo;
    storeRepo;
    eventEmitter;
    logger = new common_1.Logger(ChannelPublishProcessor_1.name);
    constructor(channelsService, ebayPublish, partsbazar, listingRepo, connectionRepo, storeRepo, eventEmitter) {
        super();
        this.channelsService = channelsService;
        this.ebayPublish = ebayPublish;
        this.partsbazar = partsbazar;
        this.listingRepo = listingRepo;
        this.connectionRepo = connectionRepo;
        this.storeRepo = storeRepo;
        this.eventEmitter = eventEmitter;
    }
    async process(job) {
        switch (job.name) {
            case 'publish':
                await this.handlePublish(job);
                break;
            case 'sync-inventory':
                await this.handleSyncInventory(job);
                break;
            case 'update':
                await this.handleUpdate(job);
                break;
            case partsbazar360_service_js_1.PARTSBAZAR360_STATUS_JOB: {
                const data = job.data;
                await this.partsbazar.reconcile(data.instanceId, data.attempt);
                break;
            }
            default:
                this.logger.warn(`Unknown channel job type: ${job.name}`);
        }
    }
    async handlePublish(job) {
        const { connectionId, listingId, overrides, storeId } = job.data;
        this.logger.log(`Publishing listing ${listingId} to connection ${connectionId}`);
        const listing = await this.listingRepo.findOneBy({ id: listingId });
        if (!listing) {
            throw new Error(`Listing ${listingId} not found`);
        }
        const conn = await this.connectionRepo.findOneBy({ id: connectionId });
        if (conn?.channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            const instance = await this.partsbazar.publish(connectionId, listingId, overrides);
            if (instance.syncStatus === 'synced') {
                this.eventEmitter.emit('listing.published', {
                    listingId,
                    channel: partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL,
                    title: listing.title,
                });
            }
            return;
        }
        try {
            if (conn?.channel === 'ebay') {
                const store = await this.storeRepo.findOne({
                    where: storeId ? { id: storeId, connectionId } : { connectionId },
                    order: { isPrimary: 'DESC', createdAt: 'ASC' },
                });
                if (!store) {
                    throw new Error(`No eBay store found for connection ${connectionId}`);
                }
                const stub = this.ebayPublish.stubPublishRequest(listingId, [store.id]);
                if (overrides?.title)
                    stub.title = overrides.title;
                if (overrides?.price != null)
                    stub.price = overrides.price;
                if (overrides?.quantity != null)
                    stub.quantity = overrides.quantity;
                const results = await this.ebayPublish.publish(stub);
                const result = results[0];
                if (!result?.success) {
                    throw new Error(result?.error ?? 'eBay publish failed');
                }
                await this.channelsService.recordEbayPublishSuccess(connectionId, listingId, store.id, result);
            }
            else {
                const listingData = {
                    title: overrides?.title ?? listing.title,
                    description: listing.description,
                    sku: listing.customLabelSku,
                    price: overrides?.price ?? listing.startPrice,
                    quantity: overrides?.quantity ?? 1,
                    categoryId: listing.categoryId,
                    condition: (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(listing.conditionId),
                    brand: listing.cBrand,
                    mpn: listing.cManufacturerPartNumber,
                    imageUrls: listing.itemPhotoUrl
                        ? (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)([listing.itemPhotoUrl]).imageUrls
                        : [],
                };
                await this.channelsService.publishListing(connectionId, listingId, listingData);
            }
            listing.publishedAt = new Date();
            await this.listingRepo.save(listing);
            this.eventEmitter.emit('listing.published', {
                listingId,
                channel: 'unknown',
                title: listing.title,
            });
            this.logger.log(`Published listing ${listingId} successfully`);
        }
        catch (error) {
            this.eventEmitter.emit('channel.error', {
                channel: 'unknown',
                connectionId,
                error: error.message,
            });
            throw error;
        }
    }
    async handleSyncInventory(job) {
        const { connectionId, trigger, channel } = job.data;
        this.logger.log(`Syncing inventory (trigger=${trigger ?? 'manual'}, connection=${connectionId ?? 'all'}, channel=${channel ?? 'all'})`);
        try {
            if (connectionId) {
                await this.channelsService.syncConnectionInventory(connectionId);
            }
            else {
                await this.channelsService.syncAllInventory(channel ?? undefined);
            }
            this.eventEmitter.emit('inventory.synced', {
                trigger,
                connectionId,
                channel,
            });
            this.logger.log('Inventory sync completed successfully');
        }
        catch (error) {
            this.logger.error(`Inventory sync failed: ${error.message}`);
            throw error;
        }
    }
    async handleUpdate(job) {
        const { connectionId, listingId, channelListingId } = job.data;
        this.logger.log(`Updating channel listing ${channelListingId} for listing ${listingId}`);
        const listing = await this.listingRepo.findOneBy({ id: listingId });
        if (!listing) {
            throw new Error(`Listing ${listingId} not found`);
        }
        const conn = await this.connectionRepo.findOneBy({ id: connectionId });
        if (conn?.channel === partsbazar360_types_js_1.PARTSBAZAR360_CHANNEL) {
            await this.partsbazar.publish(connectionId, listingId);
            return;
        }
        const listingData = {
            title: listing.title,
            description: listing.description,
            sku: listing.customLabelSku,
            price: listing.startPrice,
            quantity: 1,
            categoryId: listing.categoryId,
            condition: (0, ebay_listing_condition_util_js_1.mapToEbayConditionEnum)(listing.conditionId),
            brand: listing.cBrand,
            mpn: listing.cManufacturerPartNumber,
            imageUrls: listing.itemPhotoUrl
                ? (0, ebay_listing_images_util_js_1.sanitizeEbayImageUrls)([listing.itemPhotoUrl]).imageUrls
                : [],
        };
        await this.channelsService.publishListing(connectionId, listingId, listingData);
        this.logger.log(`Updated channel listing ${channelListingId} successfully`);
    }
};
exports.ChannelPublishProcessor = ChannelPublishProcessor;
exports.ChannelPublishProcessor = ChannelPublishProcessor = ChannelPublishProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('channels', { concurrency: 2 }),
    __param(3, (0, typeorm_1.InjectRepository)(listing_record_entity_js_1.ListingRecord)),
    __param(4, (0, typeorm_1.InjectRepository)(channel_connection_entity_js_1.ChannelConnection)),
    __param(5, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __metadata("design:paramtypes", [channels_service_js_1.ChannelsService,
        ebay_publish_service_js_1.EbayPublishService,
        partsbazar360_service_js_1.PartsBazar360Service,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], ChannelPublishProcessor);
//# sourceMappingURL=channel-publish.processor.js.map
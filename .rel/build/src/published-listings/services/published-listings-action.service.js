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
var PublishedListingsActionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishedListingsActionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ebay_inventory_api_service_js_1 = require("../../channels/ebay/ebay-inventory-api.service.js");
const ebay_publish_service_js_1 = require("../../channels/ebay/ebay-publish.service.js");
const ebay_trading_api_service_js_1 = require("../../channels/ebay/ebay-trading-api.service.js");
const listing_action_log_writer_service_js_1 = require("../../integrations/ebay/services/listing-action-log-writer.service.js");
const ebay_listing_channel_entity_js_1 = require("../../integrations/ebay/entities/ebay-listing-channel.entity.js");
const ebay_published_listing_entity_js_1 = require("../entities/ebay-published-listing.entity.js");
const published_listings_health_service_js_1 = require("./published-listings-health.service.js");
const published_listings_audit_service_js_1 = require("./published-listings-audit.service.js");
const published_listings_sync_service_js_1 = require("./published-listings-sync.service.js");
let PublishedListingsActionService = PublishedListingsActionService_1 = class PublishedListingsActionService {
    listingRepo;
    channelRepo;
    inventoryApi;
    tradingApi;
    ebayPublish;
    health;
    audit;
    actionLog;
    sync;
    logger = new common_1.Logger(PublishedListingsActionService_1.name);
    constructor(listingRepo, channelRepo, inventoryApi, tradingApi, ebayPublish, health, audit, actionLog, sync) {
        this.listingRepo = listingRepo;
        this.channelRepo = channelRepo;
        this.inventoryApi = inventoryApi;
        this.tradingApi = tradingApi;
        this.ebayPublish = ebayPublish;
        this.health = health;
        this.audit = audit;
        this.actionLog = actionLog;
        this.sync = sync;
    }
    async resolveOfferId(listing) {
        if (listing.offerId)
            return listing.offerId;
        if (listing.ebayListingChannelId) {
            const linked = await this.channelRepo.findOne({
                where: { id: listing.ebayListingChannelId },
            });
            if (linked?.offerId) {
                listing.offerId = linked.offerId;
                await this.listingRepo.update(listing.id, { offerId: linked.offerId });
                return linked.offerId;
            }
        }
        if (listing.ebayItemId) {
            const byItem = await this.channelRepo.findOne({
                where: {
                    ebayAccountId: listing.ebayAccountId,
                    listingId: listing.ebayItemId,
                },
            });
            if (byItem?.offerId) {
                const channelPatch = { offerId: byItem.offerId };
                listing.offerId = byItem.offerId;
                if (byItem.id && !listing.ebayListingChannelId) {
                    listing.ebayListingChannelId = byItem.id;
                    channelPatch.ebayListingChannelId = byItem.id;
                }
                await this.listingRepo.update(listing.id, channelPatch);
                return byItem.offerId;
            }
        }
        if (listing.sku && listing.storeId) {
            try {
                const { offers } = await this.inventoryApi.getOffersBySku(listing.storeId, listing.sku);
                const match = offers?.find((o) => o.listingId === listing.ebayItemId || o.status === 'PUBLISHED') ?? offers?.[0];
                if (match?.offerId) {
                    listing.offerId = match.offerId;
                    await this.listingRepo.update(listing.id, {
                        offerId: match.offerId,
                    });
                    return match.offerId;
                }
            }
            catch (err) {
                this.logger.warn(`getOffersBySku failed for ${listing.sku}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return null;
    }
    async revise(id, organizationId, user, dto) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        if (!listing.sku)
            throw new common_1.BadRequestException('Listing has no SKU');
        const before = {
            title: listing.title,
            description: listing.description,
            price: listing.price,
            quantityAvailable: listing.quantityAvailable,
            imageUrls: listing.imageUrls,
            itemSpecifics: listing.itemSpecifics,
        };
        const storeId = listing.storeId;
        if (dto.title != null ||
            dto.description != null ||
            dto.imageUrls != null ||
            dto.itemSpecifics != null) {
            const current = await this.inventoryApi.getItem(storeId, listing.sku);
            const updatedItem = {
                ...current,
                product: {
                    ...current.product,
                    ...(dto.title != null ? { title: dto.title } : {}),
                    ...(dto.description != null ? { description: dto.description } : {}),
                    ...(dto.imageUrls != null ? { imageUrls: dto.imageUrls } : {}),
                    ...(dto.itemSpecifics != null ? { aspects: dto.itemSpecifics } : {}),
                },
            };
            await this.inventoryApi.createOrReplaceItem(storeId, listing.sku, updatedItem);
            if (listing.offerId && dto.description != null) {
                await this.inventoryApi.updateOffer(storeId, listing.offerId, {
                    listingDescription: dto.description,
                });
            }
        }
        if (dto.price != null || dto.quantity != null) {
            const offerId = await this.resolveOfferId(listing);
            if (!offerId) {
                throw new common_1.BadRequestException('Listing has no offer ID for price/qty update — sync Inventory offers for this SKU first');
            }
            await this.inventoryApi.bulkUpdatePriceQuantity(storeId, [
                {
                    offers: [
                        {
                            offerId,
                            ...(dto.price != null
                                ? {
                                    price: {
                                        value: String(dto.price),
                                        currency: listing.currency ?? 'USD',
                                    },
                                }
                                : {}),
                            ...(dto.quantity != null
                                ? { availableQuantity: dto.quantity }
                                : {}),
                        },
                    ],
                },
            ]);
        }
        await this.sync.syncListingById(listing.id, organizationId);
        const refreshed = await this.listingRepo.findOneByOrFail({ id });
        await this.audit.writeRevision({
            organizationId,
            publishedListingId: listing.id,
            ebayAccountId: listing.ebayAccountId,
            userId: user.id,
            actionType: 'revise',
            ebayItemId: listing.ebayItemId,
            beforeValue: before,
            afterValue: {
                title: refreshed.title,
                description: refreshed.description,
                price: refreshed.price,
                quantityAvailable: refreshed.quantityAvailable,
                imageUrls: refreshed.imageUrls,
                itemSpecifics: refreshed.itemSpecifics,
            },
            apiResult: 'success',
        });
        await this.actionLog.write({
            organizationId,
            userId: user.id,
            ebayAccountId: listing.ebayAccountId,
            marketplaceId: listing.marketplaceId,
            action: 'published_listing.revise',
            beforeSnapshot: before,
            afterSnapshot: {
                title: refreshed.title,
                price: refreshed.price,
                quantityAvailable: refreshed.quantityAvailable,
            },
            result: 'success',
        });
        return refreshed;
    }
    async updatePolicies(id, organizationId, user, dto) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        if (!listing.offerId) {
            throw new common_1.BadRequestException('Listing has no offer ID — cannot update policies');
        }
        const storeId = listing.storeId;
        const account = listing.ebayAccountId;
        const marketplaceId = listing.marketplaceId;
        const fulfillmentPolicyId = dto.fulfillmentPolicyId?.trim() ||
            (dto.shippingProfileName
                ? await this.ebayPublish.resolvePolicyByName(account, marketplaceId, 'fulfillment', dto.shippingProfileName)
                : undefined);
        const paymentPolicyId = dto.paymentPolicyId?.trim() ||
            (dto.paymentProfileName
                ? await this.ebayPublish.resolvePolicyByName(account, marketplaceId, 'payment', dto.paymentProfileName)
                : undefined);
        const returnPolicyId = dto.returnPolicyId?.trim() ||
            (dto.returnProfileName
                ? await this.ebayPublish.resolvePolicyByName(account, marketplaceId, 'return', dto.returnProfileName, listing.categoryId ?? undefined, listing.condition ?? undefined)
                : undefined);
        if (!fulfillmentPolicyId && !paymentPolicyId && !returnPolicyId) {
            throw new common_1.BadRequestException('At least one policy ID or profile name must be provided');
        }
        const before = listing.listingPolicies ?? {};
        const existingOffer = await this.inventoryApi.getOffer(storeId, listing.offerId);
        const newPolicies = {
            ...existingOffer.listingPolicies,
            ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
            ...(paymentPolicyId ? { paymentPolicyId } : {}),
            ...(returnPolicyId ? { returnPolicyId } : {}),
        };
        await this.inventoryApi.updateOffer(storeId, listing.offerId, {
            ...existingOffer,
            listingPolicies: newPolicies,
        });
        await this.inventoryApi.publishOffer(storeId, listing.offerId);
        this.logger.log(`Updated policies on ${listing.sku} (${listing.offerId}): ` +
            `fulfillment=${fulfillmentPolicyId ?? 'unchanged'}, ` +
            `payment=${paymentPolicyId ?? 'unchanged'}, ` +
            `return=${returnPolicyId ?? 'unchanged'}`);
        await this.sync.syncListingById(listing.id, organizationId);
        const refreshed = await this.listingRepo.findOneByOrFail({ id });
        await this.audit.writeRevision({
            organizationId,
            publishedListingId: listing.id,
            ebayAccountId: listing.ebayAccountId,
            userId: user.id,
            actionType: 'revise',
            ebayItemId: listing.ebayItemId,
            beforeValue: { listingPolicies: before },
            afterValue: { listingPolicies: newPolicies },
            apiResult: 'success',
        });
        await this.actionLog.write({
            organizationId,
            userId: user.id,
            ebayAccountId: listing.ebayAccountId,
            marketplaceId: listing.marketplaceId,
            action: 'published_listing.update_policies',
            beforeSnapshot: { listingPolicies: before },
            afterSnapshot: { listingPolicies: newPolicies },
            result: 'success',
        });
        return refreshed;
    }
    async endListing(id, organizationId, user) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        if (!listing.offerId) {
            throw new common_1.BadRequestException('Listing has no offer ID');
        }
        await this.inventoryApi.withdrawOffer(listing.storeId, listing.offerId);
        listing.listingStatus = 'ended';
        listing.lastSyncedAt = new Date();
        await this.listingRepo.save(listing);
        await this.audit.writeRevision({
            organizationId,
            publishedListingId: listing.id,
            ebayAccountId: listing.ebayAccountId,
            userId: user.id,
            actionType: 'end_listing',
            ebayItemId: listing.ebayItemId,
            beforeValue: { listingStatus: 'active' },
            afterValue: { listingStatus: 'ended' },
            apiResult: 'success',
        });
        await this.actionLog.write({
            organizationId,
            userId: user.id,
            ebayAccountId: listing.ebayAccountId,
            marketplaceId: listing.marketplaceId,
            action: 'published_listing.end',
            beforeSnapshot: { listingStatus: 'active' },
            afterSnapshot: { listingStatus: 'ended' },
            result: 'success',
        });
        return listing;
    }
    async relist(id, organizationId, user) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        const oldItemId = listing.ebayItemId;
        if (!oldItemId) {
            throw new common_1.BadRequestException('Listing has no eBay item ID');
        }
        let newItemId;
        const resolvedOfferId = listing.offerId ?? (await this.resolveOfferId(listing));
        if (resolvedOfferId) {
            const details = await this.tradingApi.getItemDetails(listing.storeId, oldItemId, listing.marketplaceId);
            if (details.listingStatus?.toLowerCase() === 'active') {
                listing.listingStatus = 'active';
                listing.lastSyncedAt = new Date();
                await this.listingRepo.save(listing);
                return listing;
            }
            const offer = await this.inventoryApi.getOffer(listing.storeId, resolvedOfferId);
            const input = this.toTradingRelistInput(listing, details, offer);
            try {
                if (offer.status?.toUpperCase() === 'PUBLISHED') {
                    await this.inventoryApi.withdrawOffer(listing.storeId, resolvedOfferId);
                }
                await this.inventoryApi.deleteOffer(listing.storeId, resolvedOfferId);
                const result = await this.tradingApi.addFixedPriceItem(listing.storeId, input, listing.marketplaceId);
                newItemId = result.itemId;
            }
            catch (error) {
                const restoredOffer = await this.restoreInventoryOffer(listing, oldItemId, offer, resolvedOfferId);
                throw new common_1.BadRequestException(`Trading API relist failed; the original Inventory API listing was restored as ${restoredOffer.listingId ?? oldItemId}. ${error instanceof Error ? error.message : String(error)}`);
            }
            listing.offerId = null;
            listing.price = String(input.price);
            listing.quantityAvailable = input.quantity;
            listing.title = input.title;
            listing.description = input.description;
            listing.categoryId = input.categoryId;
            listing.imageUrls = input.imageUrls;
            listing.itemSpecifics = input.itemSpecifics ?? {};
            listing.compatibility =
                input.compatibility ?? null;
            listing.listingPolicies = offer.listingPolicies ?? null;
        }
        else {
            const details = await this.tradingApi.getItemDetails(listing.storeId, oldItemId, listing.marketplaceId);
            if (details.inventoryTrackingMethod &&
                details.inventoryTrackingMethod.toLowerCase() !== 'itemid') {
                throw new common_1.BadRequestException('This ended listing is Inventory API-managed. Refresh its offer mapping before relisting.');
            }
            if (details.listingStatus?.toLowerCase() === 'active') {
                listing.listingStatus = 'active';
                listing.lastSyncedAt = new Date();
                await this.listingRepo.save(listing);
                return listing;
            }
            const result = await this.tradingApi.relistFixedPriceItem(listing.storeId, oldItemId, listing.marketplaceId);
            newItemId = result.itemId;
        }
        listing.ebayItemId = newItemId;
        listing.offerId = null;
        listing.listingStatus = 'active';
        listing.listingUrl = this.health.buildListingUrl(newItemId, listing.marketplaceId, 'production');
        listing.lastSyncedAt = new Date();
        await this.listingRepo.save(listing);
        await this.updateChannelAfterRelist(listing, oldItemId, newItemId, null);
        await this.audit.writeRevision({
            organizationId,
            publishedListingId: listing.id,
            ebayAccountId: listing.ebayAccountId,
            userId: user.id,
            actionType: 'relist',
            ebayItemId: oldItemId,
            beforeValue: { listingStatus: 'ended' },
            afterValue: { listingStatus: 'active', ebayItemId: newItemId },
            apiResult: 'success',
        });
        return listing;
    }
    toTradingRelistInput(listing, details, offer) {
        const policies = offer.listingPolicies ?? {};
        const paymentProfileId = policies.paymentPolicyId ?? details.paymentProfileId;
        const shippingProfileId = policies.fulfillmentPolicyId ?? details.shippingProfileId;
        const returnProfileId = policies.returnPolicyId ?? details.returnProfileId;
        if (!paymentProfileId || !shippingProfileId || !returnProfileId) {
            throw new common_1.BadRequestException('This seller uses eBay business policies. Sync the listing policy IDs before relisting.');
        }
        const price = details.price ??
            Number(offer.pricingSummary?.price?.value ?? listing.price);
        const quantityFromItem = details.quantity == null
            ? 0
            : details.quantity - (details.quantitySold ?? 0);
        const quantity = quantityFromItem > 0
            ? quantityFromItem
            : Number(offer.availableQuantity ?? listing.quantityAvailable);
        const imageUrls = details.imageUrls.length > 0
            ? details.imageUrls
            : (listing.imageUrls ?? []);
        const itemSpecifics = Object.keys(details.itemSpecifics).length
            ? details.itemSpecifics
            : listing.itemSpecifics;
        const categoryId = details.categoryId ?? offer.categoryId ?? listing.categoryId;
        const sku = details.sku ?? listing.sku ?? offer.sku;
        if (!details.title ||
            !(details.description ?? listing.description) ||
            !categoryId ||
            !details.conditionId ||
            !sku ||
            !Number.isFinite(price) ||
            price <= 0 ||
            !Number.isFinite(quantity) ||
            quantity < 1 ||
            imageUrls.length === 0) {
            throw new common_1.BadRequestException('The ended listing is missing required live eBay details for a safe Trading API relist.');
        }
        return {
            title: details.title,
            description: details.description ?? listing.description ?? '',
            categoryId,
            conditionId: details.conditionId,
            conditionDescription: details.conditionDescription ?? undefined,
            quantity: Math.trunc(quantity),
            price,
            currency: details.currency ??
                offer.pricingSummary?.price?.currency ??
                listing.currency,
            sku,
            imageUrls,
            itemSpecifics,
            compatibility: details.compatibility ??
                listing.compatibility,
            listingDuration: details.listingDuration ?? 'GTC',
            location: details.location,
            country: details.country,
            postalCode: details.postalCode,
            paymentProfileId,
            shippingProfileId,
            returnProfileId,
            immediatePayRequired: details.listingDetails.immediatePayRequired,
            bestOfferEnabled: details.listingDetails.bestOfferEnabled,
        };
    }
    async restoreInventoryOffer(listing, oldItemId, offer, offerId) {
        let restoredOfferId = offerId;
        let restoredItemId;
        try {
            const existing = await this.inventoryApi.getOffer(listing.storeId, offerId);
            if (existing.status?.toUpperCase() === 'PUBLISHED') {
                restoredItemId =
                    existing.listing?.listingId ?? existing.listingId ?? oldItemId;
            }
            else if (existing.status?.toUpperCase() === 'UNPUBLISHED') {
                const published = await this.inventoryApi.publishOffer(listing.storeId, offerId);
                restoredItemId = published.listingId ?? oldItemId;
            }
            else {
                throw new Error(`Cannot safely restore Inventory offer in ${existing.status ?? 'unknown'} state`);
            }
        }
        catch (error) {
            const status = error?.response
                ?.status;
            if (status !== 404)
                throw error;
            const payload = { ...offer };
            delete payload.offerId;
            delete payload.listing;
            delete payload.listingId;
            delete payload.status;
            const created = await this.inventoryApi.createOffer(listing.storeId, payload);
            restoredOfferId = created.offerId;
            const published = await this.inventoryApi.publishOffer(listing.storeId, restoredOfferId);
            restoredItemId = published.listingId ?? oldItemId;
        }
        const finalItemId = restoredItemId ?? oldItemId;
        listing.ebayItemId = finalItemId;
        listing.offerId = restoredOfferId;
        listing.listingStatus = 'active';
        listing.listingUrl = this.health.buildListingUrl(finalItemId, listing.marketplaceId, 'production');
        listing.lastSyncedAt = new Date();
        await this.listingRepo.save(listing);
        await this.updateChannelAfterRelist(listing, oldItemId, finalItemId, restoredOfferId);
        return { listingId: finalItemId };
    }
    async updateChannelAfterRelist(listing, oldItemId, newItemId, offerId) {
        let channel = listing.ebayListingChannelId
            ? await this.channelRepo.findOne({
                where: { id: listing.ebayListingChannelId },
            })
            : null;
        channel ??= await this.channelRepo.findOne({
            where: { ebayAccountId: listing.ebayAccountId, listingId: oldItemId },
        });
        if (!channel)
            return;
        channel.listingId = newItemId;
        channel.offerId = offerId;
        channel.ebayInventorySku = offerId
            ? (listing.sku ?? channel.ebayInventorySku)
            : null;
        channel.listingUrl = listing.listingUrl;
        channel.channelPrice = listing.price ?? channel.channelPrice;
        channel.channelQuantity = listing.quantityAvailable;
        channel.listingStatus = 'published';
        channel.lastRevisedAt = new Date();
        channel.lastSyncedAt = new Date();
        channel.lastErrorCode = null;
        channel.lastErrorMessage = null;
        await this.channelRepo.save(channel);
    }
    async refreshListing(id, organizationId, user) {
        const listing = await this.listingRepo.findOne({
            where: { id, organizationId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Published listing not found');
        const { syncLogIds } = await this.sync.enqueueSync({
            organizationId,
            ebayAccountId: listing.ebayAccountId,
            userId: user.id,
            listingIds: [id],
        });
        if (syncLogIds.length) {
            await this.sync.syncAccount({
                organizationId,
                ebayAccountId: listing.ebayAccountId,
                userId: user.id,
                syncLogId: syncLogIds[0],
                listingIds: [id],
                trigger: 'single',
            });
        }
        return this.listingRepo.findOneByOrFail({ id });
    }
};
exports.PublishedListingsActionService = PublishedListingsActionService;
exports.PublishedListingsActionService = PublishedListingsActionService = PublishedListingsActionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ebay_published_listing_entity_js_1.EbayPublishedListing)),
    __param(1, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        ebay_trading_api_service_js_1.EbayTradingApiService,
        ebay_publish_service_js_1.EbayPublishService,
        published_listings_health_service_js_1.PublishedListingsHealthService,
        published_listings_audit_service_js_1.PublishedListingsAuditService,
        listing_action_log_writer_service_js_1.ListingActionLogWriterService,
        published_listings_sync_service_js_1.PublishedListingsSyncService])
], PublishedListingsActionService);
//# sourceMappingURL=published-listings-action.service.js.map
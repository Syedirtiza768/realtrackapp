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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionListingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const fashion_review_entity_js_1 = require("./entities/fashion-review.entity.js");
const verticals_service_js_1 = require("./verticals.service.js");
const fashion_config_js_1 = require("./fashion.config.js");
let FashionListingsService = class FashionListingsService {
    db;
    organizations;
    stores;
    verticals;
    inventory;
    constructor(db, organizations, stores, verticals, inventory) {
        this.db = db;
        this.organizations = organizations;
        this.stores = stores;
        this.verticals = verticals;
        this.inventory = inventory;
    }
    async detail(user, id, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        return this.publicProduct(await this.product(this.db.manager, id, org.organizationId));
    }
    async create(user, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        if (!dto.sku.trim() || !dto.title.trim())
            throw new common_1.ConflictException('SKU and title cannot be blank');
        const replay = async () => {
            if (!dto.captureId)
                return null;
            const product = await this.db.getRepository(catalog_product_entity_js_1.CatalogProduct).findOneBy({
                organizationId: org.organizationId, vertical: 'fashion', sku: dto.sku.trim(),
            });
            return product?.verticalAttributes?._captureId === dto.captureId &&
                product.verticalAttributes._createdByUserId === user.id
                ? this.publicProduct(product) : null;
        };
        const existing = await replay();
        if (existing)
            return existing;
        const attributes = this.attributes(dto.verticalAttributes);
        if (dto.captureId)
            attributes._captureId = dto.captureId;
        const fromCapture = attributes._intakeSource === 'capture';
        attributes._createdByUserId = user.id;
        if (!fromCapture) {
            attributes._catalogAdded = true;
            attributes._catalogAddedBy = user.id;
        }
        try {
            return await this.db.transaction(async (manager) => {
                const repo = manager.getRepository(catalog_product_entity_js_1.CatalogProduct);
                if (await repo.existsBy({ sku: dto.sku.trim() }))
                    throw new common_1.ConflictException('SKU already exists; current catalog requires globally unique SKUs');
                const saved = await repo.save(repo.create({
                    organizationId: org.organizationId,
                    vertical: 'fashion',
                    sku: dto.sku.trim(),
                    title: dto.title.trim(),
                    description: dto.description?.trim() || null,
                    brand: dto.brand?.trim() || null,
                    conditionId: dto.conditionId || null,
                    price: dto.price ?? null,
                    quantity: dto.quantity ?? 0,
                    imageUrls: dto.imageUrls ?? [],
                    categoryId: dto.categoryId || null,
                    categoryName: dto.categoryName || null,
                    verticalAttributes: attributes,
                    verticalValidationStatus: 'draft',
                    fitmentData: null,
                    optimizationStatus: 'not_applicable',
                    fitmentStatus: 'not_applicable',
                }));
                if (!fromCapture) {
                    saved.verticalAttributes = {
                        ...(saved.verticalAttributes ?? {}),
                        _catalogAddedAt: saved.createdAt.toISOString(),
                    };
                    await repo.save(saved);
                }
                await this.saveReview(manager, saved, null, {
                    status: 'pending',
                    authenticityConfirmed: false,
                });
                await this.audit(manager, saved, user.id, 'fashion.draft.created', 'success');
                return this.publicProduct(saved);
            });
        }
        catch (error) {
            if (error instanceof common_1.ConflictException || error.code === '23505') {
                const saved = await replay();
                if (saved)
                    return saved;
            }
            if (error.code === '23505')
                throw new common_1.ConflictException('SKU already exists');
            throw error;
        }
    }
    async update(user, id, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        return this.db.transaction(async (manager) => {
            const product = await this.product(manager, id, org.organizationId, true);
            const review = await this.assertMutable(manager, product);
            if (dto.sku !== undefined && dto.sku !== product.sku)
                throw new common_1.ConflictException('SKU is immutable');
            if (dto.title !== undefined && !dto.title.trim())
                throw new common_1.ConflictException('Title cannot be blank');
            const before = this.publicProduct(product);
            Object.assign(product, {
                ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
                ...(dto.description !== undefined
                    ? { description: dto.description.trim() || null }
                    : {}),
                ...(dto.brand !== undefined ? { brand: dto.brand.trim() || null } : {}),
                ...(dto.conditionId !== undefined
                    ? { conditionId: dto.conditionId }
                    : {}),
                ...(dto.price !== undefined ? { price: dto.price } : {}),
                ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
                ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
                ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
                ...(dto.categoryName !== undefined
                    ? { categoryName: dto.categoryName }
                    : {}),
                verticalAttributes: this.attributes(dto.verticalAttributes ?? product.verticalAttributes ?? {}),
                verticalValidationStatus: 'needs_review',
            });
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
            await this.saveReview(manager, product, review, {
                status: 'pending',
                authenticityConfirmed: false,
                reviewedByUserId: null,
                reviewedAt: null,
            });
            await this.audit(manager, product, user.id, 'fashion.draft.updated', 'success', before, this.publicProduct(product));
            return this.publicProduct(product);
        });
    }
    async review(user, id, dto, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        return this.db.transaction(async (manager) => {
            const product = await this.product(manager, id, org.organizationId, true);
            const previous = await this.assertMutable(manager, product);
            if (dto.decision === 'approved' && dto.authenticityConfirmed !== true)
                throw new common_1.ConflictException('Explicit authenticity confirmation is required before approval');
            const saved = await this.saveReview(manager, product, previous, {
                status: dto.decision,
                authenticityConfirmed: dto.authenticityConfirmed,
                evidenceKeys: dto.evidenceKeys ?? previous?.evidenceKeys ?? [],
                notes: dto.notes?.trim() || null,
                reviewedByUserId: user.id,
                reviewedAt: new Date(),
            });
            product.verticalValidationStatus = dto.decision;
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
            await this.audit(manager, product, user.id, 'fashion.review.' + dto.decision, 'success', { status: previous?.status ?? 'pending' }, {
                status: saved.status,
                authenticityConfirmed: saved.authenticityConfirmed,
                evidenceCount: saved.evidenceKeys.length,
            });
            return {
                listing: this.publicProduct(product),
                review: this.reviewSummary(saved),
            };
        });
    }
    async getReview(user, id, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        await this.product(this.db.manager, id, org.organizationId);
        const review = await this.db
            .getRepository(fashion_review_entity_js_1.FashionReview)
            .findOneBy({ catalogProductId: id, organizationId: org.organizationId });
        return (review ?? {
            catalogProductId: id,
            organizationId: org.organizationId,
            status: 'pending',
            authenticityConfirmed: false,
            evidenceKeys: [],
            notes: null,
            reviewedByUserId: null,
            reviewedAt: null,
        });
    }
    async quarantine(user, id, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        await this.db.transaction(async (manager) => {
            const product = await this.product(manager, id, org.organizationId, true);
            product.verticalValidationStatus = 'quarantined';
            product.manualReview = true;
            await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).save(product);
            const previous = await manager.getRepository(fashion_review_entity_js_1.FashionReview).findOneBy({
                catalogProductId: id,
                organizationId: org.organizationId,
            });
            await this.saveReview(manager, product, previous, {
                status: 'quarantined',
                authenticityConfirmed: false,
                reviewedByUserId: user.id,
                reviewedAt: new Date(),
            });
            await this.audit(manager, product, user.id, 'fashion.quarantine', 'blocked');
        });
        const channels = await this.db.getRepository(ebay_listing_channel_entity_js_1.EbayListingChannel).find({
            where: { catalogProductId: id, organizationId: org.organizationId },
        });
        const results = await Promise.all(channels.map(async (channel) => {
            try {
                return await this.withdraw(channel, org.organizationId, user.id);
            }
            catch {
                return {
                    id: channel.id,
                    status: 'failed',
                    remoteRemovalVerified: false,
                };
            }
        }));
        return {
            id,
            status: 'quarantined',
            remoteTakedown: !results.length
                ? 'no_tracked_publications'
                : results.every((result) => result.remoteRemovalVerified)
                    ? 'verified'
                    : 'incomplete',
            targets: results,
        };
    }
    async incidents(user, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const products = await this.db.getRepository(catalog_product_entity_js_1.CatalogProduct).find({
            where: {
                organizationId: org.organizationId,
                vertical: 'fashion',
                verticalValidationStatus: 'quarantined',
            },
            order: { updatedAt: 'DESC' },
            take: 200,
        });
        return Promise.all(products.map(async (product) => ({
            ...this.publicProduct(product),
            targets: (await this.db.getRepository(ebay_listing_channel_entity_js_1.EbayListingChannel).find({
                where: {
                    catalogProductId: product.id,
                    organizationId: org.organizationId,
                },
            })).map((channel) => ({
                id: channel.id,
                ebayAccountId: channel.ebayAccountId,
                marketplaceId: channel.marketplaceId,
                status: channel.listingStatus,
                lastErrorMessage: channel.lastErrorMessage,
                remoteRemovalVerified: channel.listingStatus === 'ended' &&
                    channel.lastSyncedAt !== null &&
                    !channel.lastErrorCode,
            })),
        })));
    }
    async end(user, channelId, organizationId) {
        const org = await this.organizations.resolveOrganizationId(user.id, organizationId);
        const channel = await this.db
            .getRepository(ebay_listing_channel_entity_js_1.EbayListingChannel)
            .findOneBy({ id: channelId, organizationId: org.organizationId });
        if (!channel)
            throw new common_1.NotFoundException('Fashion publication not found');
        await this.product(this.db.manager, channel.catalogProductId, org.organizationId);
        const account = await this.account(channel.ebayAccountId, org.organizationId);
        await this.stores.assertStoreAccess(user, account.primaryStoreId, 'operate');
        return this.withdraw(channel, org.organizationId, user.id);
    }
    async account(id, organizationId) {
        const account = await this.db.getRepository(connected_ebay_account_entity_js_1.ConnectedEbayAccount).findOne({
            where: { id, organizationId },
            relations: ['primaryStore', 'marketplaces'],
        });
        if (!account?.primaryStore)
            throw new common_1.NotFoundException('Fashion eBay account not found');
        const config = this.verticals.getStoreConfig(account.primaryStore);
        if (config.enabledVerticals.length !== 1 ||
            config.enabledVerticals[0] !== 'fashion' ||
            (account.primaryStore.organizationId &&
                account.primaryStore.organizationId !== organizationId))
            throw new common_1.ForbiddenException('Seller store must belong exclusively to this Fashion workspace');
        return account;
    }
    async containIfBlocked(channel, userId) {
        try {
            await this.assertApproved(channel.catalogProductId, channel.organizationId);
            return null;
        }
        catch (error) {
            if (!(error instanceof common_1.ConflictException ||
                error instanceof common_1.NotFoundException))
                throw error;
            return this.withdraw(channel, channel.organizationId, userId);
        }
    }
    async withdraw(channel, organizationId, userId) {
        const product = await this.product(this.db.manager, channel.catalogProductId, organizationId);
        try {
            const account = await this.account(channel.ebayAccountId, organizationId);
            if (channel.vertical && channel.vertical !== 'fashion')
                throw new common_1.ForbiddenException('Publication belongs to another vertical');
            if (!channel.offerId)
                throw new common_1.ConflictException('No Inventory API offer ID; manual marketplace removal and reconciliation required');
            await this.audit(this.db.manager, product, userId, 'fashion.withdraw.attempt', 'processing', undefined, { channelId: channel.id, offerId: channel.offerId });
            const before = await this.inventory.getOffer(account.primaryStoreId, channel.offerId);
            if (before.status?.toUpperCase() !== 'UNPUBLISHED')
                await this.inventory.withdrawOffer(account.primaryStoreId, channel.offerId);
            const remote = await this.inventory.getOffer(account.primaryStoreId, channel.offerId);
            if (remote.status?.toUpperCase() !== 'UNPUBLISHED')
                throw new common_1.ConflictException('eBay has not confirmed that the offer is unpublished');
            channel.listingStatus = 'ended';
            channel.lastSyncedAt = new Date();
            channel.lastErrorCode = null;
            channel.lastErrorMessage = null;
            await this.db.getRepository(ebay_listing_channel_entity_js_1.EbayListingChannel).save(channel);
            await this.audit(this.db.manager, product, userId, 'fashion.withdraw.verified', 'success', undefined, { channelId: channel.id, offerId: channel.offerId });
            return { id: channel.id, status: 'ended', remoteRemovalVerified: true };
        }
        catch (error) {
            channel.lastErrorCode = 'FASHION_WITHDRAW_UNVERIFIED';
            channel.lastErrorMessage =
                error instanceof common_1.ConflictException ||
                    error instanceof common_1.ForbiddenException
                    ? error.message
                    : 'Withdrawal could not be verified. Check store authorization and retry the quarantine action.';
            await this.db.getRepository(ebay_listing_channel_entity_js_1.EbayListingChannel).save(channel);
            await this.audit(this.db.manager, product, userId, 'fashion.withdraw.failed', 'failed', undefined, { channelId: channel.id, message: channel.lastErrorMessage });
            return {
                id: channel.id,
                status: 'failed',
                remoteRemovalVerified: false,
                message: channel.lastErrorMessage,
            };
        }
    }
    async assertApproved(id, organizationId) {
        const product = await this.product(this.db.manager, id, organizationId);
        const review = await this.assertMutable(this.db.manager, product);
        if (product.verticalValidationStatus !== 'approved' ||
            review?.status !== 'approved' ||
            !review.authenticityConfirmed)
            throw new common_1.ConflictException('Fashion review must be explicitly approved before publishing');
        return product;
    }
    async product(manager, id, organizationId, lock = false) {
        const product = await manager.getRepository(catalog_product_entity_js_1.CatalogProduct).findOne({
            where: { id, organizationId, vertical: 'fashion' },
            ...(lock ? { lock: { mode: 'pessimistic_write' } } : {}),
        });
        if (!product)
            throw new common_1.NotFoundException('Fashion listing not found');
        return product;
    }
    async assertMutable(manager, product) {
        const reviews = await manager.getRepository(fashion_review_entity_js_1.FashionReview).find({
            where: {
                catalogProductId: product.id,
                organizationId: product.organizationId,
            },
        });
        if (product.manualReview ||
            product.verticalValidationStatus === 'quarantined' ||
            reviews.some((review) => review.status === 'quarantined'))
            throw new common_1.ForbiddenException('Quarantined listings cannot be edited or approved; separate authorized incident resolution is required');
        return reviews[0] ?? null;
    }
    attributes(input) {
        const result = (0, fashion_config_js_1.validateFashionAttributes)(input);
        if (result.errors.length)
            throw new common_1.ConflictException(result.errors);
        return result.attributes;
    }
    async saveReview(manager, product, previous, patch) {
        return manager.getRepository(fashion_review_entity_js_1.FashionReview).save(manager.getRepository(fashion_review_entity_js_1.FashionReview).create({
            organizationId: product.organizationId,
            catalogProductId: product.id,
            evidenceKeys: [],
            notes: null,
            reviewedByUserId: null,
            reviewedAt: null,
            ...previous,
            ...patch,
        }));
    }
    async audit(manager, product, userId, action, result, before, after) {
        await manager.getRepository(listing_action_log_entity_js_1.ListingActionLog).save({
            organizationId: product.organizationId,
            catalogProductId: product.id,
            userId,
            action,
            result,
            beforeSnapshot: before ?? null,
            afterSnapshot: after ?? null,
        });
    }
    publicProduct(product) {
        return {
            id: product.id,
            sku: product.sku,
            title: product.title,
            description: product.description,
            brand: product.brand,
            conditionId: product.conditionId,
            price: product.price,
            quantity: product.quantity,
            imageUrls: product.imageUrls,
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            vertical: product.vertical,
            verticalAttributes: product.verticalAttributes,
            verticalValidationStatus: product.verticalValidationStatus,
            manualReview: product.manualReview,
            updatedAt: product.updatedAt,
        };
    }
    reviewSummary(review) {
        return {
            id: review.id,
            status: review.status,
            authenticityConfirmed: review.authenticityConfirmed,
            reviewedByUserId: review.reviewedByUserId,
            reviewedAt: review.reviewedAt,
            notes: review.notes,
            evidenceCount: review.evidenceKeys.length,
        };
    }
};
exports.FashionListingsService = FashionListingsService;
exports.FashionListingsService = FashionListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        user_organization_service_js_1.UserOrganizationService,
        store_access_service_js_1.StoreAccessService,
        verticals_service_js_1.VerticalsService,
        ebay_inventory_api_service_js_1.EbayInventoryApiService])
], FashionListingsService);
//# sourceMappingURL=fashion-listings.service.js.map
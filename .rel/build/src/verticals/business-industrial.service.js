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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessIndustrialService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_2 = require("typeorm");
const node_crypto_1 = require("node:crypto");
const organization_member_entity_js_1 = require("../auth/entities/organization-member.entity.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const user_organization_service_js_1 = require("../auth/user-organization.service.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const ebay_listing_channel_entity_js_1 = require("../integrations/ebay/entities/ebay-listing-channel.entity.js");
const store_entity_js_1 = require("../channels/entities/store.entity.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const ebay_inventory_api_service_js_1 = require("../channels/ebay/ebay-inventory-api.service.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const permission_registry_js_1 = require("../rbac/permission-registry.js");
const verticals_service_js_1 = require("./verticals.service.js");
const business_industrial_config_js_1 = require("./business-industrial.config.js");
const business_industrial_incident_entity_js_1 = require("./entities/business-industrial-incident.entity.js");
const business_industrial_review_entity_js_1 = require("./entities/business-industrial-review.entity.js");
const business_industrial_unit_entity_js_1 = require("./entities/business-industrial-unit.entity.js");
const BI_VERTICAL = 'business_industrial';
const BI_ROLES = new Set([
    permission_registry_js_1.ROLE_SLUGS.BUSINESS_INDUSTRIAL_ADMIN,
    permission_registry_js_1.ROLE_SLUGS.BUSINESS_INDUSTRIAL_MANAGER,
    permission_registry_js_1.ROLE_SLUGS.BUSINESS_INDUSTRIAL_OPERATOR,
]);
let BusinessIndustrialService = class BusinessIndustrialService {
    verticals;
    userOrgs;
    storeAccess;
    rbac;
    events;
    inventory;
    productRepo;
    reviewRepo;
    unitRepo;
    incidentRepo;
    storeRepo;
    channelRepo;
    accountRepo;
    memberRepo;
    userRepo;
    constructor(verticals, userOrgs, storeAccess, rbac, events, inventory, productRepo, reviewRepo, unitRepo, incidentRepo, storeRepo, channelRepo, accountRepo, memberRepo, userRepo) {
        this.verticals = verticals;
        this.userOrgs = userOrgs;
        this.storeAccess = storeAccess;
        this.rbac = rbac;
        this.events = events;
        this.inventory = inventory;
        this.productRepo = productRepo;
        this.reviewRepo = reviewRepo;
        this.unitRepo = unitRepo;
        this.incidentRepo = incidentRepo;
        this.storeRepo = storeRepo;
        this.channelRepo = channelRepo;
        this.accountRepo = accountRepo;
        this.memberRepo = memberRepo;
        this.userRepo = userRepo;
    }
    async assertEnabled() {
        await this.verticals.assertFeatureEnabled();
    }
    categoryFamilies() {
        return business_industrial_config_js_1.BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES;
    }
    resolveOrganization(user, organizationId) {
        return this.userOrgs.resolveOrganizationId(user.id, organizationId);
    }
    async workspace(user, organizationId) {
        await this.assertEnabled();
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const stores = await this.authorizedStores(user, org.organizationId);
        const [listingCount, draftCount, pendingReviewCount, incidentCount] = await Promise.all([
            this.productRepo.count({
                where: { organizationId: org.organizationId, vertical: BI_VERTICAL },
            }),
            this.productRepo.count({
                where: {
                    organizationId: org.organizationId,
                    vertical: BI_VERTICAL,
                    verticalValidationStatus: (0, typeorm_2.In)(['draft', 'needs_review']),
                },
            }),
            this.reviewRepo.count({
                where: { organizationId: org.organizationId, status: 'pending' },
            }),
            this.incidentRepo.count({
                where: {
                    organizationId: org.organizationId,
                    status: (0, typeorm_2.In)([
                        'received',
                        'quarantined',
                        'takedown_pending',
                        'escalated',
                    ]),
                },
            }),
        ]);
        return {
            organizationId: org.organizationId,
            organizationRole: org.member.role,
            categoryFamilies: business_industrial_config_js_1.BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES,
            stores: stores.map((store) => this.storeSummary(store)),
            metrics: {
                listingCount,
                draftCount,
                pendingReviewCount,
                openIncidentCount: incidentCount,
            },
        };
    }
    async listListings(user, organizationId, limit = 50) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const products = await this.productRepo.find({
            where: { organizationId: org.organizationId, vertical: BI_VERTICAL },
            order: { updatedAt: 'DESC' },
            take: Math.min(Math.max(Number(limit) || 50, 1), 200),
        });
        return Promise.all(products.map((product) => this.publicProduct(product)));
    }
    async createListing(user, dto, organizationId) {
        await this.assertEnabled();
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const sku = dto.sku.trim();
        const existing = await this.productRepo.findOne({
            where: { organizationId: org.organizationId, sku },
        });
        if (existing)
            throw new common_1.ConflictException(`SKU ${sku} already exists in this organization`);
        const attributes = this.normalizeAttributes(dto.verticalAttributes, dto);
        this.assertUnitPayload(attributes, dto.units);
        const saved = await this.productRepo.save(this.productRepo.create({
            organizationId: org.organizationId,
            vertical: BI_VERTICAL,
            verticalAttributes: attributes,
            verticalValidationStatus: 'needs_review',
            sku,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            brand: dto.brand?.trim() ||
                (typeof attributes.manufacturer === 'string'
                    ? attributes.manufacturer
                    : null),
            mpn: dto.mpn?.trim() ||
                (typeof attributes.mpn === 'string' ? attributes.mpn : null),
            conditionId: dto.conditionId?.trim() || null,
            conditionLabel: dto.conditionLabel?.trim() || null,
            price: dto.price ?? null,
            quantity: dto.quantity ?? this.quantityFromAttributes(attributes),
            imageUrls: dto.imageUrls ?? [],
            categoryId: dto.categoryId?.trim() || null,
            categoryName: dto.categoryName?.trim() || null,
            fitmentData: null,
            optimizationStatus: dto.optimizedTitle || dto.optimizedDescription
                ? 'completed'
                : 'not_applicable',
            optimizedTitle: dto.optimizedTitle?.trim() || null,
            optimizedDescription: dto.optimizedDescription?.trim() || null,
            optimizationPayload: dto.optimizationPayload ?? null,
            seoScore: scoreAsRatio(dto.seoScore),
            readinessScore: scoreAsRatio(dto.readinessScore),
            optimizedAt: dto.optimizedTitle || dto.optimizedDescription ? new Date() : null,
            fitmentStatus: 'not_applicable',
            manualReview: false,
        }));
        await this.saveUnits(org.organizationId, saved.id, attributes, dto.units);
        await this.ensurePendingReview(org.organizationId, saved);
        return this.publicProduct(saved);
    }
    async updateListing(user, id, dto, organizationId) {
        const product = await this.findProduct(user, id, organizationId);
        await this.assertMutable(product);
        const attributes = this.normalizeAttributes(dto.verticalAttributes === undefined
            ? product.verticalAttributes
            : { ...(product.verticalAttributes ?? {}), ...dto.verticalAttributes }, dto);
        this.assertUnitPayload(attributes, dto.units);
        Object.assign(product, {
            ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
            ...(dto.description !== undefined
                ? { description: dto.description.trim() || null }
                : {}),
            ...(dto.brand !== undefined ? { brand: dto.brand.trim() || null } : {}),
            ...(dto.mpn !== undefined ? { mpn: dto.mpn.trim() || null } : {}),
            ...(dto.conditionId !== undefined
                ? { conditionId: dto.conditionId.trim() || null }
                : {}),
            ...(dto.conditionLabel !== undefined
                ? { conditionLabel: dto.conditionLabel.trim() || null }
                : {}),
            ...(dto.price !== undefined ? { price: dto.price } : {}),
            ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
            ...(dto.imageUrls !== undefined ? { imageUrls: dto.imageUrls } : {}),
            ...(dto.categoryId !== undefined
                ? { categoryId: dto.categoryId.trim() || null }
                : {}),
            ...(dto.categoryName !== undefined
                ? { categoryName: dto.categoryName.trim() || null }
                : {}),
            verticalAttributes: attributes,
            verticalValidationStatus: 'needs_review',
            manualReview: false,
        });
        const saved = await this.productRepo.save(product);
        if (dto.units !== undefined) {
            await this.unitRepo.delete({
                organizationId: product.organizationId,
                catalogProductId: product.id,
            });
            await this.saveUnits(product.organizationId, product.id, attributes, dto.units);
        }
        await this.reviewRepo.update({ organizationId: product.organizationId, catalogProductId: product.id }, {
            status: 'pending',
            provenanceConfirmed: false,
            specificationsVerified: false,
            testingReviewed: false,
            restrictedCategoryCleared: false,
            reviewedByUserId: null,
            reviewedAt: null,
            reviewedProductUpdatedAt: null,
        });
        return this.publicProduct(saved);
    }
    async reviewListing(user, id, dto, organizationId) {
        const product = await this.findProduct(user, id, organizationId);
        await this.assertMutable(product);
        const orgId = product.organizationId;
        const attributes = (0, business_industrial_config_js_1.validateBusinessIndustrialAttributes)(product.verticalAttributes ?? {});
        if (dto.decision === 'approved') {
            if (!dto.provenanceConfirmed ||
                !dto.specificationsVerified ||
                !dto.testingReviewed)
                throw new common_1.BadRequestException('Approval requires provenance, specification, and testing confirmations');
            if ((0, business_industrial_config_js_1.isRestrictedBusinessIndustrialFamily)(attributes.attributes.categoryFamily) &&
                !dto.restrictedCategoryCleared)
                throw new common_1.BadRequestException('Restricted categories require explicit compliance clearance before approval');
            if (dto.riskFlags?.length)
                throw new common_1.BadRequestException('Resolve all risk flags before approval');
            if (attributes.errors.length)
                throw new common_1.BadRequestException({
                    message: 'Product attributes are invalid',
                    errors: attributes.errors,
                });
            if (!product.categoryId?.trim())
                throw new common_1.BadRequestException('An eBay leaf category is required before approval');
        }
        const review = await this.reviewRepo.findOne({
            where: { organizationId: orgId, catalogProductId: product.id },
        });
        const savedReview = await this.reviewRepo.save(Object.assign(review ??
            this.reviewRepo.create({
                organizationId: orgId,
                catalogProductId: product.id,
            }), {
            status: dto.decision,
            provenanceConfirmed: dto.provenanceConfirmed,
            specificationsVerified: dto.specificationsVerified,
            testingReviewed: dto.testingReviewed,
            restrictedCategoryCleared: dto.restrictedCategoryCleared ?? false,
            evidenceKeys: dto.evidenceKeys ?? review?.evidenceKeys ?? [],
            riskFlags: dto.riskFlags ?? [],
            reviewedByUserId: user.id,
            notes: dto.notes?.trim() || null,
            reviewedAt: new Date(),
            reviewedProductUpdatedAt: product.updatedAt,
        }));
        product.verticalValidationStatus = dto.decision;
        product.manualReview = false;
        await this.productRepo.save(product);
        return {
            listing: await this.publicProduct(product),
            review: this.reviewSummary(savedReview),
        };
    }
    async listReviews(user, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const reviewCandidates = await this.productRepo.find({
            where: {
                organizationId: org.organizationId,
                vertical: BI_VERTICAL,
                verticalValidationStatus: (0, typeorm_2.In)([
                    'draft',
                    'needs_review',
                    'rejected',
                    'quarantined',
                ]),
            },
            order: { updatedAt: 'ASC' },
            take: 200,
        });
        const existingReviews = await this.reviewRepo.find({
            where: { organizationId: org.organizationId },
        });
        const existingProductIds = new Set(existingReviews.map((review) => review.catalogProductId));
        for (const product of reviewCandidates) {
            if (!existingProductIds.has(product.id))
                await this.ensurePendingReview(org.organizationId, product);
        }
        const reviews = await this.reviewRepo.find({
            where: {
                organizationId: org.organizationId,
                status: (0, typeorm_2.In)(['pending', 'rejected', 'quarantined']),
            },
            order: { updatedAt: 'ASC' },
            take: 200,
        });
        const products = reviews.length
            ? await this.productRepo.find({
                where: {
                    organizationId: org.organizationId,
                    vertical: BI_VERTICAL,
                    id: (0, typeorm_2.In)(reviews.map((review) => review.catalogProductId)),
                },
            })
            : [];
        const byId = new Map(products.map((product) => [product.id, product]));
        return Promise.all(reviews.map(async (review) => ({
            ...this.reviewSummary(review),
            listing: byId.get(review.catalogProductId)
                ? await this.publicProduct(byId.get(review.catalogProductId))
                : null,
        })));
    }
    async getPrivateReview(user, id, organizationId) {
        const product = await this.findProduct(user, id, organizationId);
        const review = await this.reviewRepo.findOne({
            where: { organizationId: product.organizationId, catalogProductId: id },
        });
        if (!review)
            throw new common_1.NotFoundException('Business & Industrial review not found');
        const units = await this.unitRepo.find({
            where: { organizationId: product.organizationId, catalogProductId: id },
            order: { createdAt: 'ASC' },
        });
        return { review, units };
    }
    async allocateUnit(user, unitId, dto, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const unit = await this.unitRepo.findOne({
            where: { id: unitId, organizationId: org.organizationId },
        });
        if (!unit)
            throw new common_1.NotFoundException('Business & Industrial unit not found');
        const product = await this.productRepo.findOne({
            where: {
                id: unit.catalogProductId,
                organizationId: org.organizationId,
                vertical: BI_VERTICAL,
            },
        });
        if (!product)
            throw new common_1.NotFoundException('Business & Industrial listing not found');
        if (product.verticalAttributes?.inventoryMode !== 'serialized')
            throw new common_1.BadRequestException('Only serialized inventory can be allocated by physical unit');
        await this.assertBusinessIndustrialStore(user, dto.storeId, org.organizationId, 'operate');
        const result = await this.unitRepo.update({ id: unitId, organizationId: org.organizationId, status: 'available' }, {
            status: 'allocated',
            allocatedStoreId: dto.storeId,
            allocatedOfferId: dto.offerId?.trim() || null,
        });
        if (!result.affected)
            throw new common_1.ConflictException('Business & Industrial unit is no longer available');
        const saved = await this.unitRepo.findOne({
            where: { id: unitId, organizationId: org.organizationId },
        });
        if (!saved)
            throw new common_1.NotFoundException('Business & Industrial unit not found after allocation');
        return this.unitPublic(saved);
    }
    async markUnitSold(user, unitId, dto, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const unit = await this.unitRepo.findOne({
            where: { id: unitId, organizationId: org.organizationId },
        });
        if (!unit)
            throw new common_1.NotFoundException('Business & Industrial unit not found');
        if (!unit.allocatedStoreId)
            throw new common_1.ConflictException('Only an allocated Business & Industrial unit can be marked sold');
        await this.assertBusinessIndustrialStore(user, unit.allocatedStoreId, org.organizationId, 'operate');
        const where = {
            id: unitId,
            organizationId: org.organizationId,
            status: 'allocated',
        };
        if (dto.offerId?.trim())
            where.allocatedOfferId = dto.offerId.trim();
        const result = await this.unitRepo.update(where, { status: 'sold' });
        if (!result.affected)
            throw new common_1.ConflictException('Business & Industrial unit is no longer allocated or the offer does not match');
        const saved = await this.unitRepo.findOne({
            where: { id: unitId, organizationId: org.organizationId },
        });
        if (!saved)
            throw new common_1.NotFoundException('Business & Industrial unit not found after sale');
        return this.unitPublic(saved);
    }
    async quarantine(user, id, organizationId, note) {
        const product = await this.findProduct(user, id, organizationId);
        const result = await this.applyLocalQuarantine(product, user.id, note ?? 'Manual Business & Industrial quarantine');
        const channels = await this.channelRepo.find({
            where: {
                organizationId: product.organizationId,
                catalogProductId: product.id,
                vertical: BI_VERTICAL,
            },
        });
        const targets = await Promise.all(channels.map((channel) => this.withdrawChannel(channel)));
        this.events.emit('business-industrial.incident', {
            organizationId: product.organizationId,
            productId: product.id,
            status: 'quarantined',
        });
        return {
            ...result,
            remoteTakedown: !targets.length
                ? 'no_tracked_publications'
                : targets.every((target) => target.remoteRemovalVerified)
                    ? 'verified'
                    : 'incomplete',
            targets,
        };
    }
    async createIncident(user, dto, organizationId) {
        if (!dto.verified)
            throw new common_1.BadRequestException('Only verified enforcement signals may trigger quarantine');
        const product = await this.findProduct(user, dto.catalogProductId, organizationId);
        const orgId = product.organizationId;
        const existing = await this.incidentRepo.findOne({
            where: {
                organizationId: orgId,
                externalEventId: dto.externalEventId.trim(),
            },
        });
        if (existing)
            return this.incidentSummary(existing);
        const channels = await this.channelRepo.find({
            where: {
                organizationId: orgId,
                catalogProductId: product.id,
                vertical: BI_VERTICAL,
                listingStatus: 'published',
            },
        });
        const incident = await this.incidentRepo.save(this.incidentRepo.create({
            organizationId: orgId,
            catalogProductId: product.id,
            externalEventId: dto.externalEventId.trim(),
            incidentType: dto.incidentType,
            status: channels.length ? 'takedown_pending' : 'takedown_complete',
            verified: true,
            eventOccurredAt: dto.eventOccurredAt
                ? new Date(dto.eventOccurredAt)
                : null,
            firstTakedownAttemptAt: channels.length ? new Date() : null,
            takedownCompletedAt: channels.length ? null : new Date(),
            eventPayload: dto.eventPayload ?? {},
            takedownAttempts: channels.map((channel) => ({
                channelId: channel.id,
                ebayAccountId: channel.ebayAccountId,
                offerId: channel.offerId,
                action: 'manual_end_listing_required',
            })),
            createdByUserId: user.id,
            notes: dto.notes?.trim() || null,
        }));
        await this.applyLocalQuarantine(product, user.id, `Verified ${dto.incidentType} incident ${incident.id}`);
        await this.finishIncidentTakedown(incident);
        this.events.emit('business-industrial.incident', {
            organizationId: orgId,
            productId: product.id,
            incidentId: incident.id,
            status: incident.status,
            notifyVerticalAdministrators: true,
        });
        return this.incidentSummary(incident);
    }
    async processEnforcementWebhook(rawBody, signature) {
        const secret = process.env.EBAY_WEBHOOK_SECRET?.trim();
        if (!secret)
            throw new common_1.ServiceUnavailableException('EBAY_WEBHOOK_SECRET is not configured');
        if (!signature)
            throw new common_1.UnauthorizedException('eBay enforcement signature is required');
        const expected = (0, node_crypto_1.createHmac)('sha256', secret)
            .update(rawBody)
            .digest('base64');
        const expectedBuffer = Buffer.from(expected);
        const actualBuffer = Buffer.from(signature);
        if (expectedBuffer.length !== actualBuffer.length ||
            !(0, node_crypto_1.timingSafeEqual)(expectedBuffer, actualBuffer)) {
            throw new common_1.UnauthorizedException('Invalid eBay enforcement signature');
        }
        let payload;
        try {
            const parsed = JSON.parse(rawBody.toString('utf8'));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                throw new Error('payload must be an object');
            payload = parsed;
        }
        catch {
            throw new common_1.BadRequestException('Invalid eBay enforcement JSON payload');
        }
        const notification = payload.notification && typeof payload.notification === 'object'
            ? payload.notification
            : payload;
        const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
        const reference = text(notification.itemId) ??
            text(notification.offerId) ??
            text(notification.inventorySku) ??
            text(notification.sku);
        if (!reference)
            return {
                status: 'ignored',
                reason: 'No eBay item, offer, inventory SKU, or SKU reference',
            };
        const channel = await this.channelRepo
            .createQueryBuilder('channel')
            .where('channel.vertical = :vertical', { vertical: BI_VERTICAL })
            .andWhere('(channel.listingId = :reference OR channel.offerId = :reference OR channel.ebayInventorySku = :reference OR channel.internalSku = :reference)', { reference })
            .orderBy('channel.updatedAt', 'DESC')
            .getOne();
        if (!channel)
            return {
                status: 'ignored',
                reason: 'Reference is not mapped to a B&I channel',
            };
        const product = await this.productRepo.findOne({
            where: {
                id: channel.catalogProductId,
                organizationId: channel.organizationId,
                vertical: BI_VERTICAL,
            },
        });
        if (!product)
            return {
                status: 'ignored',
                reason: 'Mapped B&I product no longer exists',
            };
        const externalEventId = (text(notification.eventId) ??
            text(notification.notificationId) ??
            text(payload.eventId) ??
            `sha256:${(0, node_crypto_1.createHash)('sha256').update(rawBody).digest('hex')}`).slice(0, 200);
        const existing = await this.incidentRepo.findOne({
            where: { organizationId: product.organizationId, externalEventId },
        });
        if (existing)
            return { status: 'duplicate', incident: this.incidentSummary(existing) };
        const rawType = `${text(notification.type) ?? text(notification.eventType) ?? ''}`.toLowerCase();
        const incidentType = rawType.includes('counterfeit')
            ? 'counterfeit'
            : rawType.includes('intellectual') || rawType.includes('vero')
                ? 'intellectual_property'
                : rawType.includes('recall')
                    ? 'recalled_product'
                    : rawType.includes('safety')
                        ? 'product_safety'
                        : 'other';
        const published = channel.listingStatus === 'published';
        const incident = await this.incidentRepo.save(this.incidentRepo.create({
            organizationId: product.organizationId,
            catalogProductId: product.id,
            externalEventId,
            incidentType,
            status: published ? 'takedown_pending' : 'takedown_complete',
            verified: true,
            eventOccurredAt: text(notification.occurredAt)
                ? new Date(text(notification.occurredAt))
                : null,
            firstTakedownAttemptAt: published ? new Date() : null,
            takedownCompletedAt: published ? null : new Date(),
            eventPayload: payload,
            takedownAttempts: published
                ? [
                    {
                        channelId: channel.id,
                        ebayAccountId: channel.ebayAccountId,
                        offerId: channel.offerId,
                        listingId: channel.listingId,
                        action: 'manual_end_listing_required',
                    },
                ]
                : [],
            createdByUserId: null,
            notes: `Signed eBay enforcement notification received for ${reference}`,
        }));
        await this.applyLocalQuarantine(product, null, `Signed eBay enforcement notification ${incident.id}`);
        await this.finishIncidentTakedown(incident);
        this.events.emit('business-industrial.incident', {
            organizationId: product.organizationId,
            productId: product.id,
            incidentId: incident.id,
            status: incident.status,
            notifyVerticalAdministrators: true,
        });
        return {
            status: 'accepted',
            incident: this.incidentSummary(incident),
            remoteActionRequired: published,
        };
    }
    async listIncidents(user, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        return (await this.incidentRepo.find({
            where: { organizationId: org.organizationId },
            order: { detectedAt: 'DESC' },
            take: 200,
        })).map((incident) => this.incidentSummary(incident));
    }
    async retryIncidentTakedown(user, id, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const incident = await this.incidentRepo.findOne({
            where: { id, organizationId: org.organizationId },
        });
        if (!incident)
            throw new common_1.NotFoundException('Business & Industrial incident not found');
        if (incident.status === 'released')
            throw new common_1.BadRequestException('Released incidents cannot be retaken down');
        await this.finishIncidentTakedown(incident);
        return this.incidentSummary(incident);
    }
    async endListingChannel(user, channelId, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const channel = await this.channelRepo.findOne({
            where: {
                id: channelId,
                organizationId: org.organizationId,
                vertical: BI_VERTICAL,
            },
        });
        if (!channel)
            throw new common_1.NotFoundException('Business & Industrial publication not found');
        const product = await this.productRepo.findOne({
            where: {
                id: channel.catalogProductId,
                organizationId: org.organizationId,
                vertical: BI_VERTICAL,
            },
        });
        if (!product)
            throw new common_1.NotFoundException('Business & Industrial listing not found');
        const account = await this.accountRepo.findOne({
            where: { id: channel.ebayAccountId, organizationId: org.organizationId },
            relations: ['primaryStore'],
        });
        if (!account?.primaryStore)
            throw new common_1.NotFoundException('Business & Industrial eBay account not found');
        await this.assertBusinessIndustrialStore(user, account.primaryStoreId, org.organizationId, 'operate');
        return this.withdrawChannel(channel);
    }
    async releaseIncident(user, id, notes, organizationId) {
        if (!notes?.trim())
            throw new common_1.BadRequestException('Documented release notes are required');
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const incident = await this.incidentRepo.findOne({
            where: { id, organizationId: org.organizationId },
        });
        if (!incident)
            throw new common_1.NotFoundException('Business & Industrial incident not found');
        if (incident.status !== 'takedown_complete')
            throw new common_1.BadRequestException('Remote takedown must be verified before an incident can be released');
        if (incident.catalogProductId) {
            const product = await this.productRepo.findOne({
                where: {
                    id: incident.catalogProductId,
                    organizationId: org.organizationId,
                    vertical: BI_VERTICAL,
                },
            });
            if (product) {
                product.manualReview = false;
                product.verticalValidationStatus = 'needs_review';
                await this.productRepo.save(product);
                await this.reviewRepo.update({ organizationId: org.organizationId, catalogProductId: product.id }, {
                    status: 'pending',
                    notes: notes.trim(),
                    reviewedByUserId: user.id,
                    reviewedAt: new Date(),
                });
            }
        }
        incident.status = 'released';
        incident.notes = notes.trim();
        return this.incidentRepo.save(incident);
    }
    async authorizedStores(user, organizationId) {
        const stores = await this.storeRepo.find({
            where: { organizationId },
            order: { isPrimary: 'DESC', storeName: 'ASC' },
        });
        const owned = stores.filter((store) => this.isDedicatedBusinessIndustrialStore(store));
        if (await this.rbac.userHasPermission(user.id, 'business_industrial.stores.manage'))
            return owned;
        const accessible = await this.storeAccess.getAccessibleStoreIds(user);
        return owned.filter((store) => accessible.has(store.id));
    }
    async assertBusinessIndustrialStore(user, storeId, organizationId, minLevel = 'view') {
        const store = await this.storeRepo.findOne({
            where: { id: storeId, organizationId },
        });
        if (!store || !this.isDedicatedBusinessIndustrialStore(store))
            throw new common_1.NotFoundException('Business & Industrial store not found');
        if (!(await this.rbac.userHasPermission(user.id, 'business_industrial.stores.manage')))
            await this.storeAccess.assertStoreAccess(user, storeId, minLevel);
        return store;
    }
    async listUsers(user, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const members = await this.memberRepo.find({
            where: { organizationId: org.organizationId },
            relations: ['user'],
            order: { createdAt: 'ASC' },
        });
        const result = [];
        for (const member of members) {
            if (!(await this.rbac.userHasPermission(member.userId, 'business_industrial.access')))
                continue;
            const profile = await this.rbac.getAuthProfile(member.user);
            result.push({
                userId: member.userId,
                email: member.user.email,
                name: member.user.name,
                organizationRole: member.role,
                roleSlug: profile.roleSlug,
                roleName: profile.roleName,
                active: member.user.active,
            });
        }
        return result;
    }
    async updateUserRole(actor, userId, role, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(actor.id, organizationId);
        if (!BI_ROLES.has(role))
            throw new common_1.BadRequestException('Only Business & Industrial roles may be assigned from this workspace');
        const member = await this.memberRepo.findOne({
            where: { organizationId: org.organizationId, userId },
        });
        if (!member ||
            !(await this.rbac.userHasPermission(userId, 'business_industrial.access')))
            throw new common_1.NotFoundException('Business & Industrial user not found');
        await this.rbac.assignPrimaryRole(userId, role);
        return { userId, roleSlug: role };
    }
    async deactivateUser(actor, userId, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(actor.id, organizationId);
        const member = await this.memberRepo.findOne({
            where: { organizationId: org.organizationId, userId },
        });
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!member ||
            !user ||
            !(await this.rbac.userHasPermission(userId, 'business_industrial.access')))
            throw new common_1.NotFoundException('Business & Industrial user not found');
        user.active = false;
        await this.userRepo.save(user);
        return { userId, active: false };
    }
    async setUserStoreAccess(actor, userId, dto, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(actor.id, organizationId);
        const member = await this.memberRepo.findOne({
            where: { organizationId: org.organizationId, userId },
        });
        if (!member)
            throw new common_1.NotFoundException('Business & Industrial user not found');
        await this.assertBusinessIndustrialStore(actor, dto.storeId, org.organizationId, 'admin');
        const assignments = await this.storeAccess.getUserAssignments(userId);
        const existing = assignments.find((assignment) => assignment.storeId === dto.storeId);
        if (existing) {
            existing.accessLevel = dto.accessLevel;
            await this.storeAccess.setAssignment(userId, dto.storeId, dto.accessLevel);
        }
        else {
            await this.storeAccess.setAssignment(userId, dto.storeId, dto.accessLevel);
        }
        return { userId, storeId: dto.storeId, accessLevel: dto.accessLevel };
    }
    async findProduct(user, id, organizationId) {
        const org = await this.userOrgs.resolveOrganizationId(user.id, organizationId);
        const product = await this.productRepo.findOne({
            where: { id, organizationId: org.organizationId, vertical: BI_VERTICAL },
        });
        if (!product)
            throw new common_1.NotFoundException('Business & Industrial listing not found');
        return product;
    }
    async assertMutable(product) {
        if (product.manualReview ||
            product.verticalValidationStatus === 'quarantined') {
            throw new common_1.ForbiddenException('Quarantined Business & Industrial listings are locked until the incident is released');
        }
        const review = await this.reviewRepo.findOne({
            where: {
                organizationId: product.organizationId,
                catalogProductId: product.id,
            },
        });
        if (review?.status === 'quarantined') {
            throw new common_1.ForbiddenException('Quarantined Business & Industrial listings are locked until the incident is released');
        }
    }
    normalizeAttributes(raw, dto) {
        const merged = {
            ...(raw && typeof raw === 'object' && !Array.isArray(raw)
                ? raw
                : {}),
            ...(dto.manufacturer ? { manufacturer: dto.manufacturer.trim() } : {}),
            ...(dto.model ? { model: dto.model.trim() } : {}),
            ...(dto.mpn ? { mpn: dto.mpn.trim() } : {}),
        };
        const validation = (0, business_industrial_config_js_1.validateBusinessIndustrialAttributes)(merged);
        if (!validation.attributes.categoryFamily)
            throw new common_1.BadRequestException('Select a Business & Industrial category family; products are never classified by keywords alone');
        if (validation.errors.length)
            throw new common_1.BadRequestException({
                message: 'Invalid Business & Industrial attributes',
                errors: validation.errors,
            });
        return validation.attributes;
    }
    assertUnitPayload(attributes, units) {
        const mode = attributes.inventoryMode;
        if (mode === 'serialized' && (!units || units.length === 0))
            throw new common_1.BadRequestException('Serialized inventory requires one private serial record per physical unit');
        if (mode !== 'serialized' && units?.length)
            throw new common_1.BadRequestException('Serial records are only valid for serialized inventory');
        const privateSerials = new Set();
        const publicSerials = new Set();
        for (const unit of units ?? []) {
            const privateSerial = unit.serialNumberPrivate.trim();
            if (privateSerials.has(privateSerial))
                throw new common_1.ConflictException(`Duplicate private serial number ${privateSerial} in request`);
            privateSerials.add(privateSerial);
            const publicSerial = unit.serialNumberPublic?.trim();
            if (publicSerial && publicSerials.has(publicSerial))
                throw new common_1.ConflictException(`Duplicate public serial number ${publicSerial} in request`);
            if (publicSerial)
                publicSerials.add(publicSerial);
        }
    }
    quantityFromAttributes(attributes) {
        const lots = Number(attributes.sellableLots ?? 0);
        return Number.isInteger(lots) && lots > 0 ? lots : 0;
    }
    async saveUnits(organizationId, productId, attributes, units) {
        if (!units?.length)
            return;
        if (attributes.totalPhysicalUnits !== undefined &&
            Number(attributes.totalPhysicalUnits) !== units.length)
            throw new common_1.BadRequestException('Serialized unit count must equal totalPhysicalUnits');
        try {
            await this.unitRepo.save(units.map((unit) => this.unitRepo.create({
                organizationId,
                catalogProductId: productId,
                serialNumberPrivate: unit.serialNumberPrivate.trim(),
                serialNumberPublic: unit.serialNumberPublic?.trim() || null,
                status: 'available',
                allocatedStoreId: null,
                allocatedOfferId: null,
            })));
            this.events.emit('stock.bi-units.saved', {
                organizationId,
                catalogProductId: productId,
            });
        }
        catch (error) {
            if (error?.code === '23505')
                throw new common_1.ConflictException('A serial number is already registered in this organization');
            throw error;
        }
    }
    async ensurePendingReview(organizationId, product) {
        const existing = await this.reviewRepo.findOne({
            where: { organizationId, catalogProductId: product.id },
        });
        if (existing)
            return existing;
        return this.reviewRepo.save(this.reviewRepo.create({
            organizationId,
            catalogProductId: product.id,
            status: 'pending',
            provenanceConfirmed: false,
            specificationsVerified: false,
            testingReviewed: false,
            restrictedCategoryCleared: false,
            evidenceKeys: [],
            riskFlags: [],
            reviewedByUserId: null,
            notes: null,
            reviewedAt: null,
            reviewedProductUpdatedAt: null,
        }));
    }
    async applyLocalQuarantine(product, userId, note) {
        product.manualReview = true;
        product.verticalValidationStatus = 'quarantined';
        await this.productRepo.save(product);
        await this.reviewRepo.update({ organizationId: product.organizationId, catalogProductId: product.id }, {
            status: 'quarantined',
            reviewedByUserId: userId,
            notes: note,
            reviewedAt: new Date(),
        });
        return {
            id: product.id,
            status: 'quarantined',
            localBlock: true,
            remoteTakedown: 'manual_action_required',
        };
    }
    async finishIncidentTakedown(incident) {
        const channels = await this.channelRepo.find({
            where: {
                organizationId: incident.organizationId,
                catalogProductId: incident.catalogProductId ?? undefined,
                vertical: BI_VERTICAL,
            },
        });
        incident.firstTakedownAttemptAt ??= new Date();
        if (!channels.length) {
            incident.status = 'takedown_complete';
            incident.takedownCompletedAt = new Date();
            await this.incidentRepo.save(incident);
            return incident;
        }
        const results = await Promise.all(channels.map((channel) => this.withdrawChannel(channel)));
        const history = Array.isArray(incident.takedownAttempts)
            ? incident.takedownAttempts
            : [];
        incident.takedownAttempts = [
            ...history,
            ...results.map((result) => ({
                channelId: result.id,
                status: result.status,
                remoteRemovalVerified: result.remoteRemovalVerified,
                attemptedAt: new Date().toISOString(),
                ...(result.message ? { message: result.message } : {}),
            })),
        ];
        const complete = results.every((result) => result.remoteRemovalVerified);
        incident.status = complete ? 'takedown_complete' : 'escalated';
        incident.takedownCompletedAt = complete ? new Date() : null;
        await this.incidentRepo.save(incident);
        return incident;
    }
    async withdrawChannel(channel) {
        const account = await this.accountRepo.findOne({
            where: {
                id: channel.ebayAccountId,
                organizationId: channel.organizationId,
            },
            relations: ['primaryStore'],
        });
        const failed = {
            id: channel.id,
            status: 'failed',
            remoteRemovalVerified: false,
            message: 'Withdrawal could not be verified. Check store authorization and retry the incident action.',
        };
        if (!account?.primaryStore ||
            channel.vertical !== BI_VERTICAL ||
            !this.isDedicatedBusinessIndustrialStore(account.primaryStore))
            return failed;
        if (!channel.offerId) {
            channel.lastErrorCode = 'BI_WITHDRAW_MISSING_OFFER';
            channel.lastErrorMessage =
                'No Inventory API offer ID; manual marketplace removal and reconciliation required';
            await this.channelRepo.save(channel);
            return { ...failed, message: channel.lastErrorMessage };
        }
        try {
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
            await this.channelRepo.save(channel);
            return {
                id: channel.id,
                status: 'ended',
                remoteRemovalVerified: true,
                message: undefined,
            };
        }
        catch {
            channel.lastErrorCode = 'BI_WITHDRAW_UNVERIFIED';
            channel.lastErrorMessage = failed.message;
            await this.channelRepo.save(channel);
            return failed;
        }
    }
    isDedicatedBusinessIndustrialStore(store) {
        const raw = store.verticalConfig ?? {};
        const enabled = Array.isArray(raw.enabledVerticals)
            ? raw.enabledVerticals
            : [];
        return (raw.ownerVertical === BI_VERTICAL &&
            enabled.includes(BI_VERTICAL) &&
            store.channel === 'ebay');
    }
    storeSummary(store) {
        return {
            id: store.id,
            storeName: store.storeName,
            status: store.status,
            marketplaceId: store.ebayMarketplaceId,
            vertical: BI_VERTICAL,
        };
    }
    async publicProduct(product) {
        const units = await this.unitRepo.find({
            where: {
                organizationId: product.organizationId,
                catalogProductId: product.id,
            },
            order: { createdAt: 'ASC' },
        });
        return {
            id: product.id,
            sku: product.sku,
            title: product.title,
            description: product.description,
            brand: product.brand,
            mpn: product.mpn,
            conditionId: product.conditionId,
            conditionLabel: product.conditionLabel,
            price: product.price,
            quantity: product.quantity,
            imageUrls: product.imageUrls,
            optimizedTitle: product.optimizedTitle,
            optimizedDescription: product.optimizedDescription,
            optimizationPayload: product.optimizationPayload,
            seoScore: scoreAsPercentage(product.seoScore),
            readinessScore: scoreAsPercentage(product.readinessScore),
            categoryId: product.categoryId,
            categoryName: product.categoryName,
            vertical: product.vertical,
            verticalAttributes: product.verticalAttributes,
            verticalValidationStatus: product.verticalValidationStatus,
            manualReview: product.manualReview,
            serializedUnitCount: units.length,
            publicSerialNumbers: units
                .map((unit) => unit.serialNumberPublic)
                .filter((serial) => Boolean(serial)),
            updatedAt: product.updatedAt,
        };
    }
    unitPublic(unit) {
        return {
            id: unit.id,
            catalogProductId: unit.catalogProductId,
            serialNumberPublic: unit.serialNumberPublic,
            status: unit.status,
            allocatedStoreId: unit.allocatedStoreId,
            allocatedOfferId: unit.allocatedOfferId,
            createdAt: unit.createdAt,
            updatedAt: unit.updatedAt,
        };
    }
    reviewSummary(review) {
        return {
            id: review.id,
            status: review.status,
            provenanceConfirmed: review.provenanceConfirmed,
            specificationsVerified: review.specificationsVerified,
            testingReviewed: review.testingReviewed,
            restrictedCategoryCleared: review.restrictedCategoryCleared,
            reviewedByUserId: review.reviewedByUserId,
            reviewedAt: review.reviewedAt,
            notes: review.notes,
            evidenceCount: review.evidenceKeys.length,
            riskFlags: review.riskFlags,
        };
    }
    incidentSummary(incident) {
        return {
            id: incident.id,
            catalogProductId: incident.catalogProductId,
            externalEventId: incident.externalEventId,
            incidentType: incident.incidentType,
            status: incident.status,
            verified: incident.verified,
            detectedAt: incident.detectedAt,
            firstTakedownAttemptAt: incident.firstTakedownAttemptAt,
            takedownCompletedAt: incident.takedownCompletedAt,
            takedownAttempts: incident.takedownAttempts,
            remoteActionRequired: incident.status === 'takedown_pending' ||
                incident.status === 'escalated',
            notes: incident.notes,
        };
    }
};
exports.BusinessIndustrialService = BusinessIndustrialService;
exports.BusinessIndustrialService = BusinessIndustrialService = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(7, (0, typeorm_1.InjectRepository)(business_industrial_review_entity_js_1.BusinessIndustrialReview)),
    __param(8, (0, typeorm_1.InjectRepository)(business_industrial_unit_entity_js_1.BusinessIndustrialUnit)),
    __param(9, (0, typeorm_1.InjectRepository)(business_industrial_incident_entity_js_1.BusinessIndustrialIncident)),
    __param(10, (0, typeorm_1.InjectRepository)(store_entity_js_1.Store)),
    __param(11, (0, typeorm_1.InjectRepository)(ebay_listing_channel_entity_js_1.EbayListingChannel)),
    __param(12, (0, typeorm_1.InjectRepository)(connected_ebay_account_entity_js_1.ConnectedEbayAccount)),
    __param(13, (0, typeorm_1.InjectRepository)(organization_member_entity_js_1.OrganizationMember)),
    __param(14, (0, typeorm_1.InjectRepository)(user_entity_js_1.User)),
    __metadata("design:paramtypes", [verticals_service_js_1.VerticalsService,
        user_organization_service_js_1.UserOrganizationService,
        store_access_service_js_1.StoreAccessService,
        rbac_service_js_1.RbacService,
        event_emitter_1.EventEmitter2,
        ebay_inventory_api_service_js_1.EbayInventoryApiService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BusinessIndustrialService);
function scoreAsRatio(value) {
    if (value === undefined || !Number.isFinite(value))
        return null;
    return Math.max(0, Math.min(100, value)) / 100;
}
function scoreAsPercentage(value) {
    if (value === null || !Number.isFinite(Number(value)))
        return null;
    return Number(value) * 100;
}
//# sourceMappingURL=business-industrial.service.js.map
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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ListingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const typeorm_2 = require("typeorm");
const typeorm_3 = require("typeorm");
const XLSX = __importStar(require("xlsx"));
const listing_record_entity_1 = require("./listing-record.entity");
const listing_revision_entity_1 = require("./listing-revision.entity");
const extract_make_model_from_title_js_1 = require("./utils/extract-make-model-from-title.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_action_log_entity_js_1 = require("../integrations/ebay/entities/listing-action-log.entity.js");
const rbac_service_js_1 = require("../rbac/rbac.service.js");
const store_access_service_js_1 = require("../channels/store-access.service.js");
const teams_service_js_1 = require("../teams/teams.service.js");
const listing_vertical_filter_js_1 = require("./utils/listing-vertical-filter.js");
const automotive_access_scope_service_js_1 = require("../auth/automotive-access-scope.service.js");
const HEADER_TO_PROPERTY = {
    'custom label (sku)': 'customLabelSku',
    'category id': 'categoryId',
    'category name': 'categoryName',
    title: 'title',
    relationship: 'relationship',
    'relationship details': 'relationshipDetails',
    'schedule time': 'scheduleTime',
    'p:upc': 'pUpc',
    'p:epid': 'pEpid',
    'start price': 'startPrice',
    quantity: 'quantity',
    'item photo url': 'itemPhotoUrl',
    'condition id': 'conditionId',
    description: 'description',
    format: 'format',
    duration: 'duration',
    'buy it now price': 'buyItNowPrice',
    'best offer enabled': 'bestOfferEnabled',
    'best offer auto accept price': 'bestOfferAutoAcceptPrice',
    'minimum best offer price': 'minimumBestOfferPrice',
    'immediate pay required': 'immediatePayRequired',
    location: 'location',
    'shipping service 1 option': 'shippingService1Option',
    'shipping service 1 cost': 'shippingService1Cost',
    'shipping service 1 priority': 'shippingService1Priority',
    'shipping service 2 option': 'shippingService2Option',
    'shipping service 2 cost': 'shippingService2Cost',
    'shipping service 2 priority': 'shippingService2Priority',
    'max dispatch time': 'maxDispatchTime',
    'returns accepted option': 'returnsAcceptedOption',
    'returns within option': 'returnsWithinOption',
    'refund option': 'refundOption',
    'return shipping cost paid by': 'returnShippingCostPaidBy',
    'shipping profile name': 'shippingProfileName',
    'return profile name': 'returnProfileName',
    'payment profile name': 'paymentProfileName',
    productcompliancepolicyid: 'productCompliancePolicyId',
    'regional productcompliancepolicies': 'regionalProductCompliancePolicies',
    'c:brand': 'cBrand',
    'c:type': 'cType',
    'c:item height': 'cItemHeight',
    'c:item length': 'cItemLength',
    'c:item width': 'cItemWidth',
    'c:item diameter': 'cItemDiameter',
    'c:features': 'cFeatures',
    'c:manufacturer part number': 'cManufacturerPartNumber',
    'c:oe/oem part number': 'cOeOemPartNumber',
    'c:operating mode': 'cOperatingMode',
    'c:fuel type': 'cFuelType',
    'c:drive type': 'cDriveType',
    'product safety pictograms': 'productSafetyPictograms',
    'product safety statements': 'productSafetyStatements',
    'product safety component': 'productSafetyComponent',
    'regulatory document ids': 'regulatoryDocumentIds',
    'manufacturer name': 'manufacturerName',
    'manufacturer addressline1': 'manufacturerAddressLine1',
    'manufacturer addressline2': 'manufacturerAddressLine2',
    'manufacturer city': 'manufacturerCity',
    'manufacturer country': 'manufacturerCountry',
    'manufacturer postalcode': 'manufacturerPostalCode',
    'manufacturer stateorprovince': 'manufacturerStateOrProvince',
    'manufacturer phone': 'manufacturerPhone',
    'manufacturer email': 'manufacturerEmail',
    'manufacturer contacturl': 'manufacturerContactUrl',
    'responsible person 1': 'responsiblePerson1',
    'responsible person 1 type': 'responsiblePerson1Type',
    'responsible person 1 addressline1': 'responsiblePerson1AddressLine1',
    'responsible person 1 addressline2': 'responsiblePerson1AddressLine2',
    'responsible person 1 city': 'responsiblePerson1City',
    'responsible person 1 country': 'responsiblePerson1Country',
    'responsible person 1 postalcode': 'responsiblePerson1PostalCode',
    'responsible person 1 stateorprovince': 'responsiblePerson1StateOrProvince',
    'responsible person 1 phone': 'responsiblePerson1Phone',
    'responsible person 1 email': 'responsiblePerson1Email',
    'responsible person 1 contacturl': 'responsiblePerson1ContactUrl',
};
const UPSERT_COLUMNS = [
    'action',
    'customLabelSku',
    'categoryId',
    'categoryName',
    'title',
    'relationship',
    'relationshipDetails',
    'scheduleTime',
    'pUpc',
    'pEpid',
    'startPrice',
    'quantity',
    'itemPhotoUrl',
    'conditionId',
    'description',
    'format',
    'duration',
    'buyItNowPrice',
    'bestOfferEnabled',
    'bestOfferAutoAcceptPrice',
    'minimumBestOfferPrice',
    'immediatePayRequired',
    'location',
    'shippingService1Option',
    'shippingService1Cost',
    'shippingService1Priority',
    'shippingService2Option',
    'shippingService2Cost',
    'shippingService2Priority',
    'maxDispatchTime',
    'returnsAcceptedOption',
    'returnsWithinOption',
    'refundOption',
    'returnShippingCostPaidBy',
    'shippingProfileName',
    'returnProfileName',
    'paymentProfileName',
    'productCompliancePolicyId',
    'regionalProductCompliancePolicies',
    'cBrand',
    'cType',
    'cItemHeight',
    'cItemLength',
    'cItemWidth',
    'cItemDiameter',
    'cFeatures',
    'cManufacturerPartNumber',
    'cOeOemPartNumber',
    'cOperatingMode',
    'cFuelType',
    'cDriveType',
    'productSafetyPictograms',
    'productSafetyStatements',
    'productSafetyComponent',
    'regulatoryDocumentIds',
    'manufacturerName',
    'manufacturerAddressLine1',
    'manufacturerAddressLine2',
    'manufacturerCity',
    'manufacturerCountry',
    'manufacturerPostalCode',
    'manufacturerStateOrProvince',
    'manufacturerPhone',
    'manufacturerEmail',
    'manufacturerContactUrl',
    'responsiblePerson1',
    'responsiblePerson1Type',
    'responsiblePerson1AddressLine1',
    'responsiblePerson1AddressLine2',
    'responsiblePerson1City',
    'responsiblePerson1Country',
    'responsiblePerson1PostalCode',
    'responsiblePerson1StateOrProvince',
    'responsiblePerson1Phone',
    'responsiblePerson1Email',
    'responsiblePerson1ContactUrl',
    'sourceFilePath',
    'extractedMake',
    'extractedModel',
];
let ListingsService = ListingsService_1 = class ListingsService {
    listingRepo;
    revisionRepo;
    catalogProductRepo;
    actionLogRepo;
    dataSource;
    rbac;
    storeAccess;
    teamsService;
    automotiveScope;
    logger = new common_1.Logger(ListingsService_1.name);
    constructor(listingRepo, revisionRepo, catalogProductRepo, actionLogRepo, dataSource, rbac, storeAccess, teamsService, automotiveScope) {
        this.listingRepo = listingRepo;
        this.revisionRepo = revisionRepo;
        this.catalogProductRepo = catalogProductRepo;
        this.actionLogRepo = actionLogRepo;
        this.dataSource = dataSource;
        this.rbac = rbac;
        this.storeAccess = storeAccess;
        this.teamsService = teamsService;
        this.automotiveScope = automotiveScope;
    }
    async findAll(query, user) {
        const limit = Math.min(Number(query.limit ?? 60), 200);
        const offset = Number(query.offset ?? 0);
        const qb = this.listingRepo
            .createQueryBuilder('r')
            .select([
            'r.id',
            'r.customLabelSku',
            'r.title',
            'r.cBrand',
            'r.cType',
            'r.categoryId',
            'r.categoryName',
            'r.startPrice',
            'r.quantity',
            'r.conditionId',
            'r.itemPhotoUrl',
            'r.cManufacturerPartNumber',
            'r.cOeOemPartNumber',
            'r.location',
            'r.format',
            'r.sourceFileName',
            'r.importedAt',
            'r.description',
        ])
            .orderBy('r.importedAt', 'DESC')
            .addOrderBy('r.id', 'ASC')
            .offset(offset)
            .limit(limit);
        const storeFilter = await this.buildStoreFilter(user);
        if (storeFilter) {
            qb.andWhere(storeFilter.sql, storeFilter.params);
        }
        if (query.search?.trim()) {
            qb.andWhere('(r.customLabelSku ILIKE :q OR r.title ILIKE :q OR r.cBrand ILIKE :q OR r.cManufacturerPartNumber ILIKE :q OR r.cOeOemPartNumber ILIKE :q)', { q: `%${query.search.trim()}%` });
        }
        if (query.sku?.trim()) {
            qb.andWhere('r.customLabelSku ILIKE :sku', {
                sku: `%${query.sku.trim()}%`,
            });
        }
        if (query.categoryId?.trim()) {
            qb.andWhere('r.categoryId = :catId', { catId: query.categoryId.trim() });
        }
        if (query.categoryName?.trim()) {
            qb.andWhere('r.categoryName ILIKE :catName', {
                catName: `%${query.categoryName.trim()}%`,
            });
        }
        if (query.brand?.trim()) {
            qb.andWhere('r.cBrand ILIKE :brand', {
                brand: `%${query.brand.trim()}%`,
            });
        }
        if (query.cType?.trim()) {
            qb.andWhere('r.cType ILIKE :cType', {
                cType: `%${query.cType.trim()}%`,
            });
        }
        if (query.conditionId?.trim()) {
            qb.andWhere('r.conditionId = :cond', {
                cond: query.conditionId.trim(),
            });
        }
        if (query.sourceFile?.trim()) {
            qb.andWhere('r.sourceFileName = :srcFile', {
                srcFile: query.sourceFile.trim(),
            });
        }
        if (query.hasImage === '1') {
            qb.andWhere("r.itemPhotoUrl IS NOT NULL AND r.itemPhotoUrl != ''");
        }
        const [items, total] = await qb.getManyAndCount();
        return { total, limit, offset, items };
    }
    async findOne(id, user) {
        const record = await this.findAccessibleListing(id, user);
        if (!record) {
            throw new common_1.NotFoundException(`Listing ${id} not found`);
        }
        let catalogProduct = null;
        if (record.customLabelSku) {
            const productQb = this.catalogProductRepo
                .createQueryBuilder('p')
                .where('p.sku = :sku', { sku: record.customLabelSku });
            const productScope = await this.automotiveScope.buildFilter(user, 'p');
            if (productScope)
                productQb.andWhere(productScope.sql, productScope.params);
            catalogProduct = await productQb.getOne();
        }
        return { listing: record, catalogProduct };
    }
    async create(dto, user) {
        const organizationId = await this.automotiveScope.resolveWriteOrganizationId(user);
        return this.createScoped(dto, organizationId, user.id);
    }
    async createForOrganization(dto, organizationId, changedBy) {
        return this.createScoped(dto, this.automotiveScope.resolveSystemWriteOrganizationId(organizationId), changedBy ?? null);
    }
    async createScoped(dto, organizationId, changedBy) {
        try {
            return await this.createInTransaction(dto, organizationId, changedBy);
        }
        catch (err) {
            if (this.isSkuUniqueViolation(err) && dto.customLabelSku?.trim()) {
                return this.createInTransaction(dto, organizationId, changedBy);
            }
            throw err;
        }
    }
    isSkuUniqueViolation(err) {
        return (err instanceof typeorm_3.QueryFailedError &&
            err
                .driverError?.code === '23505');
    }
    async createInTransaction(dto, organizationId, changedBy) {
        return this.dataSource.transaction(async (em) => {
            const listing = em.create(listing_record_entity_1.ListingRecord, {
                ...dto,
                status: dto.status ?? 'draft',
                sourceFileName: 'manual',
                sourceFilePath: 'manual',
                origin: listing_record_entity_1.ListingOrigin.ADD_PART,
                sheetName: 'manual',
                sourceRowNumber: 0,
                organizationId,
                vertical: 'automotive',
                updatedBy: changedBy,
            });
            const sku = dto.customLabelSku?.trim();
            let existing = null;
            if (sku) {
                existing = await em
                    .createQueryBuilder(listing_record_entity_1.ListingRecord, 'l')
                    .setLock('pessimistic_write')
                    .where('l.customLabelSku = :sku', { sku })
                    .andWhere('l.organizationId = :organizationId', { organizationId })
                    .andWhere('l.vertical = :vertical', { vertical: 'automotive' })
                    .andWhere('l.deletedAt IS NULL')
                    .getOne();
            }
            if (existing) {
                const oldStatus = existing.status;
                const changes = { ...dto };
                delete changes.status;
                Object.assign(existing, changes);
                if (dto.status) {
                    existing.status = dto.status;
                }
                const savedExisting = await em.save(listing_record_entity_1.ListingRecord, existing);
                const revision = em.create(listing_revision_entity_1.ListingRevision, {
                    listingId: savedExisting.id,
                    version: savedExisting.version,
                    statusBefore: oldStatus,
                    statusAfter: savedExisting.status ?? oldStatus ?? 'draft',
                    snapshot: { ...savedExisting },
                    changeReason: 'update_via_create',
                    changedBy,
                });
                await em.save(listing_revision_entity_1.ListingRevision, revision);
                return { listing: savedExisting, revision, updated: true };
            }
            const maxRow = await em
                .createQueryBuilder(listing_record_entity_1.ListingRecord, 'r')
                .select('MAX(r.sourceRowNumber)', 'max')
                .where('r.sourceFileName = :src', { src: 'manual' })
                .andWhere('r.organizationId = :organizationId', { organizationId })
                .andWhere('r.vertical = :vertical', { vertical: 'automotive' })
                .withDeleted()
                .getRawOne();
            const nextRow = (Number(maxRow?.max) || 0) + 1;
            listing.sourceRowNumber = nextRow;
            const saved = await em.save(listing_record_entity_1.ListingRecord, listing);
            const revision = em.create(listing_revision_entity_1.ListingRevision, {
                listingId: saved.id,
                version: saved.version,
                statusBefore: null,
                statusAfter: saved.status ?? 'draft',
                snapshot: { ...saved },
                changeReason: 'create',
                changedBy,
            });
            await em.save(listing_revision_entity_1.ListingRevision, revision);
            return { listing: saved, revision };
        });
    }
    async update(id, dto, user) {
        return this.dataSource.transaction(async (em) => {
            const listing = await this.findAccessibleListing(id, user, em);
            if (!listing)
                throw new common_1.NotFoundException(`Listing ${id} not found`);
            if (listing.version !== dto.version) {
                throw new common_1.ConflictException({
                    message: 'This listing changed while you were editing. Please save again.',
                    currentVersion: listing.version,
                    yourVersion: dto.version,
                });
            }
            if (user) {
                const userPerms = await this.rbac.getPermissionKeysForUser(user.id);
                const canRevise = userPerms.has('listings.revise');
                const canPriceOverride = userPerms.has('listings.price_override');
                if (listing.status === 'published' && !canRevise) {
                    throw new common_1.ForbiddenException('You do not have permission to revise published listings.');
                }
                const priceFields = [
                    'startPrice',
                    'buyItNowPrice',
                    'bestOfferAutoAcceptPrice',
                    'minimumBestOfferPrice',
                ];
                const hasPriceChange = priceFields.some((f) => dto[f] !== undefined);
                if (listing.status === 'published' &&
                    hasPriceChange &&
                    !canPriceOverride) {
                    throw new common_1.ForbiddenException('Changing price on a live listing requires manager approval.');
                }
            }
            const oldStatus = listing.status;
            const beforeSnapshot = { ...listing };
            const oldSku = listing.customLabelSku?.trim() || null;
            const { version: _v, ...rawChanges } = dto;
            const changes = Object.fromEntries(Object.entries(rawChanges).filter(([, v]) => v !== undefined));
            if (changes.customLabelSku !== undefined &&
                typeof changes.customLabelSku === 'string') {
                const trimmed = changes.customLabelSku.trim();
                changes.customLabelSku = trimmed.length > 0 ? trimmed : null;
            }
            await this.assertSkuRenameAllowed(em, listing, oldSku, changes);
            Object.assign(listing, changes);
            this.applyDerivedNumericFields(listing, changes);
            if (user)
                listing.updatedBy = user.id;
            const saved = await em.save(listing_record_entity_1.ListingRecord, listing);
            await this.syncSkuRenameToCatalogAndSiblings(em, saved, oldSku, changes);
            await this.syncSharedPriceQuantityToCatalogAndSiblings(em, saved, changes);
            const afterSnapshot = { ...saved };
            const existingRevision = await em.findOne(listing_revision_entity_1.ListingRevision, {
                where: { listingId: id, version: saved.version },
            });
            let revision = existingRevision;
            if (!revision) {
                revision = em.create(listing_revision_entity_1.ListingRevision, {
                    listingId: id,
                    version: saved.version,
                    statusBefore: oldStatus,
                    statusAfter: saved.status ?? oldStatus ?? 'draft',
                    snapshot: afterSnapshot,
                    changeReason: 'manual_edit',
                    changedBy: user?.id ?? null,
                });
                await em.save(listing_revision_entity_1.ListingRevision, revision);
            }
            if (user && saved.organizationId) {
                const diff = this.computeDiff(beforeSnapshot, afterSnapshot);
                if (Object.keys(diff).length > 0) {
                    const actionLog = this.actionLogRepo.create({
                        organizationId: saved.organizationId,
                        userId: user.id,
                        action: 'listing.updated',
                        beforeSnapshot: beforeSnapshot,
                        afterSnapshot: afterSnapshot,
                        result: 'success',
                    });
                    await this.actionLogRepo.save(actionLog);
                }
            }
            return { listing: saved, revision };
        });
    }
    async patchStatus(id, dto, user) {
        return this.dataSource.transaction(async (em) => {
            const listing = await this.findAccessibleListing(id, user, em);
            if (!listing)
                throw new common_1.NotFoundException(`Listing ${id} not found`);
            if (listing.version !== dto.version) {
                throw new common_1.ConflictException({
                    message: 'This listing changed while you were editing. Please save again.',
                    currentVersion: listing.version,
                    yourVersion: dto.version,
                });
            }
            if (user &&
                dto.status === 'published' &&
                listing.status !== 'published') {
                const canApprove = await this.rbac.userHasPermission(user.id, 'listings.approve');
                if (!canApprove) {
                    throw new common_1.ForbiddenException('You do not have permission to approve listings for publication.');
                }
            }
            const oldStatus = listing.status;
            const beforeSnapshot = { ...listing };
            listing.status = dto.status;
            if (user)
                listing.updatedBy = user.id;
            if (dto.status === 'published' && !listing.publishedAt) {
                listing.publishedAt = new Date();
            }
            const saved = await em.save(listing_record_entity_1.ListingRecord, listing);
            const afterSnapshot = { ...saved };
            const revision = em.create(listing_revision_entity_1.ListingRevision, {
                listingId: id,
                version: saved.version,
                statusBefore: oldStatus,
                statusAfter: dto.status ?? oldStatus ?? 'draft',
                snapshot: afterSnapshot,
                changeReason: dto.reason ?? 'status_change',
                changedBy: user?.id ?? null,
            });
            await em.save(listing_revision_entity_1.ListingRevision, revision);
            if (user && saved.organizationId) {
                const actionLog = this.actionLogRepo.create({
                    organizationId: saved.organizationId,
                    userId: user.id,
                    action: `listing.status_changed:${oldStatus}→${dto.status}`,
                    beforeSnapshot: beforeSnapshot,
                    afterSnapshot: afterSnapshot,
                    result: 'success',
                });
                await this.actionLogRepo.save(actionLog);
            }
            return { listing: saved, revision };
        });
    }
    async softDelete(id, user) {
        const listing = await this.findAccessibleListing(id, user);
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${id} not found`);
        await this.listingRepo.softRemove(listing);
        return { success: true };
    }
    async restore(id, user) {
        const listing = await this.findAccessibleListing(id, user, this.dataSource.manager, true);
        if (!listing)
            throw new common_1.NotFoundException(`Listing ${id} not found`);
        await this.listingRepo.recover(listing);
        return { listing };
    }
    async bulkUpdate(dto, user) {
        const updated = [];
        const failed = [];
        for (const id of dto.ids) {
            try {
                await this.dataSource.transaction(async (em) => {
                    const listing = await this.findAccessibleListing(id, user, em);
                    if (!listing) {
                        throw new common_1.NotFoundException(`Listing ${id} not found`);
                    }
                    const expectedVersion = dto.versions?.[id];
                    if (expectedVersion !== undefined &&
                        listing.version !== expectedVersion) {
                        throw new common_1.ConflictException({
                            message: 'This listing changed while you were editing. Please save again.',
                            currentVersion: listing.version,
                            yourVersion: expectedVersion,
                        });
                    }
                    Object.assign(listing, dto.changes);
                    listing.updatedBy = user.id;
                    await em.save(listing_record_entity_1.ListingRecord, listing);
                });
                updated.push(id);
            }
            catch (err) {
                const conflict = err instanceof common_1.ConflictException;
                failed.push({
                    id,
                    error: err instanceof Error ? err.message : 'Unknown error',
                    ...(conflict ? { conflict: true } : {}),
                });
            }
        }
        return { updated: updated.length, failed };
    }
    async bulkApplyProfiles(dto, user) {
        const { shippingProfile, returnProfile, paymentProfile } = dto;
        if (!shippingProfile && !returnProfile && !paymentProfile) {
            throw new common_1.BadRequestException('At least one profile must be provided');
        }
        const listings = await this.findAccessibleListings(dto.ids, user);
        if (!listings.length) {
            throw new common_1.NotFoundException('No listings found for given IDs');
        }
        const manageAll = await this.rbac.userHasPermission(user.id, 'teams.manage');
        await this.teamsService.assertListingsTeamScope(listings.map((l) => ({ id: l.id, teamId: l.teamId })), user.id, manageAll, dto.teamIds);
        for (const listing of listings) {
            if (shippingProfile)
                listing.shippingProfileName = shippingProfile;
            if (returnProfile)
                listing.returnProfileName = returnProfile;
            if (paymentProfile)
                listing.paymentProfileName = paymentProfile;
        }
        await this.listingRepo.save(listings);
        const skus = [
            ...new Set(listings
                .map((l) => l.customLabelSku)
                .filter((s) => s != null && s !== '')),
        ];
        if (skus.length) {
            const productQb = this.catalogProductRepo
                .createQueryBuilder('p')
                .where('p.sku IN (:...skus)', { skus });
            const productScope = await this.automotiveScope.buildFilter(user, 'p');
            if (productScope)
                productQb.andWhere(productScope.sql, productScope.params);
            const products = await productQb.getMany();
            for (const product of products) {
                if (shippingProfile)
                    product.shippingProfile = shippingProfile;
                if (returnProfile)
                    product.returnProfile = returnProfile;
                if (paymentProfile)
                    product.paymentProfile = paymentProfile;
            }
            if (products.length) {
                await this.catalogProductRepo.save(products);
            }
        }
        return { updated: listings.length };
    }
    async bulkSoftDelete(ids, user) {
        const listings = await this.findAccessibleListings(ids, user);
        if (!listings.length)
            throw new common_1.NotFoundException('No listings found for given IDs');
        await this.listingRepo.softRemove(listings);
        return { deleted: listings.length };
    }
    async exportCsv(query, user) {
        const qb = this.listingRepo
            .createQueryBuilder('r')
            .select([
            'r.id',
            'r.customLabelSku',
            'r.title',
            'r.cBrand',
            'r.cType',
            'r.categoryId',
            'r.categoryName',
            'r.startPrice',
            'r.quantity',
            'r.conditionId',
            'r.cManufacturerPartNumber',
            'r.cOeOemPartNumber',
            'r.location',
            'r.format',
            'r.description',
            'r.itemPhotoUrl',
            'r.sourceFileName',
            'r.importedAt',
        ])
            .orderBy('r.importedAt', 'DESC')
            .limit(10000);
        const storeFilter = await this.buildStoreFilter(user);
        if (storeFilter)
            qb.andWhere(storeFilter.sql, storeFilter.params);
        if (query.q?.trim()) {
            qb.andWhere('(r.customLabelSku ILIKE :q OR r.title ILIKE :q OR r.cBrand ILIKE :q)', { q: `%${query.q.trim()}%` });
        }
        if (query.brands?.trim()) {
            const brandList = query.brands
                .split(',')
                .map((b) => b.trim())
                .filter(Boolean);
            qb.andWhere('r.cBrand IN (:...brands)', { brands: brandList });
        }
        if (query.categories?.trim()) {
            const catList = query.categories
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            qb.andWhere('r.categoryId IN (:...cats)', { cats: catList });
        }
        if (query.conditions?.trim()) {
            const condList = query.conditions
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            qb.andWhere('r.conditionId IN (:...conds)', { conds: condList });
        }
        if (query.minPrice != null) {
            qb.andWhere('CAST(r.startPrice AS numeric) >= :minPrice', {
                minPrice: query.minPrice,
            });
        }
        if (query.maxPrice != null) {
            qb.andWhere('CAST(r.startPrice AS numeric) <= :maxPrice', {
                maxPrice: query.maxPrice,
            });
        }
        const items = await qb.getMany();
        const headers = [
            'SKU',
            'Title',
            'Brand',
            'Type',
            'Category',
            'Price',
            'Qty',
            'Condition',
            'MPN',
            'OEM Part',
            'Location',
            'Format',
        ];
        const escape = (v) => {
            if (v == null)
                return '';
            const s = String(v);
            if (s.includes(',') || s.includes('"') || s.includes('\n'))
                return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const rows = items.map((r) => [
            escape(r.customLabelSku),
            escape(r.title),
            escape(r.cBrand),
            escape(r.cType),
            escape(r.categoryName),
            escape(r.startPrice),
            escape(r.quantity),
            escape(r.conditionId),
            escape(r.cManufacturerPartNumber),
            escape(r.cOeOemPartNumber),
            escape(r.location),
            escape(r.format),
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    async getRevisions(listingId, limit, offset, user) {
        await this.findAccessibleListing(listingId, user);
        const [revisions, total] = await this.revisionRepo.findAndCount({
            where: { listingId },
            order: { version: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { total, revisions };
    }
    async getSummary(user, vertical) {
        const storeFilter = await this.buildStoreFilter(user);
        const verticalFilter = (0, listing_vertical_filter_js_1.listingVerticalFilter)(vertical);
        if (storeFilter && storeFilter.sql === '1=0') {
            return { totalRecords: 0, uniqueSkus: 0, files: 0 };
        }
        const qb = this.listingRepo.createQueryBuilder('r');
        if (storeFilter)
            qb.andWhere(storeFilter.sql, storeFilter.params);
        if (verticalFilter)
            qb.andWhere(verticalFilter.sql, verticalFilter.params);
        const totalRecords = await qb.getCount();
        const skuQb = this.listingRepo
            .createQueryBuilder('r')
            .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus');
        if (storeFilter)
            skuQb.where(storeFilter.sql, storeFilter.params);
        if (verticalFilter)
            skuQb.andWhere(verticalFilter.sql, verticalFilter.params);
        const uniqueRow = await skuQb.getRawOne();
        const fileQb = this.listingRepo
            .createQueryBuilder('r')
            .select('COUNT(DISTINCT r.sourceFileName)', 'files');
        if (storeFilter)
            fileQb.where(storeFilter.sql, storeFilter.params);
        if (verticalFilter)
            fileQb.andWhere(verticalFilter.sql, verticalFilter.params);
        const fileRow = await fileQb.getRawOne();
        return {
            totalRecords,
            uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
            files: Number(fileRow?.files ?? 0),
        };
    }
    async getFacets(user) {
        const storeFilter = await this.buildStoreFilter(user);
        const brandsQb = this.listingRepo
            .createQueryBuilder('r')
            .select('r.cBrand', 'value')
            .addSelect('COUNT(*)', 'count')
            .where("r.cBrand IS NOT NULL AND r.cBrand != ''")
            .groupBy('r.cBrand');
        if (storeFilter)
            brandsQb.andWhere(storeFilter.sql, storeFilter.params);
        brandsQb.orderBy('count', 'DESC').limit(100);
        const brandsRaw = await brandsQb.getRawMany();
        const categoriesQb = this.listingRepo
            .createQueryBuilder('r')
            .select('r.categoryName', 'value')
            .addSelect('r.categoryId', 'id')
            .addSelect('COUNT(*)', 'count')
            .where("r.categoryName IS NOT NULL AND r.categoryName != ''")
            .groupBy('r.categoryName')
            .addGroupBy('r.categoryId');
        if (storeFilter)
            categoriesQb.andWhere(storeFilter.sql, storeFilter.params);
        categoriesQb.orderBy('count', 'DESC').limit(100);
        const categoriesRaw = await categoriesQb.getRawMany();
        const conditionsQb = this.listingRepo
            .createQueryBuilder('r')
            .select('r.conditionId', 'value')
            .addSelect('COUNT(*)', 'count')
            .where("r.conditionId IS NOT NULL AND r.conditionId != ''")
            .groupBy('r.conditionId');
        if (storeFilter)
            conditionsQb.andWhere(storeFilter.sql, storeFilter.params);
        conditionsQb.orderBy('count', 'DESC');
        const conditionsRaw = await conditionsQb.getRawMany();
        const sourceFilesQb = this.listingRepo
            .createQueryBuilder('r')
            .select('r.sourceFileName', 'value')
            .addSelect('COUNT(*)', 'count')
            .groupBy('r.sourceFileName');
        if (storeFilter)
            sourceFilesQb.andWhere(storeFilter.sql, storeFilter.params);
        sourceFilesQb.orderBy('count', 'DESC');
        const sourceFilesRaw = await sourceFilesQb.getRawMany();
        return {
            brands: brandsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            categories: categoriesRaw.map((r) => ({
                value: r.value,
                id: r.id,
                count: Number(r.count),
            })),
            conditions: conditionsRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
            sourceFiles: sourceFilesRaw.map((r) => ({
                value: r.value,
                count: Number(r.count),
            })),
        };
    }
    async importFromFolder(folderPath) {
        const absoluteFolder = path.resolve(folderPath);
        const files = fs
            .readdirSync(absoluteFolder)
            .filter((name) => name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$'))
            .map((name) => path.join(absoluteFolder, name))
            .sort();
        let importedRows = 0;
        let skippedRows = 0;
        let filesWithHeader = 0;
        for (const filePath of files) {
            const sourceFileName = path.basename(filePath);
            this.logger.log(`Reading ${sourceFileName} …`);
            const workbook = XLSX.readFile(filePath, { cellDates: false });
            const sheetName = 'Listings';
            const ws = workbook.Sheets[sheetName];
            if (!ws) {
                this.logger.warn(`  ⚠ No "Listings" sheet – skipping`);
                continue;
            }
            const allRows = XLSX.utils.sheet_to_json(ws, {
                header: 1,
                raw: false,
                defval: null,
            });
            const headerRowIndex = this.findHeaderRow(allRows);
            if (headerRowIndex === null) {
                this.logger.warn(`  ⚠ Header row not found – skipping`);
                continue;
            }
            filesWithHeader += 1;
            const headerRow = allRows[headerRowIndex] ?? [];
            const colMap = this.buildColumnMap(headerRow);
            const BATCH_SIZE = 500;
            const batch = [];
            for (let rowIdx = headerRowIndex + 1; rowIdx < allRows.length; rowIdx += 1) {
                const row = allRows[rowIdx] ?? [];
                const record = {
                    sourceFileName,
                    sourceFilePath: filePath,
                    sheetName,
                    sourceRowNumber: rowIdx + 1,
                };
                let hasAnyData = false;
                for (const [colIdx, propName] of colMap.entries()) {
                    const raw = row[colIdx];
                    const val = this.cleanValue(raw);
                    record[propName] = val;
                    if (val !== null) {
                        hasAnyData = true;
                    }
                }
                const mm = (0, extract_make_model_from_title_js_1.extractMakeModelFromTitle)(record.title ?? null);
                record.extractedMake = mm.make;
                record.extractedModel = mm.model;
                if (!hasAnyData) {
                    skippedRows += 1;
                    continue;
                }
                batch.push(record);
                if (batch.length >= BATCH_SIZE) {
                    await this.upsertBatch(batch);
                    importedRows += batch.length;
                    batch.length = 0;
                }
            }
            if (batch.length > 0) {
                await this.upsertBatch(batch);
                importedRows += batch.length;
                batch.length = 0;
            }
            this.logger.log(`  ✔ ${sourceFileName} done`);
        }
        const uniqueRow = await this.listingRepo
            .createQueryBuilder('r')
            .select('COUNT(DISTINCT r.customLabelSku)', 'uniqueSkus')
            .getRawOne();
        this.logger.log(`Import complete: ${importedRows} rows from ${filesWithHeader} files`);
        return {
            scannedFiles: files.length,
            importedRows,
            skippedRows,
            filesWithHeader,
            uniqueSkus: Number(uniqueRow?.uniqueSkus ?? 0),
        };
    }
    async buildStoreFilter(user, alias = 'r') {
        const accessFilter = await this.automotiveScope.buildFilter(user, alias);
        const storeIds = await this.storeAccess.resolveStoreFilter(user);
        if (storeIds === undefined)
            return accessFilter;
        if (storeIds.length === 0) {
            return {
                sql: accessFilter
                    ? `(${accessFilter.sql}) AND (${store_access_service_js_1.StoreAccessService.UNSCOPED_LISTINGS_SQL})`
                    : store_access_service_js_1.StoreAccessService.UNSCOPED_LISTINGS_SQL,
                params: accessFilter?.params ?? {},
            };
        }
        return {
            sql: accessFilter
                ? `(${accessFilter.sql}) AND (${store_access_service_js_1.StoreAccessService.SCOPED_LISTINGS_SQL})`
                : store_access_service_js_1.StoreAccessService.SCOPED_LISTINGS_SQL,
            params: { ...(accessFilter?.params ?? {}), storeIds },
        };
    }
    async findAccessibleListing(id, user, manager = this.dataSource.manager, withDeleted = false) {
        const qb = manager
            .createQueryBuilder(listing_record_entity_1.ListingRecord, 'r')
            .where('r.id = :id', { id });
        if (withDeleted)
            qb.withDeleted();
        const accessFilter = await this.buildStoreFilter(user, 'r');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        return qb.getOne();
    }
    async findAccessibleListings(ids, user) {
        if (!ids.length)
            return [];
        const qb = this.listingRepo
            .createQueryBuilder('r')
            .where('r.id IN (:...ids)', { ids });
        const accessFilter = await this.buildStoreFilter(user, 'r');
        if (accessFilter)
            qb.andWhere(accessFilter.sql, accessFilter.params);
        return qb.getMany();
    }
    async upsertBatch(batch) {
        await this.listingRepo
            .createQueryBuilder()
            .insert()
            .into(listing_record_entity_1.ListingRecord)
            .values(batch)
            .orUpdate(UPSERT_COLUMNS, [
            'sourceFileName',
            'sheetName',
            'sourceRowNumber',
        ])
            .execute();
    }
    findHeaderRow(rows) {
        for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
            const row = rows[r] ?? [];
            for (let c = 0; c < row.length; c += 1) {
                const norm = this.normalize(row[c]);
                if (norm === 'customlabelsku') {
                    return r;
                }
            }
        }
        return null;
    }
    buildColumnMap(headerRow) {
        const map = new Map();
        for (let c = 0; c < headerRow.length; c += 1) {
            const raw = String(headerRow[c] ?? '').trim();
            if (!raw)
                continue;
            const stripped = raw.startsWith('*') ? raw.slice(1) : raw;
            if (/^action\s*\(/i.test(stripped)) {
                map.set(c, 'action');
                continue;
            }
            const key = raw.toLowerCase();
            const prop = HEADER_TO_PROPERTY[key];
            if (prop) {
                map.set(c, prop);
            }
        }
        return map;
    }
    normalize(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }
    cleanValue(value) {
        const str = String(value ?? '').trim();
        if (!str || /^nan$/i.test(str) || /^none$/i.test(str)) {
            return null;
        }
        return str;
    }
    parseMoney(raw) {
        if (raw == null || String(raw).trim() === '')
            return null;
        const cleaned = String(raw)
            .replace(/,/g, '.')
            .replace(/[^0-9.]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }
    parseQty(raw) {
        if (raw == null || String(raw).trim() === '')
            return null;
        const n = Number(String(raw).replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? n : null;
    }
    applyDerivedNumericFields(listing, changes) {
        if (changes.startPrice !== undefined) {
            listing.startPriceNum = this.parseMoney(listing.startPrice);
        }
        if (changes.quantity !== undefined) {
            listing.quantityNum = this.parseQty(listing.quantity);
        }
        if (changes.buyItNowPrice !== undefined) {
            listing.buyItNowPriceNum = this.parseMoney(listing.buyItNowPrice);
        }
        if (changes.bestOfferAutoAcceptPrice !== undefined) {
            listing.bestOfferAutoAcceptPriceNum = this.parseMoney(listing.bestOfferAutoAcceptPrice);
        }
        if (changes.minimumBestOfferPrice !== undefined) {
            listing.minimumBestOfferPriceNum = this.parseMoney(listing.minimumBestOfferPrice);
        }
        if (changes.shippingService1Cost !== undefined) {
            listing.shippingService1CostNum = this.parseMoney(listing.shippingService1Cost);
        }
        if (changes.shippingService2Cost !== undefined) {
            listing.shippingService2CostNum = this.parseMoney(listing.shippingService2Cost);
        }
    }
    async assertSkuRenameAllowed(em, listing, oldSku, changes) {
        if (changes.customLabelSku === undefined)
            return;
        const newSku = typeof changes.customLabelSku === 'string'
            ? changes.customLabelSku.trim() || null
            : changes.customLabelSku;
        if (!newSku || newSku === oldSku)
            return;
        const productQb = em
            .createQueryBuilder(catalog_product_entity_js_1.CatalogProduct, 'p')
            .where('p.sku = :sku', { sku: newSku });
        if (listing.organizationId) {
            productQb.andWhere('p.organizationId = :organizationId', {
                organizationId: listing.organizationId,
            });
        }
        else {
            productQb.andWhere('p.organizationId IS NULL');
        }
        if (listing.vertical) {
            productQb.andWhere('p.vertical = :vertical', {
                vertical: listing.vertical,
            });
        }
        else {
            productQb.andWhere('p.vertical IS NULL');
        }
        const conflictingProduct = await productQb.getOne();
        if (conflictingProduct) {
            throw new common_1.ConflictException(`SKU "${newSku}" is already used by another catalog product.`);
        }
        const conflictingListing = await em
            .createQueryBuilder(listing_record_entity_1.ListingRecord, 'l')
            .where('l.customLabelSku = :sku', { sku: newSku })
            .andWhere('l.deletedAt IS NULL')
            .andWhere('l.id != :id', { id: listing.id })
            .andWhere(listing.organizationId
            ? 'l.organizationId = :organizationId'
            : 'l.organizationId IS NULL', listing.organizationId
            ? { organizationId: listing.organizationId }
            : {})
            .andWhere(listing.vertical ? 'l.vertical = :vertical' : 'l.vertical IS NULL', listing.vertical ? { vertical: listing.vertical } : {})
            .getOne();
        if (conflictingListing) {
            throw new common_1.ConflictException(`SKU "${newSku}" is already used by another listing.`);
        }
    }
    async syncSkuRenameToCatalogAndSiblings(em, saved, oldSku, changes) {
        if (changes.customLabelSku === undefined)
            return;
        const newSku = saved.customLabelSku?.trim() || null;
        if (!oldSku || oldSku === newSku)
            return;
        const scope = {
            organizationId: saved.organizationId ?? (0, typeorm_2.IsNull)(),
            vertical: saved.vertical ?? (0, typeorm_2.IsNull)(),
        };
        if (newSku) {
            await em.update(catalog_product_entity_js_1.CatalogProduct, { sku: oldSku, ...scope }, { sku: newSku });
        }
        await em.update(listing_record_entity_1.ListingRecord, { customLabelSku: oldSku, ...scope }, { customLabelSku: newSku });
    }
    async syncSharedPriceQuantityToCatalogAndSiblings(em, saved, changes) {
        const sku = saved.customLabelSku;
        if (!sku)
            return;
        const priceChanged = changes.startPrice !== undefined;
        const qtyChanged = changes.quantity !== undefined;
        if (!priceChanged && !qtyChanged)
            return;
        const scope = {
            organizationId: saved.organizationId ?? (0, typeorm_2.IsNull)(),
            vertical: saved.vertical ?? (0, typeorm_2.IsNull)(),
        };
        if (priceChanged) {
            await em.update(catalog_product_entity_js_1.CatalogProduct, { sku, ...scope }, { price: saved.startPriceNum });
            await em.update(listing_record_entity_1.ListingRecord, { customLabelSku: sku, ...scope }, {
                startPrice: saved.startPrice,
                startPriceNum: saved.startPriceNum,
            });
        }
        if (qtyChanged) {
            await em.update(catalog_product_entity_js_1.CatalogProduct, { sku, ...scope }, { quantity: saved.quantityNum });
            await em.update(listing_record_entity_1.ListingRecord, { customLabelSku: sku, ...scope }, {
                quantity: saved.quantity,
                quantityNum: saved.quantityNum,
            });
        }
    }
    computeDiff(before, after) {
        const diff = {};
        const tracked = new Set([
            'title',
            'startPrice',
            'quantity',
            'description',
            'conditionId',
            'buyItNowPrice',
            'bestOfferEnabled',
            'bestOfferAutoAcceptPrice',
            'minimumBestOfferPrice',
            'format',
            'duration',
            'location',
            'shippingService1Option',
            'shippingService1Cost',
            'shippingService2Option',
            'shippingService2Cost',
            'maxDispatchTime',
            'returnsAcceptedOption',
            'returnsWithinOption',
            'refundOption',
            'returnShippingCostPaidBy',
            'shippingProfileName',
            'returnProfileName',
            'paymentProfileName',
            'cBrand',
            'cType',
            'customLabelSku',
            'categoryId',
            'categoryName',
            'itemPhotoUrl',
            'startPriceNum',
            'quantityNum',
            'buyItNowPriceNum',
            'bestOfferAutoAcceptPriceNum',
            'minimumBestOfferPriceNum',
            'shippingService1CostNum',
            'shippingService2CostNum',
        ]);
        for (const key of tracked) {
            const fromVal = before[key];
            const toVal = after[key];
            if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
                diff[key] = { from: fromVal, to: toVal };
            }
        }
        return diff;
    }
};
exports.ListingsService = ListingsService;
exports.ListingsService = ListingsService = ListingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_record_entity_1.ListingRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(listing_revision_entity_1.ListingRevision)),
    __param(2, (0, typeorm_1.InjectRepository)(catalog_product_entity_js_1.CatalogProduct)),
    __param(3, (0, typeorm_1.InjectRepository)(listing_action_log_entity_js_1.ListingActionLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        rbac_service_js_1.RbacService,
        store_access_service_js_1.StoreAccessService,
        teams_service_js_1.TeamsService,
        automotive_access_scope_service_js_1.AutomotiveAccessScopeService])
], ListingsService);
//# sourceMappingURL=listings.service.js.map
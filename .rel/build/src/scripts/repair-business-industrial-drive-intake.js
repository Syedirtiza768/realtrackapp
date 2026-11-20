"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const app_module_js_1 = require("../app.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const business_industrial_review_entity_js_1 = require("../verticals/entities/business-industrial-review.entity.js");
const business_industrial_image_intake_asset_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-asset.entity.js");
const business_industrial_image_intake_group_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-group.entity.js");
const business_industrial_image_intake_job_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-job.entity.js");
const business_industrial_image_intake_service_js_1 = require("../verticals/business-industrial-image-intake.service.js");
const business_industrial_image_intake_util_js_1 = require("../verticals/business-industrial-image-intake.util.js");
const CATEGORY_OVERRIDES = {
    'BNI-106.2': { id: '67882', name: 'Signal Finders' },
    'RDI-8': { id: '184501', name: 'Medical Carts & Stands' },
    'RDI-9': { id: '184501', name: 'Medical Carts & Stands' },
};
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : {};
}
function folderSku(folderName) {
    const normalized = folderName
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s\-_\/\\]+/g, '');
    const suffix = normalized.startsWith('bni') ? normalized.slice(3) : normalized;
    return `BNI-${(suffix || 'unassigned').slice(0, 156)}`;
}
function sourceToken(referenceUrl) {
    const folderId = referenceUrl
        ? /\/folders\/([^/?#]+)/.exec(referenceUrl)?.[1]
        : null;
    return (folderId || 'intake')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .slice(0, 12)
        .toLowerCase() || 'intake';
}
function markerFor(job, group) {
    return {
        jobId: job.id,
        groupId: group.id,
        sourceReferenceUrl: job.sourceReferenceUrl,
        sourceFolderName: group.basePartName,
    };
}
function matchesSource(product, marker) {
    const source = asRecord(asRecord(product.optimizationPayload).__businessIndustrialIntake);
    return (source.sourceReferenceUrl === marker.sourceReferenceUrl &&
        source.sourceFolderName === marker.sourceFolderName);
}
async function ensureListingProjection(listings, product, job, group, attributes, sourceListing) {
    if (!product.organizationId)
        return;
    const sourceFileName = `business-industrial-intake-${job.id}`;
    const sourceFilePath = `business-industrial-intake:${job.id}`;
    let listing = await listings.findOne({
        where: {
            sourceFileName,
            sheetName: group.id,
            sourceRowNumber: 1,
        },
    });
    if (!listing && product.sku) {
        listing = await listings.findOne({
            where: {
                organizationId: product.organizationId,
                vertical: 'business_industrial',
                customLabelSku: product.sku,
            },
        });
    }
    if (!listing) {
        listing = listings.create({
            ...(sourceListing ?? {}),
            id: undefined,
            organizationId: product.organizationId,
            vertical: 'business_industrial',
            sourceFileName,
            sourceFilePath,
            sheetName: group.id,
            sourceRowNumber: 1,
            origin: sourceListing?.origin ?? listing_record_entity_js_1.ListingOrigin.ADD_PART,
        });
    }
    listing.organizationId = product.organizationId;
    listing.vertical = 'business_industrial';
    listing.verticalAttributes = attributes;
    if (!listing.sourceFileName)
        listing.sourceFileName = sourceFileName;
    if (!listing.sourceFilePath)
        listing.sourceFilePath = sourceFilePath;
    if (!listing.sheetName)
        listing.sheetName = group.id;
    if (!listing.sourceRowNumber)
        listing.sourceRowNumber = 1;
    if (!listing.origin)
        listing.origin = listing_record_entity_js_1.ListingOrigin.ADD_PART;
    listing.action = 'Add';
    listing.customLabelSku = product.sku;
    listing.categoryId = product.categoryId;
    listing.categoryName = product.categoryName;
    listing.title = product.title;
    listing.startPrice = product.price == null ? null : String(product.price);
    listing.startPriceNum = product.price;
    listing.quantity = product.quantity == null ? null : String(product.quantity);
    listing.quantityNum = product.quantity;
    listing.itemPhotoUrl = product.imageUrls.join('|') || null;
    listing.conditionId = product.conditionId;
    listing.conditionLabel = product.conditionLabel;
    listing.description = product.description;
    listing.format = listing.format ?? 'FixedPrice';
    listing.duration = listing.duration ?? 'GTC';
    listing.cBrand = product.brand;
    listing.cType = product.partType;
    listing.cManufacturerPartNumber = product.mpn;
    listing.status = listing.status === 'published' ? 'published' : 'draft';
    listing.enrichmentStage = 'completed';
    await listings.save(listing);
}
async function uniqueSku(products, organizationId, baseSku, marker) {
    const existing = await products.findOne({
        where: {
            organizationId,
            vertical: 'business_industrial',
            sku: baseSku,
        },
    });
    if (!existing || matchesSource(existing, marker))
        return baseSku;
    const token = sourceToken(marker.sourceReferenceUrl);
    const suffix = `-${token}`;
    let candidate = `${baseSku.slice(0, 160 - suffix.length)}${suffix}`;
    let counter = 2;
    while (await products.findOne({
        where: {
            organizationId,
            vertical: 'business_industrial',
            sku: candidate,
        },
    })) {
        const nextSuffix = `-${token}-${counter++}`;
        candidate = `${baseSku.slice(0, 160 - nextSuffix.length)}${nextSuffix}`;
    }
    return candidate;
}
async function copyReview(reviews, source, product, approve, userId) {
    const review = reviews.create({
        ...(source ?? {}),
        id: undefined,
        organizationId: product.organizationId,
        catalogProductId: product.id,
        status: approve ? 'approved' : source?.status ?? 'pending',
        provenanceConfirmed: approve || source?.provenanceConfirmed || false,
        specificationsVerified: approve || source?.specificationsVerified || false,
        testingReviewed: approve || source?.testingReviewed || false,
        restrictedCategoryCleared: approve || source?.restrictedCategoryCleared || false,
        reviewedByUserId: approve ? userId : source?.reviewedByUserId ?? null,
        reviewedAt: approve ? new Date() : source?.reviewedAt ?? null,
        reviewedProductUpdatedAt: product.updatedAt,
        notes: approve
            ? 'Operator-authorized B&I intake readiness backfill; source images and evidence remain attached.'
            : source?.notes ?? null,
    });
    await reviews.save(review);
}
async function main() {
    const userId = process.argv[2]?.trim();
    const jobIds = process.argv.slice(3).filter((value) => !value.startsWith('--'));
    const approve = process.argv.includes('--operator-authorized-ready');
    if (!userId || jobIds.length === 0)
        throw new Error('Usage: repair-business-industrial-drive-intake <user-id> <job-id> [job-id ...] [--operator-authorized-ready]');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['log', 'warn', 'error'],
    });
    try {
        const users = app.get((0, typeorm_1.getRepositoryToken)(user_entity_js_1.User));
        const jobs = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob));
        const groups = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup));
        const assets = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_asset_entity_js_1.BusinessIndustrialImageIntakeAsset));
        const products = app.get((0, typeorm_1.getRepositoryToken)(catalog_product_entity_js_1.CatalogProduct));
        const listings = app.get((0, typeorm_1.getRepositoryToken)(listing_record_entity_js_1.ListingRecord));
        const reviews = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_review_entity_js_1.BusinessIndustrialReview));
        const intake = app.get(business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService);
        const user = await users.findOne({ where: { id: userId } });
        if (!user?.active)
            throw new Error('The supplied operator user is inactive or missing');
        const selectedJobs = await jobs.find({ where: { id: (0, typeorm_2.In)(jobIds) } });
        if (selectedJobs.length !== jobIds.length)
            throw new Error('One or more supplied B&I intake jobs were not found');
        const jobById = new Map(selectedJobs.map((job) => [job.id, job]));
        for (const job of selectedJobs) {
            await intake.processJob(job.id, true, true);
        }
        const selectedGroups = await groups.find({
            where: { jobId: (0, typeorm_2.In)(jobIds) },
            order: { createdAt: 'ASC' },
        });
        const organizationId = selectedJobs[0].organizationId;
        const rank = new Map(jobIds.map((id, index) => [id, index]));
        const groupsByProduct = new Map();
        for (const group of selectedGroups) {
            if (!group.catalogProductId)
                continue;
            groupsByProduct.set(group.catalogProductId, [
                ...(groupsByProduct.get(group.catalogProductId) ?? []),
                group,
            ]);
        }
        let cloned = 0;
        for (const linkedGroups of groupsByProduct.values()) {
            if (linkedGroups.length < 2)
                continue;
            linkedGroups.sort((left, right) => (rank.get(left.jobId) ?? 999) - (rank.get(right.jobId) ?? 999));
            const retainedGroup = linkedGroups[0];
            const sourceProduct = await products.findOne({ where: { id: retainedGroup.catalogProductId } });
            if (!sourceProduct || !sourceProduct.organizationId)
                continue;
            const sourceReview = await reviews.findOne({
                where: {
                    organizationId: sourceProduct.organizationId,
                    catalogProductId: sourceProduct.id,
                },
            });
            for (const duplicateGroup of linkedGroups.slice(1)) {
                const job = jobById.get(duplicateGroup.jobId);
                const marker = markerFor(job, duplicateGroup);
                const existingForSource = await products
                    .createQueryBuilder('product')
                    .where('product.organizationId = :organizationId', { organizationId })
                    .andWhere('product.vertical = :vertical', { vertical: 'business_industrial' })
                    .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceReferenceUrl' = :sourceReferenceUrl`, { sourceReferenceUrl: marker.sourceReferenceUrl })
                    .andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'sourceFolderName' = :sourceFolderName`, { sourceFolderName: marker.sourceFolderName })
                    .getOne();
                if (existingForSource) {
                    duplicateGroup.catalogProductId = existingForSource.id;
                    await groups.save(duplicateGroup);
                    continue;
                }
                const imageUrls = (await assets.find({
                    where: { groupId: duplicateGroup.id, organizationId },
                    order: { createdAt: 'ASC' },
                })).map((asset) => asset.cdnUrl);
                const sku = await uniqueSku(products, organizationId, folderSku(duplicateGroup.basePartName), marker);
                const clone = products.create({
                    ...sourceProduct,
                    id: undefined,
                    sku,
                    ebayItemId: null,
                    epid: null,
                    imageUrls: imageUrls.length ? imageUrls : sourceProduct.imageUrls,
                    optimizationPayload: {
                        ...asRecord(sourceProduct.optimizationPayload),
                        __businessIndustrialIntake: marker,
                    },
                });
                const saved = await products.save(clone);
                await copyReview(reviews, sourceReview, saved, approve, user.id);
                const sourceListing = sourceProduct.sku
                    ? await listings.findOne({
                        where: {
                            organizationId,
                            vertical: 'business_industrial',
                            customLabelSku: sourceProduct.sku,
                        },
                    })
                    : null;
                await ensureListingProjection(listings, saved, job, duplicateGroup, asRecord(saved.verticalAttributes), sourceListing);
                duplicateGroup.catalogProductId = saved.id;
                duplicateGroup.detectionStatus = 'draft_created';
                duplicateGroup.errorMessage = null;
                await groups.save(duplicateGroup);
                cloned++;
            }
        }
        let updated = 0;
        for (const group of selectedGroups) {
            if (!group.catalogProductId)
                continue;
            const product = await products.findOne({ where: { id: group.catalogProductId } });
            if (!product || !product.organizationId)
                continue;
            const job = jobById.get(group.jobId);
            const marker = markerFor(job, group);
            const override = CATEGORY_OVERRIDES[group.basePartName.trim()];
            const attributes = (0, business_industrial_image_intake_util_js_1.applyBusinessIndustrialFulfillmentDefaults)(asRecord(product.verticalAttributes), {
                dispatchLocation: process.env.BUSINESS_INDUSTRIAL_DEFAULT_DISPATCH_LOCATION || 'United States',
                shippingCoverage: process.env.BUSINESS_INDUSTRIAL_DEFAULT_SHIPPING_COVERAGE || 'United States',
            });
            if (product.sku === 'BNI-114' && !attributes.Model)
                attributes.Model = 'Model Not Specified';
            if (product.sku === 'BNI-120.1' && !attributes.Type)
                attributes.Type = 'Power Amplifier';
            product.verticalAttributes = attributes;
            product.optimizationPayload = {
                ...asRecord(product.optimizationPayload),
                __businessIndustrialIntake: marker,
            };
            if (override) {
                product.categoryId = override.id;
                product.categoryName = override.name;
            }
            if (!product.mpn?.trim())
                product.mpn = 'Does Not Apply';
            product.ebayValidationStatus = null;
            product.manualReview = false;
            if (approve)
                product.verticalValidationStatus = 'approved';
            await products.save(product);
            const review = await reviews.findOne({
                where: { organizationId: product.organizationId, catalogProductId: product.id },
            });
            if (approve) {
                if (review) {
                    review.status = 'approved';
                    review.provenanceConfirmed = true;
                    review.specificationsVerified = true;
                    review.testingReviewed = true;
                    review.restrictedCategoryCleared = true;
                    review.riskFlags = [];
                    review.reviewedByUserId = user.id;
                    review.reviewedAt = new Date();
                    review.reviewedProductUpdatedAt = product.updatedAt;
                    review.notes =
                        'Operator-authorized B&I intake readiness backfill; source images and evidence remain attached.';
                    await reviews.save(review);
                }
                else {
                    await copyReview(reviews, null, product, true, user.id);
                }
            }
            const projections = await listings.find({
                where: {
                    organizationId: product.organizationId,
                    vertical: 'business_industrial',
                    customLabelSku: product.sku,
                },
            });
            for (const listing of projections) {
                listing.verticalAttributes = attributes;
                listing.categoryId = product.categoryId;
                listing.categoryName = product.categoryName;
                listing.cManufacturerPartNumber = product.mpn;
                await listings.save(listing);
            }
            await ensureListingProjection(listings, product, job, group, attributes, projections[0] ?? null);
            updated++;
        }
        const refreshedGroups = await groups.find({ where: { jobId: (0, typeorm_2.In)(jobIds) } });
        const refreshedJobs = await jobs.find({ where: { id: (0, typeorm_2.In)(jobIds) } });
        console.log(JSON.stringify({
            jobs: refreshedJobs.map((job) => ({ id: job.id, status: job.status, folders: `${job.processedFolders}/${job.totalFolders}`, images: `${job.processedImages}/${job.totalImages}`, failed: job.failedFolders, error: job.errorMessage })),
            groups: refreshedGroups.length,
            groupsWithDrafts: refreshedGroups.filter((group) => Boolean(group.catalogProductId)).length,
            cloned,
            productsUpdated: updated,
            operatorAuthorizedReady: approve,
            published: false,
        }));
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=repair-business-industrial-drive-intake.js.map
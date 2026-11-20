"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const app_module_js_1 = require("../app.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const business_industrial_image_intake_util_js_1 = require("../verticals/business-industrial-image-intake.util.js");
function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value }
        : {};
}
function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function conditionId(label) {
    const normalized = label?.toUpperCase() ?? '';
    if (normalized.includes('NEW'))
        return '1000';
    if (normalized.includes('REFURB'))
        return '2500';
    if (normalized.includes('PART'))
        return '7000';
    return '3000';
}
function median(values) {
    const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
    if (!sorted.length)
        return null;
    const middle = Math.floor(sorted.length / 2);
    return Math.round((sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
}
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn'],
    });
    try {
        const products = app.get((0, typeorm_1.getRepositoryToken)(catalog_product_entity_js_1.CatalogProduct));
        const listings = app.get((0, typeorm_1.getRepositoryToken)(listing_record_entity_js_1.ListingRecord));
        const rows = await products.find({
            where: { vertical: 'business_industrial' },
            order: { createdAt: 'ASC' },
        });
        let updatedProducts = 0;
        let updatedListings = 0;
        const priced = rows.filter((product) => product.price != null && Number(product.price) > 0);
        const globalMedian = median(priced.map((product) => Number(product.price)));
        const categoryMedians = new Map();
        for (const categoryId of new Set(priced.map((product) => product.categoryId).filter(Boolean))) {
            const value = median(priced
                .filter((product) => product.categoryId === categoryId)
                .map((product) => Number(product.price)));
            if (value != null)
                categoryMedians.set(categoryId, value);
        }
        for (const product of rows) {
            const optimization = record(product.optimizationPayload);
            const itemSpecifics = record(optimization.itemSpecifics);
            const original = {
                ...record(product.verticalAttributes),
                ...itemSpecifics,
            };
            const mpn = text(product.mpn) ||
                text(original.mpn) ||
                text(original.MPN) ||
                text(original.model) ||
                text(original.Model) ||
                'Does Not Apply';
            const attributes = (0, business_industrial_image_intake_util_js_1.applyBusinessIndustrialFulfillmentDefaults)({
                ...original,
                mpn,
                ...(text(product.partType) && !text(original.partType)
                    ? { partType: text(product.partType) }
                    : {}),
            }, {
                dispatchLocation: process.env.BUSINESS_INDUSTRIAL_DEFAULT_DISPATCH_LOCATION ||
                    'United States',
                shippingCoverage: process.env.BUSINESS_INDUSTRIAL_DEFAULT_SHIPPING_COVERAGE ||
                    'United States',
            });
            product.mpn = mpn;
            product.partType =
                text(product.partType) ||
                    text(attributes.partType) ||
                    text(attributes.Type);
            product.conditionId =
                text(product.conditionId) || conditionId(text(product.conditionLabel));
            product.conditionLabel =
                text(product.conditionLabel) ||
                    (product.conditionId === '1000'
                        ? 'NEW'
                        : product.conditionId === '7000'
                            ? 'FOR_PARTS'
                            : product.conditionId === '2500'
                                ? 'REFURBISHED'
                                : 'USED');
            if (product.price == null || Number(product.price) <= 0) {
                const fallback = (product.categoryId
                    ? categoryMedians.get(product.categoryId)
                    : undefined) ?? globalMedian;
                if (fallback != null) {
                    product.price = fallback;
                    product.optimizationPayload = {
                        ...record(product.optimizationPayload),
                        pricing: {
                            source: product.categoryId && categoryMedians.has(product.categoryId)
                                ? 'category_catalog_median'
                                : 'business_industrial_catalog_median',
                            price: fallback,
                            reason: 'No usable live market or image estimate was available; used the median of existing positive B&I catalog prices.',
                        },
                    };
                }
            }
            product.verticalAttributes =
                attributes;
            product.ebayValidationStatus = null;
            await products.save(product);
            updatedProducts += 1;
            if (!product.organizationId || !product.sku)
                continue;
            const projections = await listings.find({
                where: {
                    organizationId: product.organizationId,
                    vertical: 'business_industrial',
                    customLabelSku: product.sku,
                },
            });
            for (const listing of projections) {
                listing.verticalAttributes = attributes;
                listing.cManufacturerPartNumber = mpn;
                listing.cType = product.partType;
                listing.conditionId = product.conditionId;
                listing.conditionLabel = product.conditionLabel;
                listing.startPrice =
                    product.price == null ? null : String(product.price);
                listing.startPriceNum = product.price;
                await listings.save(listing);
                updatedListings += 1;
            }
        }
        console.log(JSON.stringify({
            productsFound: rows.length,
            updatedProducts,
            updatedListings,
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
//# sourceMappingURL=backfill-business-industrial-publish-readiness.js.map
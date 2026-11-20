"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const app_module_js_1 = require("../app.module.js");
const catalog_product_entity_js_1 = require("../catalog-import/entities/catalog-product.entity.js");
const listing_record_entity_js_1 = require("../listings/listing-record.entity.js");
const connected_ebay_account_entity_js_1 = require("../integrations/ebay/entities/connected-ebay-account.entity.js");
const verticals_service_js_1 = require("../verticals/verticals.service.js");
async function main() {
    const accountId = process.argv[2]?.trim();
    const marketplaceId = process.argv[3]?.trim() || 'EBAY_US';
    const intakeJobIds = process.argv
        .slice(4)
        .filter((value) => !value.startsWith('--'))
        .map((value) => value.trim())
        .filter(Boolean);
    const exitAfterReport = process.argv.includes('--exit-after-report');
    if (!accountId)
        throw new Error('Usage: audit-business-industrial-publish-readiness <ebay-account-id> [marketplace-id]');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn'],
    });
    try {
        const accounts = app.get((0, typeorm_1.getRepositoryToken)(connected_ebay_account_entity_js_1.ConnectedEbayAccount));
        const products = app.get((0, typeorm_1.getRepositoryToken)(catalog_product_entity_js_1.CatalogProduct));
        const listings = app.get((0, typeorm_1.getRepositoryToken)(listing_record_entity_js_1.ListingRecord));
        const verticals = app.get(verticals_service_js_1.VerticalsService);
        const account = await accounts.findOne({ where: { id: accountId } });
        if (!account?.primaryStoreId || !account.organizationId)
            throw new Error('B&I eBay account/store is unavailable');
        const productQuery = products
            .createQueryBuilder('product')
            .where('product.organizationId = :organizationId', {
            organizationId: account.organizationId,
        })
            .andWhere('product.vertical = :vertical', {
            vertical: 'business_industrial',
        });
        if (intakeJobIds.length) {
            productQuery.andWhere(`product.optimizationPayload -> '__businessIndustrialIntake' ->> 'jobId' IN (:...intakeJobIds)`, { intakeJobIds });
        }
        const rows = await productQuery
            .orderBy('product.createdAt', 'ASC')
            .getMany();
        const failures = [];
        let warnings = 0;
        for (const product of rows) {
            const listing = product.sku
                ? await listings.findOne({
                    where: {
                        organizationId: account.organizationId,
                        vertical: 'business_industrial',
                        customLabelSku: product.sku,
                    },
                })
                : null;
            const projection = await verticals.buildPublishProjection({
                vertical: 'business_industrial',
                product,
                listing,
                storeId: account.primaryStoreId,
                marketplaceId,
            });
            if (!projection)
                continue;
            warnings += projection.warnings.length;
            if (projection.blockingErrors.length)
                failures.push({
                    sku: product.sku ?? product.id,
                    title: product.title,
                    categoryId: product.categoryId,
                    errors: projection.blockingErrors,
                });
        }
        console.log(JSON.stringify({
            total: rows.length,
            ready: rows.length - failures.length,
            blocked: failures.length,
            warningCount: warnings,
            failures,
            published: false,
        }));
        if (exitAfterReport)
            process.exit(failures.length ? 2 : 0);
        if (failures.length)
            process.exitCode = 2;
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=audit-business-industrial-publish-readiness.js.map
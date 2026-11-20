"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingSkuMarketplaceUniqueIndex1783000000000 = void 0;
class ListingSkuMarketplaceUniqueIndex1783000000000 {
    name = 'ListingSkuMarketplaceUniqueIndex1783000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_sku_unique_active"
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_marketplace_unique_active"
      ON listing_records ("customLabelSku", "marketplace")
      WHERE "customLabelSku" IS NOT NULL
        AND "deletedAt" IS NULL
        AND "marketplace" IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_sku_marketplace_unique_active"
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_unique_active"
      ON listing_records ("customLabelSku")
      WHERE "customLabelSku" IS NOT NULL AND "deletedAt" IS NULL
    `);
    }
}
exports.ListingSkuMarketplaceUniqueIndex1783000000000 = ListingSkuMarketplaceUniqueIndex1783000000000;
//# sourceMappingURL=1783000000000-ListingSkuMarketplaceUniqueIndex.js.map
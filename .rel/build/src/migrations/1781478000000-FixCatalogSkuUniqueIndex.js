"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixCatalogSkuUniqueIndex1781478000000 = void 0;
class FixCatalogSkuUniqueIndex1781478000000 {
    name = 'FixCatalogSkuUniqueIndex1781478000000';
    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_catalog_sku"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_catalog_sku" ON "catalog_products" ("sku")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_catalog_sku"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_catalog_sku" ON "catalog_products" ("sku") WHERE "sku" IS NOT NULL`);
    }
}
exports.FixCatalogSkuUniqueIndex1781478000000 = FixCatalogSkuUniqueIndex1781478000000;
//# sourceMappingURL=1781478000000-FixCatalogSkuUniqueIndex.js.map
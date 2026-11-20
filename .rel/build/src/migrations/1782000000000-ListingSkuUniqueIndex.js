"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingSkuUniqueIndex1782000000000 = void 0;
class ListingSkuUniqueIndex1782000000000 {
    name = 'ListingSkuUniqueIndex1782000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "customLabelSku"
            ORDER BY "importedAt" ASC, id ASC
          ) AS rn
        FROM listing_records
        WHERE "customLabelSku" IS NOT NULL
          AND "deletedAt" IS NULL
      )
      UPDATE listing_records lr
      SET "customLabelSku" = lr."customLabelSku" || '-dup-' || substr(lr.id::text, 1, 8)
      FROM ranked r
      WHERE lr.id = r.id AND r.rn > 1
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_listing_sku_unique_active"
      ON listing_records ("customLabelSku")
      WHERE "customLabelSku" IS NOT NULL AND "deletedAt" IS NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_sku_unique_active"`);
    }
}
exports.ListingSkuUniqueIndex1782000000000 = ListingSkuUniqueIndex1782000000000;
//# sourceMappingURL=1782000000000-ListingSkuUniqueIndex.js.map
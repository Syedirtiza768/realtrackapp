"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddImagesVariantsGeneratedAtToCatalogProducts1789700000000 = void 0;
class AddImagesVariantsGeneratedAtToCatalogProducts1789700000000 {
    name = 'AddImagesVariantsGeneratedAtToCatalogProducts1789700000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "images_variants_generated_at" timestamptz
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_catalog_products_variants_pending"
        ON "catalog_products" ("id")
        WHERE "images_variants_generated_at" IS NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_catalog_products_variants_pending"
    `);
        await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "images_variants_generated_at"
    `);
    }
}
exports.AddImagesVariantsGeneratedAtToCatalogProducts1789700000000 = AddImagesVariantsGeneratedAtToCatalogProducts1789700000000;
//# sourceMappingURL=1789700000000-AddImagesVariantsGeneratedAtToCatalogProducts.js.map
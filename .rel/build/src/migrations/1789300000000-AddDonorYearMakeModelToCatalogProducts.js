"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDonorYearMakeModelToCatalogProducts1789300000000 = void 0;
class AddDonorYearMakeModelToCatalogProducts1789300000000 {
    name = 'AddDonorYearMakeModelToCatalogProducts1789300000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "donor_year" text,
        ADD COLUMN IF NOT EXISTS "donor_make" text,
        ADD COLUMN IF NOT EXISTS "donor_model" text
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "donor_model",
        DROP COLUMN IF EXISTS "donor_make",
        DROP COLUMN IF EXISTS "donor_year"
    `);
    }
}
exports.AddDonorYearMakeModelToCatalogProducts1789300000000 = AddDonorYearMakeModelToCatalogProducts1789300000000;
//# sourceMappingURL=1789300000000-AddDonorYearMakeModelToCatalogProducts.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWeightToListingRecord1787000000000 = void 0;
class AddWeightToListingRecord1787000000000 {
    name = 'AddWeightToListingRecord1787000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "weight" NUMERIC(10,3) NULL
    `);
        await queryRunner.query(`
      ALTER TABLE catalog_products
      ADD COLUMN "weight" NUMERIC(10,3) NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "weight"
    `);
        await queryRunner.query(`
      ALTER TABLE catalog_products
      DROP COLUMN IF EXISTS "weight"
    `);
    }
}
exports.AddWeightToListingRecord1787000000000 = AddWeightToListingRecord1787000000000;
//# sourceMappingURL=1787000000000-AddWeightToListingRecord.js.map
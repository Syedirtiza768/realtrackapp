"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFieldsToListingRecord1785100000000 = void 0;
class AddFieldsToListingRecord1785100000000 {
    name = 'AddFieldsToListingRecord1785100000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "cMaterial" TEXT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "cPlacement" TEXT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "country_of_origin" TEXT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "condition_label" TEXT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "cMaterial"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "cPlacement"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "country_of_origin"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "condition_label"
    `);
    }
}
exports.AddFieldsToListingRecord1785100000000 = AddFieldsToListingRecord1785100000000;
//# sourceMappingURL=1785100000000-AddFieldsToListingRecord.js.map
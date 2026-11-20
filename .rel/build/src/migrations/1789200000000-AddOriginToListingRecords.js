"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOriginToListingRecords1789200000000 = void 0;
class AddOriginToListingRecords1789200000000 {
    name = 'AddOriginToListingRecords1789200000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "origin" VARCHAR(20) NULL
    `);
        await queryRunner.query(`
      UPDATE listing_records
      SET "origin" = CASE
        WHEN "sourceFileName" = 'warehouse-intake' THEN 'add_part'
        ELSE 'pipeline_import'
      END
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ALTER COLUMN "origin" SET NOT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD CONSTRAINT "chk_listing_origin"
      CHECK ("origin" IN ('add_part', 'pipeline_import'))
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_origin"
      ON listing_records ("origin")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_origin"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP CONSTRAINT IF EXISTS "chk_listing_origin"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "origin"
    `);
    }
}
exports.AddOriginToListingRecords1789200000000 = AddOriginToListingRecords1789200000000;
//# sourceMappingURL=1789200000000-AddOriginToListingRecords.js.map
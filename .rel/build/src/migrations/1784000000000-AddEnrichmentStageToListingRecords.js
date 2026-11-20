"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEnrichmentStageToListingRecords1784000000000 = void 0;
class AddEnrichmentStageToListingRecords1784000000000 {
    name = 'AddEnrichmentStageToListingRecords1784000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentStage" VARCHAR(50) NULL
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_enrichment_stage"
      ON listing_records ("enrichmentStage")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_enrichment_stage"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentStage"
    `);
    }
}
exports.AddEnrichmentStageToListingRecords1784000000000 = AddEnrichmentStageToListingRecords1784000000000;
//# sourceMappingURL=1784000000000-AddEnrichmentStageToListingRecords.js.map
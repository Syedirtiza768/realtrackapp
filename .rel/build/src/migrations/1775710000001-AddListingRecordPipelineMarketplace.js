"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddListingRecordPipelineMarketplace1775710000001 = void 0;
class AddListingRecordPipelineMarketplace1775710000001 {
    name = 'AddListingRecordPipelineMarketplace1775710000001';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "listing_records"
      ADD COLUMN IF NOT EXISTS "pipeline_job_id" uuid
    `);
        await queryRunner.query(`
      ALTER TABLE "listing_records"
      ADD COLUMN IF NOT EXISTS "marketplace" varchar(3)
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_pipeline_job"
      ON "listing_records" ("pipeline_job_id")
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_marketplace"
      ON "listing_records" ("marketplace")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_pipeline_job"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_marketplace"`);
        await queryRunner.query(`ALTER TABLE "listing_records" DROP COLUMN IF EXISTS "pipeline_job_id"`);
        await queryRunner.query(`ALTER TABLE "listing_records" DROP COLUMN IF EXISTS "marketplace"`);
    }
}
exports.AddListingRecordPipelineMarketplace1775710000001 = AddListingRecordPipelineMarketplace1775710000001;
//# sourceMappingURL=1775710000001-AddListingRecordPipelineMarketplace.js.map
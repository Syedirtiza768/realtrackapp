"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEnrichmentRetryTrackingToListingRecords1789000000000 = void 0;
class AddEnrichmentRetryTrackingToListingRecords1789000000000 {
    name = 'AddEnrichmentRetryTrackingToListingRecords1789000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentRetryCount" INTEGER NOT NULL DEFAULT 0
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentLastFailureReason" TEXT NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentLastFailureAt" TIMESTAMPTZ NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentNextRetryAt" TIMESTAMPTZ NULL
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      ADD COLUMN "enrichmentPermanentFail" BOOLEAN NOT NULL DEFAULT false
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_listing_enrichment_next_retry"
      ON listing_records ("enrichmentNextRetryAt")
      WHERE "enrichmentNextRetryAt" IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_listing_enrichment_next_retry"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentPermanentFail"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentNextRetryAt"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentLastFailureAt"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentLastFailureReason"
    `);
        await queryRunner.query(`
      ALTER TABLE listing_records
      DROP COLUMN IF EXISTS "enrichmentRetryCount"
    `);
    }
}
exports.AddEnrichmentRetryTrackingToListingRecords1789000000000 = AddEnrichmentRetryTrackingToListingRecords1789000000000;
//# sourceMappingURL=1789000000000-AddEnrichmentRetryTrackingToListingRecords.js.map
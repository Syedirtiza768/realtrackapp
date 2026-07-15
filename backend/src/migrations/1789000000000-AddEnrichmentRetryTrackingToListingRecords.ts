import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add enrichment retry tracking columns to `listing_records` for the
 * auto-retry mechanism on failed enrichments.
 *
 * Tracks:
 *  - enrichmentRetryCount: how many times auto-retried
 *  - enrichmentLastFailureReason: classified error (transient/permanent)
 *  - enrichmentLastFailureAt: timestamp of last failure
 *  - enrichmentNextRetryAt: calculated next retry time
 *  - enrichmentPermanentFail: hard stop flag for deterministic failures
 */
export class AddEnrichmentRetryTrackingToListingRecords1789000000000 implements MigrationInterface {
  name = 'AddEnrichmentRetryTrackingToListingRecords1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
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

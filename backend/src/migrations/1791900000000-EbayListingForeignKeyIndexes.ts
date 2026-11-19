import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes the foreign-key columns that point at ebay_published_listings and
 * ebay_listing_channels.
 *
 * Postgres does not index the referencing side of a foreign key. Deleting a
 * listing-mirror row therefore scanned all of listing_action_logs (and the
 * bulk-job items) for references, and deleting an ebay_listing_channels row
 * scanned the whole ~2M-row / 6 GB ebay_published_listings table to null out
 * ebay_listing_channel_id. On 2026-11-18 a 74k-row mirror delete ran for more
 * than 10 minutes and held locks that blocked the published-listings sync.
 *
 * All partial (WHERE col IS NOT NULL): foreign-key actions only look up
 * non-null values, and most rows have none.
 *
 * Production got these with CREATE INDEX CONCURRENTLY on 2026-11-18, so
 * IF NOT EXISTS makes this a no-op there.
 */
export class EbayListingForeignKeyIndexes1791900000000 implements MigrationInterface {
  name = 'EbayListingForeignKeyIndexes1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lal_published_listing
      ON listing_action_logs (ebay_published_listing_id)
      WHERE ebay_published_listing_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lal_listing_channel
      ON listing_action_logs (ebay_listing_channel_id)
      WHERE ebay_listing_channel_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_epl_listing_channel
      ON ebay_published_listings (ebay_listing_channel_id)
      WHERE ebay_listing_channel_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_eplbji_published_listing
      ON ebay_published_listing_bulk_job_items (published_listing_id)
      WHERE published_listing_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_eae_listing_channel
      ON ebay_api_errors (ebay_listing_channel_id)
      WHERE ebay_listing_channel_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_eae_listing_channel`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_eplbji_published_listing`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_epl_listing_channel`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lal_listing_channel`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lal_published_listing`);
  }
}

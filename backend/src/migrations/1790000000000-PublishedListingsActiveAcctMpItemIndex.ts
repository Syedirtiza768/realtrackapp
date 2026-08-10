import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a partial composite index on ebay_published_listings
 * (ebay_account_id, marketplace_id, ebay_item_id) WHERE listing_status = 'active'.
 *
 * The published-listings sync prune step (markUnseenActiveAsEnded) filters
 * active rows by (ebay_account_id, marketplace_id, listing_status). With only
 * the single-column idx_epl_account index, the planner fell back to a lossy
 * bitmap heap scan over the bloated 1.5GB / 78k-block heap for Blackline
 * (150k active rows), taking ~58s and exceeding the pool's 30s statement_timeout
 * — aborting the whole sync AFTER the 124k-row upsert loop had finished.
 *
 * This partial index lets the prune read active item ids via an index-only scan
 * (when the visibility map is set) and lets the batched UPDATEs resolve via the
 * uq_epl_account_item unique index, avoiding the full heap scan.
 *
 * Created CONCURRENTLY-equivalent (IF NOT EXISTS) so it is a no-op on
 * environments where the index was already provisioned directly.
 */
export class PublishedListingsActiveAcctMpItemIndex1790000000000 implements MigrationInterface {
  name = 'PublishedListingsActiveAcctMpItemIndex1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_epl_active_acct_mp_item
      ON ebay_published_listings (ebay_account_id, marketplace_id, ebay_item_id)
      WHERE listing_status = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_epl_active_acct_mp_item`);
  }
}

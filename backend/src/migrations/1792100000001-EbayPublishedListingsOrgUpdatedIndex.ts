import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index for the unfiltered published-listings page.
 *
 * Serves `organization_id = ? ORDER BY updated_at DESC, id DESC LIMIT n` as an
 * ordered index scan. Without it the default page (no status filter) sorted most
 * of the 1.39M-row table: the planner chose a parallel sequential scan and a sort.
 * Production created this index out of band with CONCURRENTLY on 2026-11-28, so
 * IF NOT EXISTS makes this a no-op there.
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction, so this migration
 * opts out. The definition must match the production index exactly.
 */
export class EbayPublishedListingsOrgUpdatedIndex1792100000001 implements MigrationInterface {
  name = 'EbayPublishedListingsOrgUpdatedIndex1792100000001';

  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epl_org_updated
      ON ebay_published_listings (organization_id, updated_at DESC, id DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_epl_org_updated`,
    );
  }
}

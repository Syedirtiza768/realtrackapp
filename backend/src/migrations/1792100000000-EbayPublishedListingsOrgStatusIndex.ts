import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index for status-filtered published-listings pages.
 *
 * Serves `organization_id = ? AND listing_status = ? ORDER BY updated_at DESC, id DESC`
 * (the Active, Ended and Out of stock filters) as an ordered index scan, so the
 * page stops after its first rows. Production created this index out of band with
 * CONCURRENTLY on 2026-11-28, so IF NOT EXISTS makes this a no-op there.
 *
 * It does not serve the unfiltered default page. That page is served by
 * migration 1792100000001 (organization_id, updated_at DESC, id DESC).
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction, so this migration
 * opts out. The definition must match the production index exactly.
 */
export class EbayPublishedListingsOrgStatusIndex1792100000000 implements MigrationInterface {
  name = 'EbayPublishedListingsOrgStatusIndex1792100000000';

  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epl_org_status_updated
      ON ebay_published_listings (organization_id, listing_status, updated_at DESC, id DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_epl_org_status_updated`,
    );
  }
}

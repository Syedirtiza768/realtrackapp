import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partial index on ebay_published_listings.catalog_product_id.
 *
 * Only about 2.7% of the table's 1.39M rows (37,923 on 2026-11-22) have a
 * catalog_product_id, so the index covers just those rows (about 1 MB). It
 * serves three things: the correlated publication checks the working-tree
 * catalog predicate runs per catalog row (a Fashion count that took more than
 * 120 s without it runs in about 0.6 s with it, and the automotive count runs in
 * about 0.1 s); the foreign key to catalog_products, so deleting or re-linking a
 * catalog product no longer scans the whole table; and bulk writes on the table.
 *
 * CREATE INDEX CONCURRENTLY cannot run inside a transaction, so this migration
 * opts out. Production had this index created out of band with CONCURRENTLY,
 * so IF NOT EXISTS makes this a no-op there. The partial predicate must match
 * the out-of-band definition exactly.
 */
export class EbayPublishedListingsCatalogProductIndex1792000000001 implements MigrationInterface {
  name = 'EbayPublishedListingsCatalogProductIndex1792000000001';

  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_epl_catalog_product_id
      ON ebay_published_listings (catalog_product_id)
      WHERE catalog_product_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_epl_catalog_product_id`,
    );
  }
}

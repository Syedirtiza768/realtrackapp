import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index for the catalog workspace (Fashion, Auto Parts, B&I) list, count,
 * facet and summary queries. They filter catalog_products by
 * (organization_id, vertical) and sort by "createdAt" DESC, id ASC with LIMIT
 * (the 'newest' sort). The index order matches that sort exactly, so the first
 * page is read through the index instead of sorting every matching row.
 *
 * Measured on production on 2026-11-22 (Fashion organisation, 22k matching
 * rows, 71k table rows): the default search page went from about 630 ms to
 * about 14 ms, and the facet statements' combined time fell from about 25 s to
 * about 15 s before the facets rewrite.
 *
 * Plain CREATE INDEX: catalog_products is small (151 MB), so the brief SHARE
 * lock is acceptable. Production had this index created out of band with
 * CREATE INDEX CONCURRENTLY, so IF NOT EXISTS makes this a no-op there.
 */
export class CatalogProductsOrgVerticalCreatedIndex1792000000000 implements MigrationInterface {
  name = 'CatalogProductsOrgVerticalCreatedIndex1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_catalog_products_org_vertical_created
      ON catalog_products (organization_id, vertical, "createdAt" DESC, id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_catalog_products_org_vertical_created`,
    );
  }
}

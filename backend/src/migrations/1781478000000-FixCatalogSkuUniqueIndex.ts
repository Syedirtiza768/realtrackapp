import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCatalogSkuUniqueIndex1781478000000 implements MigrationInterface {
  name = 'FixCatalogSkuUniqueIndex1781478000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop partial unique index (WHERE sku IS NOT NULL) and replace with a
    // non-partial unique index so that ON CONFLICT (sku) DO UPDATE works.
    // PostgreSQL requires non-partial unique indexes as conflict targets for
    // ON CONFLICT DO UPDATE.
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_catalog_sku"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_catalog_sku" ON "catalog_products" ("sku")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_catalog_sku"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_catalog_sku" ON "catalog_products" ("sku") WHERE "sku" IS NOT NULL`,
    );
  }
}

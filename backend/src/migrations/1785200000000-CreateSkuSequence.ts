import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates a PostgreSQL sequence (sku_seq) for atomic, race-condition-free
 * SKU generation.  Seeds it from the current max BLA-XXXXX number across
 * both listing_records and catalog_products so existing data is untouched.
 */
export class CreateSkuSequence1785200000000 implements MigrationInterface {
  name = 'CreateSkuSequence1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find the highest existing numeric SKU across both tables
    const rows = await queryRunner.query(`
      SELECT COALESCE(MAX(num), 0) AS max_num FROM (
        SELECT MAX(CAST(SUBSTRING(r."customLabelSku" FROM 5) AS INTEGER)) AS num
          FROM listing_records r
         WHERE r."customLabelSku" ~ '^BLA-[0-9]+$'
        UNION ALL
        SELECT MAX(CAST(SUBSTRING(p.sku FROM 5) AS INTEGER)) AS num
          FROM catalog_products p
         WHERE p.sku ~ '^BLA-[0-9]+$'
      ) combined
    `);

    const maxNum = Number(rows[0]?.max_num ?? 0);

    // CREATE SEQUENCE … START WITH N means the first nextval() returns N.
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS sku_seq START WITH ${maxNum + 1}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS sku_seq`);
  }
}

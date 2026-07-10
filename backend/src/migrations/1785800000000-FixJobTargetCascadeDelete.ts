import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fix cascade delete on ebay_listing_job_targets.
 *
 * Previously catalog_product_id and ebay_account_id had ON DELETE CASCADE,
 * which destroyed job targets (including error_payload) when a catalog
 * product or connected eBay account was deleted. This made post-mortem
 * analysis of failed publish jobs impossible.
 *
 * Changes both FKs to ON DELETE SET NULL + nullable columns so job targets
 * and their error data are preserved for audit.
 */
export class FixJobTargetCascadeDelete1785800000000 implements MigrationInterface {
  name = 'FixJobTargetCascadeDelete1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_ebay_listing_job_targets_catalog_product_id"
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_ebay_listing_job_targets_ebay_account_id"
    `);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const fks: { constraint_name: string }[] = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'ebay_listing_job_targets'
        AND constraint_type = 'FOREIGN KEY'
    `);
    for (const row of fks) {
      if (
        row.constraint_name.includes('catalog_product') ||
        row.constraint_name.includes('ebay_account')
      ) {
        await queryRunner.query(
          `ALTER TABLE ebay_listing_job_targets DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`,
        );
      }
    }

    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ALTER COLUMN catalog_product_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ALTER COLUMN ebay_account_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ADD CONSTRAINT "FK_listing_job_targets_catalog_product"
        FOREIGN KEY (catalog_product_id) REFERENCES catalog_products(id)
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ADD CONSTRAINT "FK_listing_job_targets_ebay_account"
        FOREIGN KEY (ebay_account_id) REFERENCES connected_ebay_accounts(id)
        ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_listing_job_targets_catalog_product"
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_listing_job_targets_ebay_account"
    `);

    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ALTER COLUMN catalog_product_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ALTER COLUMN ebay_account_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ADD CONSTRAINT "FK_ebay_listing_job_targets_catalog_product_id"
        FOREIGN KEY (catalog_product_id) REFERENCES catalog_products(id)
        ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        ADD CONSTRAINT "FK_ebay_listing_job_targets_ebay_account_id"
        FOREIGN KEY (ebay_account_id) REFERENCES connected_ebay_accounts(id)
        ON DELETE CASCADE
    `);
  }
}

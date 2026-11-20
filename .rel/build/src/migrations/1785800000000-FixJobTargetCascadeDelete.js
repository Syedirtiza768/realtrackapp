"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixJobTargetCascadeDelete1785800000000 = void 0;
class FixJobTargetCascadeDelete1785800000000 {
    name = 'FixJobTargetCascadeDelete1785800000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_ebay_listing_job_targets_catalog_product_id"
    `);
        await queryRunner.query(`
      ALTER TABLE ebay_listing_job_targets
        DROP CONSTRAINT IF EXISTS "FK_ebay_listing_job_targets_ebay_account_id"
    `);
        const fks = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'ebay_listing_job_targets'
        AND constraint_type = 'FOREIGN KEY'
    `);
        for (const row of fks) {
            if (row.constraint_name.includes('catalog_product') ||
                row.constraint_name.includes('ebay_account')) {
                await queryRunner.query(`ALTER TABLE ebay_listing_job_targets DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
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
    async down(queryRunner) {
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
exports.FixJobTargetCascadeDelete1785800000000 = FixJobTargetCascadeDelete1785800000000;
//# sourceMappingURL=1785800000000-FixJobTargetCascadeDelete.js.map
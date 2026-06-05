import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends multi-store eBay schema: account sync metadata, API audit logs,
 * listing sync logs, and uniqueness constraints for tenant isolation.
 */
export class EbayMultiStoreExtensions1775300000000 implements MigrationInterface {
  name = 'EbayMultiStoreExtensions1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE connected_ebay_accounts
        ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_token_refresh_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_error_message TEXT,
        ADD COLUMN IF NOT EXISTS last_listings_fetched_count INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_policies_fetched_count INT NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_connected_ebay_org_user
        ON connected_ebay_accounts(organization_id, ebay_user_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_elc_product_account_mp
        ON ebay_listing_channels(catalog_product_id, ebay_account_id, marketplace_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_api_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ebay_account_id UUID REFERENCES connected_ebay_accounts(id) ON DELETE SET NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        http_method VARCHAR(10) NOT NULL,
        api_family VARCHAR(40) NOT NULL,
        endpoint_path VARCHAR(500) NOT NULL,
        marketplace_id VARCHAR(30),
        response_status INT,
        ebay_error_id VARCHAR(80),
        ebay_error_message TEXT,
        correlation_id VARCHAR(120),
        duration_ms INT,
        request_metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_audit_org ON ebay_api_audit_logs(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_audit_account ON ebay_api_audit_logs(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_audit_created ON ebay_api_audit_logs(created_at DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_listing_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30),
        sync_type VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL,
        items_processed INT NOT NULL DEFAULT 0,
        items_updated INT NOT NULL DEFAULT 0,
        items_failed INT NOT NULL DEFAULT 0,
        warnings JSONB NOT NULL DEFAULT '[]',
        errors JSONB NOT NULL DEFAULT '[]',
        raw_summary JSONB NOT NULL DEFAULT '{}',
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_sync_log_account ON ebay_listing_sync_logs(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_sync_log_started ON ebay_listing_sync_logs(started_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_listing_sync_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_api_audit_logs`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_elc_product_account_mp`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_connected_ebay_org_user`);
    await queryRunner.query(`
      ALTER TABLE connected_ebay_accounts
        DROP COLUMN IF EXISTS last_successful_sync_at,
        DROP COLUMN IF EXISTS last_token_refresh_at,
        DROP COLUMN IF EXISTS last_error_message,
        DROP COLUMN IF EXISTS last_listings_fetched_count,
        DROP COLUMN IF EXISTS last_policies_fetched_count
    `);
  }
}

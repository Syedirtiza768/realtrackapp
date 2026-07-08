import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Published Listings Management Module — stores live eBay listings mirrored
 * from all connected seller accounts for centralized dashboard management.
 */
export class PublishedListingsModule1785000000000 implements MigrationInterface {
  name = 'PublishedListingsModule1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_published_listings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        ebay_item_id VARCHAR(100),
        offer_id VARCHAR(100),
        sku TEXT,
        title TEXT NOT NULL,
        description TEXT,
        category_id VARCHAR(50),
        category_name TEXT,
        price NUMERIC(12,2),
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        quantity_available INT NOT NULL DEFAULT 0,
        quantity_sold INT NOT NULL DEFAULT 0,
        listing_status VARCHAR(30) NOT NULL DEFAULT 'active',
        listing_format VARCHAR(30) NOT NULL DEFAULT 'fixed_price',
        condition VARCHAR(60),
        listing_url TEXT,
        image_urls JSONB NOT NULL DEFAULT '[]',
        item_specifics JSONB NOT NULL DEFAULT '{}',
        shipping_details JSONB,
        listing_policies JSONB,
        compatibility JSONB,
        performance_metrics JSONB NOT NULL DEFAULT '{}',
        health_flags JSONB NOT NULL DEFAULT '[]',
        location JSONB,
        raw_ebay_response JSONB,
        account_display_name VARCHAR(200),
        ebay_start_time TIMESTAMPTZ,
        ebay_end_time TIMESTAMPTZ,
        ebay_last_modified_at TIMESTAMPTZ,
        last_synced_at TIMESTAMPTZ,
        catalog_product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
        ebay_listing_channel_id UUID REFERENCES ebay_listing_channels(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_org ON ebay_published_listings(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_account ON ebay_published_listings(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_store ON ebay_published_listings(store_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_marketplace ON ebay_published_listings(marketplace_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_status ON ebay_published_listings(listing_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_sku ON ebay_published_listings(sku)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_item_id ON ebay_published_listings(ebay_item_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_synced ON ebay_published_listings(last_synced_at)`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_epl_account_item
      ON ebay_published_listings(ebay_account_id, marketplace_id, ebay_item_id)
      WHERE ebay_item_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_published_listing_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30),
        trigger VARCHAR(30) NOT NULL DEFAULT 'manual',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        items_processed INT NOT NULL DEFAULT 0,
        items_created INT NOT NULL DEFAULT 0,
        items_updated INT NOT NULL DEFAULT 0,
        items_failed INT NOT NULL DEFAULT 0,
        errors JSONB NOT NULL DEFAULT '[]',
        warnings JSONB NOT NULL DEFAULT '[]'
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_sync_org ON ebay_published_listing_sync_logs(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_sync_account ON ebay_published_listing_sync_logs(ebay_account_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_published_listing_bulk_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(40) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        action_payload JSONB,
        total_items INT NOT NULL DEFAULT 0,
        success_count INT NOT NULL DEFAULT 0,
        failure_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_bulk_org ON ebay_published_listing_bulk_jobs(organization_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_published_listing_bulk_job_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bulk_job_id UUID NOT NULL REFERENCES ebay_published_listing_bulk_jobs(id) ON DELETE CASCADE,
        published_listing_id UUID NOT NULL REFERENCES ebay_published_listings(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        before_snapshot JSONB,
        after_snapshot JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_bulk_item_job ON ebay_published_listing_bulk_job_items(bulk_job_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_published_listing_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        published_listing_id UUID NOT NULL REFERENCES ebay_published_listings(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(80) NOT NULL,
        ebay_item_id VARCHAR(100),
        before_value JSONB,
        after_value JSONB,
        api_result VARCHAR(40) NOT NULL,
        api_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_rev_listing ON ebay_published_listing_revisions(published_listing_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_epl_rev_org ON ebay_published_listing_revisions(organization_id)`,
    );

    await queryRunner.query(`
      ALTER TABLE listing_action_logs
      ADD COLUMN IF NOT EXISTS ebay_published_listing_id UUID
      REFERENCES ebay_published_listings(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE listing_action_logs DROP COLUMN IF EXISTS ebay_published_listing_id`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS ebay_published_listing_revisions`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS ebay_published_listing_bulk_job_items`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS ebay_published_listing_bulk_jobs`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS ebay_published_listing_sync_logs`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_published_listings`);
  }
}

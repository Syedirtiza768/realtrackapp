import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-eBay account / multi-store integration schema.
 *
 * Adds org-scoped internal stores, connected eBay accounts (bridged to
 * existing channel_connections + stores for token-compatible API calls),
 * OAuth token satellite, marketplaces, policies, listing channels, jobs,
 * errors, audit logs, and inventory movements.
 *
 * Existing channel flows remain intact; new rows link to legacy stores.
 */
export class EbayMultiAccountIntegration1775200000000 implements MigrationInterface {
  name = 'EbayMultiAccountIntegration1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS internal_stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_internal_store_org_slug UNIQUE (organization_id, slug)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_internal_stores_org ON internal_stores(organization_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS connected_ebay_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        internal_store_id UUID NULL REFERENCES internal_stores(id) ON DELETE SET NULL,
        channel_connection_id UUID NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
        primary_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        ebay_user_id VARCHAR(200) NOT NULL,
        ebay_username VARCHAR(200),
        account_display_name VARCHAR(200) NOT NULL,
        environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
        connection_status VARCHAR(30) NOT NULL DEFAULT 'active',
        connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_connected_ebay_org ON connected_ebay_accounts(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_connected_ebay_status ON connected_ebay_accounts(connection_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_connected_ebay_ebay_user ON connected_ebay_accounts(ebay_user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        access_token_encrypted TEXT NOT NULL,
        access_token_expires_at TIMESTAMPTZ NOT NULL,
        refresh_token_encrypted TEXT NOT NULL,
        refresh_token_expires_at TIMESTAMPTZ,
        granted_scopes JSONB NOT NULL DEFAULT '[]',
        last_refreshed_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        reconnect_required BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_ebay_oauth_account UNIQUE (ebay_account_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_oauth_expiry ON ebay_oauth_tokens(access_token_expires_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_account_marketplaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        locale VARCHAR(20) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        default_inventory_location_key VARCHAR(100),
        default_payment_policy_id VARCHAR(100),
        default_return_policy_id VARCHAR(100),
        default_fulfillment_policy_id VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_ebay_acct_marketplace UNIQUE (ebay_account_id, marketplace_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_acct_mp_account ON ebay_account_marketplaces(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_acct_mp_marketplace ON ebay_account_marketplaces(marketplace_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_business_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        policy_type VARCHAR(20) NOT NULL,
        ebay_policy_id VARCHAR(100) NOT NULL,
        name VARCHAR(300) NOT NULL,
        raw_payload JSONB NOT NULL DEFAULT '{}',
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_policies_account ON ebay_business_policies(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_policies_marketplace ON ebay_business_policies(marketplace_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS listing_store_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        title_override TEXT,
        price_override NUMERIC(12,2),
        quantity_override INT,
        description_override TEXT,
        category_id_override TEXT,
        condition_override TEXT,
        policy_overrides JSONB NOT NULL DEFAULT '{}',
        image_order_override JSONB,
        fitment_override JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_listing_store_override UNIQUE (catalog_product_id, ebay_account_id, marketplace_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lso_product ON listing_store_overrides(catalog_product_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_lso_account ON listing_store_overrides(ebay_account_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_listing_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        internal_sku TEXT,
        ebay_inventory_sku TEXT,
        offer_id VARCHAR(100),
        listing_id VARCHAR(100),
        listing_url TEXT,
        channel_price NUMERIC(12,2),
        channel_quantity INT,
        listing_status VARCHAR(30) NOT NULL DEFAULT 'draft',
        last_error_code VARCHAR(80),
        last_error_message TEXT,
        published_at TIMESTAMPTZ,
        last_revised_at TIMESTAMPTZ,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_org ON ebay_listing_channels(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_account ON ebay_listing_channels(ebay_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_marketplace ON ebay_listing_channels(marketplace_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_product ON ebay_listing_channels(catalog_product_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_listing ON ebay_listing_channels(listing_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_offer ON ebay_listing_channels(offer_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_inv_sku ON ebay_listing_channels(ebay_inventory_sku)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_elc_status ON ebay_listing_channels(listing_status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_listing_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        job_type VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        idempotency_key VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ebay_listing_job_idem ON ebay_listing_jobs(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_jobs_org ON ebay_listing_jobs(organization_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_listing_job_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_job_id UUID NOT NULL REFERENCES ebay_listing_jobs(id) ON DELETE CASCADE,
        catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES connected_ebay_accounts(id) ON DELETE CASCADE,
        marketplace_id VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        result_payload JSONB,
        error_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_job_targets_job ON ebay_listing_job_targets(listing_job_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_job_targets_product ON ebay_listing_job_targets(catalog_product_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ebay_api_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        ebay_account_id UUID REFERENCES connected_ebay_accounts(id) ON DELETE SET NULL,
        marketplace_id VARCHAR(30),
        catalog_product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
        ebay_listing_channel_id UUID REFERENCES ebay_listing_channels(id) ON DELETE SET NULL,
        api_name VARCHAR(80) NOT NULL,
        endpoint TEXT NOT NULL,
        response_code INT,
        ebay_error_id VARCHAR(80),
        ebay_error_domain VARCHAR(120),
        ebay_error_category VARCHAR(120),
        ebay_error_message TEXT,
        ebay_long_message TEXT,
        retryable BOOLEAN NOT NULL DEFAULT false,
        raw_response JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_api_errors_org ON ebay_api_errors(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ebay_api_errors_account ON ebay_api_errors(ebay_account_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS listing_action_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ebay_account_id UUID REFERENCES connected_ebay_accounts(id) ON DELETE SET NULL,
        marketplace_id VARCHAR(30),
        catalog_product_id UUID REFERENCES catalog_products(id) ON DELETE SET NULL,
        ebay_listing_channel_id UUID REFERENCES ebay_listing_channels(id) ON DELETE SET NULL,
        action VARCHAR(80) NOT NULL,
        before_snapshot JSONB,
        after_snapshot JSONB,
        result VARCHAR(40) NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_listing_action_logs_org ON listing_action_logs(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_listing_action_logs_created ON listing_action_logs(created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
        movement_type VARCHAR(40) NOT NULL,
        quantity_change INT NOT NULL,
        source_channel VARCHAR(40) NOT NULL,
        ebay_account_id UUID REFERENCES connected_ebay_accounts(id) ON DELETE SET NULL,
        ebay_order_id VARCHAR(120),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_inv_mov_org ON inventory_movements(organization_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_inv_mov_product ON inventory_movements(catalog_product_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_movements`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_action_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_api_errors`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_listing_job_targets`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_listing_jobs`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_listing_channels`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_store_overrides`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_business_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_account_marketplaces`);
    await queryRunner.query(`DROP TABLE IF EXISTS ebay_oauth_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS connected_ebay_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS internal_stores`);
  }
}

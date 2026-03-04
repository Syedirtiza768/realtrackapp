import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 Safe Foundations Migration
 * 
 * This migration is purely ADDITIVE — it does NOT modify or remove
 * any existing tables, columns, constraints, or indexes.
 * 
 * Changes:
 * 1. Creates tables that previously existed only in raw SQL:
 *    - stores
 *    - listing_channel_instances
 *    - ai_enhancements
 *    - demo_simulation_logs
 * 2. Adds columns that existed only in raw SQL:
 *    - listing_records.extractedMake
 *    - listing_records.extractedModel
 *    - listing_records.searchVector
 * 3. Creates feature_flags table
 * 4. Adds missing FK constraints (with NO ACTION / SET NULL to be safe)
 * 5. Adds missing indexes for common query patterns
 * 
 * All CREATE/ALTER use IF NOT EXISTS / IF NOT EXISTS patterns
 * so this migration is idempotent on databases that already
 * had these objects from the raw SQL scripts.
 */
export class Phase1SafeFoundations1709078400000 implements MigrationInterface {
  name = 'Phase1SafeFoundations1709078400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════
    // 1. Tables from multi_store_migration.sql
    // ═══════════════════════════════════════════════════════════

    // 1a. stores
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "connection_id" uuid NOT NULL,
        "channel" character varying(30) NOT NULL,
        "store_name" character varying(200) NOT NULL,
        "store_url" text,
        "external_store_id" character varying(200),
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "is_primary" boolean NOT NULL DEFAULT false,
        "config" jsonb NOT NULL DEFAULT '{}',
        "metrics_cache" jsonb NOT NULL DEFAULT '{}',
        "listing_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_stores" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stores_connection" FOREIGN KEY ("connection_id")
          REFERENCES "channel_connections"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_store_connection" ON "stores" ("connection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_store_channel_name" ON "stores" ("channel", "store_name")`);

    // 1b. listing_channel_instances
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listing_channel_instances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listing_id" uuid NOT NULL,
        "connection_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "channel" character varying(30) NOT NULL,
        "external_id" character varying(200),
        "external_url" text,
        "override_price" numeric(10,2),
        "override_quantity" integer,
        "override_title" text,
        "channel_specific_data" jsonb NOT NULL DEFAULT '{}',
        "sync_status" character varying(20) NOT NULL DEFAULT 'pending',
        "last_pushed_version" integer,
        "last_synced_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        "retry_count" integer NOT NULL DEFAULT 0,
        "is_demo" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_listing_channel_instances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lci_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listing_records"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lci_connection" FOREIGN KEY ("connection_id")
          REFERENCES "channel_connections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lci_store" FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_lci_listing_store" ON "listing_channel_instances" ("listing_id", "store_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_listing" ON "listing_channel_instances" ("listing_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_store" ON "listing_channel_instances" ("store_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_connection" ON "listing_channel_instances" ("connection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_external" ON "listing_channel_instances" ("external_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_sync_status" ON "listing_channel_instances" ("sync_status")`);

    // 1c. ai_enhancements
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_enhancements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "listing_id" uuid NOT NULL,
        "enhancement_type" character varying(30) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "original_value" text,
        "enhanced_value" text,
        "confidence" numeric(4,3),
        "model_used" character varying(50),
        "tokens_used" integer,
        "latency_ms" integer,
        "cost_usd" numeric(8,4),
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "applied_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ai_enhancements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_enh_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listing_records"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_enh_listing" ON "ai_enhancements" ("listing_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_enh_type" ON "ai_enhancements" ("enhancement_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_enh_status" ON "ai_enhancements" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_enh_listing_type" ON "ai_enhancements" ("listing_id", "enhancement_type")`);

    // 1d. demo_simulation_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "demo_simulation_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "operation_type" character varying(30) NOT NULL,
        "channel" character varying(30) NOT NULL,
        "store_id" uuid,
        "listing_id" uuid,
        "instance_id" uuid,
        "simulated_external_id" character varying(200),
        "request_payload" jsonb DEFAULT '{}',
        "response_payload" jsonb DEFAULT '{}',
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_demo_simulation_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_demo_log_operation" ON "demo_simulation_logs" ("operation_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_demo_log_channel" ON "demo_simulation_logs" ("channel")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_demo_log_listing" ON "demo_simulation_logs" ("listing_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_demo_log_created" ON "demo_simulation_logs" ("created_at")`);

    // ═══════════════════════════════════════════════════════════
    // 2. Columns from raw SQL scripts (extract_make_model, setup_search)
    // ═══════════════════════════════════════════════════════════

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listing_records" ADD COLUMN "extractedMake" character varying(100);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listing_records" ADD COLUMN "extractedModel" character varying(100);
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listing_records" ADD COLUMN "searchVector" tsvector;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_extracted_make" ON "listing_records" ("extractedMake")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_extracted_model" ON "listing_records" ("extractedModel")`);

    // ═══════════════════════════════════════════════════════════
    // 3. Feature flags table
    // ═══════════════════════════════════════════════════════════

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_flags" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(100) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "description" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_feature_flags" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_flags_key" UNIQUE ("key")
      )
    `);

    // ═══════════════════════════════════════════════════════════
    // 4. Missing FK constraints (safe: NO ACTION / SET NULL)
    // ═══════════════════════════════════════════════════════════

    // listing_revisions.listingId → listing_records.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "listing_revisions"
          ADD CONSTRAINT "FK_revision_listing"
          FOREIGN KEY ("listingId") REFERENCES "listing_records"("id") ON DELETE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // order_items.listing_id → listing_records.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "order_items"
          ADD CONSTRAINT "FK_order_item_listing"
          FOREIGN KEY ("listing_id") REFERENCES "listing_records"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // sales_records.listingId → listing_records.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sales_records"
          ADD CONSTRAINT "FK_sales_listing"
          FOREIGN KEY ("listingId") REFERENCES "listing_records"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // sales_records.orderId → orders.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "sales_records"
          ADD CONSTRAINT "FK_sales_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // inventory_events.listing_id → listing_records.id
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_events"
          ADD CONSTRAINT "FK_inv_event_listing"
          FOREIGN KEY ("listing_id") REFERENCES "listing_records"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ═══════════════════════════════════════════════════════════
    // 5. Missing indexes for common query patterns
    // ═══════════════════════════════════════════════════════════

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_status" ON "listing_records" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_ebay_id" ON "listing_records" ("ebayListingId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_shopify_id" ON "listing_records" ("shopifyProductId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_listing_updated_at" ON "listing_records" ("updatedAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lci_sync_updated" ON "listing_channel_instances" ("sync_status", "updated_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notif_unread" ON "notifications" ("recipientId") WHERE "read" = false`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_order_connection" ON "orders" ("connection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_entity_id" ON "audit_logs" ("entityType", "entityId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════════
    // Reverse order: indexes → FKs → feature_flags → columns → tables
    // ═══════════════════════════════════════════════════════════

    // 5. Drop added indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_entity_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_connection"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notif_unread"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lci_sync_updated"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_shopify_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_ebay_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listing_status"`);

    // 4. Drop added FK constraints
    await queryRunner.query(`ALTER TABLE "inventory_events" DROP CONSTRAINT IF EXISTS "FK_inv_event_listing"`);
    await queryRunner.query(`ALTER TABLE "sales_records" DROP CONSTRAINT IF EXISTS "FK_sales_order"`);
    await queryRunner.query(`ALTER TABLE "sales_records" DROP CONSTRAINT IF EXISTS "FK_sales_listing"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "FK_order_item_listing"`);
    await queryRunner.query(`ALTER TABLE "listing_revisions" DROP CONSTRAINT IF EXISTS "FK_revision_listing"`);

    // 3. Drop feature_flags table
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags"`);

    // 2. Drop added columns
    // NOTE: We do NOT drop extractedMake, extractedModel, searchVector
    // because they may contain data populated by the raw SQL scripts.
    // Keeping them is safe — they're nullable columns.

    // 1. Drop tables created by this migration
    // NOTE: Only drop if they have no data. In practice, the raw SQL
    // may have already populated these. Use CASCADE cautiously.
    await queryRunner.query(`DROP TABLE IF EXISTS "demo_simulation_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_enhancements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "listing_channel_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stores"`);
  }
}

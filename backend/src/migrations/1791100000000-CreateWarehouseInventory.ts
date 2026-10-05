import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Warehouse inventory core (see docs/planning/INVENTORY_AND_WAREHOUSE_PLAN.md).
 *
 * Additive only. Legacy inventory tables (inventory_ledger, inventory_events,
 * inventory_movements, store_inventory_allocations) are left untouched; the new
 * `stock_movements` ledger is the source of truth once an organization is set up.
 *
 * Stock does not have to be on hand to sell: items can be sourced on demand from
 * suppliers (procurement requests → purchase orders → receive-to-order or dropship).
 */
export class CreateWarehouseInventory1791100000000 implements MigrationInterface {
  name = 'CreateWarehouseInventory1791100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "warehouses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "code" varchar(40) NOT NULL,
        "name" varchar(120) NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'owned',
        "address" jsonb,
        "country_code" varchar(2),
        "timezone" varchar(60),
        "ebay_merchant_location_key" varchar(36),
        "is_default" boolean NOT NULL DEFAULT false,
        "is_sellable" boolean NOT NULL DEFAULT true,
        "active" boolean NOT NULL DEFAULT true,
        "legacy_fashion_warehouse_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_warehouses_type" CHECK ("type" IN ('owned','3pl','virtual'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_warehouses_org_code" ON "warehouses" ("organization_id","code")`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_warehouses_org_default" ON "warehouses" ("organization_id") WHERE "is_default"`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "warehouse_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
        "code" varchar(60) NOT NULL,
        "zone" varchar(40), "aisle" varchar(20), "rack" varchar(20), "shelf" varchar(20), "bin" varchar(20),
        "barcode" varchar(80),
        "type" varchar(20) NOT NULL DEFAULT 'storage',
        "is_pickable" boolean NOT NULL DEFAULT true,
        "capacity_units" integer,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_wl_type" CHECK ("type" IN ('storage','receiving','staging','returns','quarantine'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_wl_warehouse_code" ON "warehouse_locations" ("warehouse_id","code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_wl_barcode" ON "warehouse_locations" ("organization_id","barcode")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "code" varchar(40) NOT NULL,
        "name" varchar(160) NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'distributor',
        "contact_name" varchar(120), "email" varchar(200), "phone" varchar(60), "website" text,
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "default_lead_time_days" integer NOT NULL DEFAULT 3,
        "supports_dropship" boolean NOT NULL DEFAULT false,
        "notes" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_suppliers_type" CHECK ("type" IN ('distributor','manufacturer','marketplace','salvage_yard','individual','other'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_suppliers_org_code" ON "suppliers" ("organization_id","code")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "inventory_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "vertical" varchar(32) NOT NULL DEFAULT 'automotive',
        "sku" varchar(160) NOT NULL,
        "title" text,
        "image_url" text,
        "catalog_product_id" uuid REFERENCES "catalog_products"("id") ON DELETE SET NULL,
        "listing_record_id" uuid REFERENCES "listing_records"("id") ON DELETE SET NULL,
        "product_variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
        "tracking_mode" varchar(12) NOT NULL DEFAULT 'quantity',
        "sourcing_mode" varchar(12) NOT NULL DEFAULT 'stocked',
        "unit_cost" numeric(12,4),
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "barcode" varchar(80),
        "low_stock_threshold" integer NOT NULL DEFAULT 1,
        "reorder_point" integer NOT NULL DEFAULT 0,
        "reorder_qty" integer NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_ii_tracking" CHECK ("tracking_mode" IN ('quantity','serial','one_off')),
        CONSTRAINT "chk_ii_sourcing" CHECK ("sourcing_mode" IN ('stocked','on_demand','hybrid')),
        CONSTRAINT "chk_ii_status" CHECK ("status" IN ('active','discontinued','archived'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_ii_org_sku" ON "inventory_items" ("organization_id","sku")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_ii_catalog" ON "inventory_items" ("catalog_product_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_ii_listing" ON "inventory_items" ("listing_record_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_ii_variant" ON "inventory_items" ("product_variant_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_ii_barcode" ON "inventory_items" ("organization_id","barcode")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "inventory_item_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
        "supplier_sku" varchar(160),
        "unit_cost" numeric(12,4),
        "currency" varchar(3) NOT NULL DEFAULT 'USD',
        "available_qty" integer,
        "lead_time_days" integer,
        "priority" integer NOT NULL DEFAULT 100,
        "fulfillment_mode" varchar(20) NOT NULL DEFAULT 'ship_to_warehouse',
        "url" text,
        "active" boolean NOT NULL DEFAULT true,
        "last_checked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_iis_mode" CHECK ("fulfillment_mode" IN ('ship_to_warehouse','dropship')),
        CONSTRAINT "chk_iis_qty" CHECK ("available_qty" IS NULL OR "available_qty" >= 0)
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_iis_item_supplier" ON "inventory_item_sources" ("inventory_item_id","supplier_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "stock_levels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        "location_id" uuid REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT,
        "on_hand" integer NOT NULL DEFAULT 0,
        "reserved" integer NOT NULL DEFAULT 0,
        "damaged" integer NOT NULL DEFAULT 0,
        "inbound" integer NOT NULL DEFAULT 0,
        "available" integer GENERATED ALWAYS AS ("on_hand" - "reserved" - "damaged") STORED,
        "last_received_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_sl_nonneg" CHECK ("on_hand" >= 0 AND "reserved" >= 0 AND "damaged" >= 0 AND "inbound" >= 0),
        CONSTRAINT "chk_sl_alloc" CHECK ("reserved" + "damaged" <= "on_hand"),
        CONSTRAINT "uq_sl_item_wh_loc" UNIQUE NULLS NOT DISTINCT ("inventory_item_id","warehouse_id","location_id")
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sl_org_wh" ON "stock_levels" ("organization_id","warehouse_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "inventory_units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
        "warehouse_id" uuid REFERENCES "warehouses"("id") ON DELETE SET NULL,
        "location_id" uuid REFERENCES "warehouse_locations"("id") ON DELETE SET NULL,
        "serial_private" text,
        "serial_public" text,
        "lot_code" varchar(80),
        "condition_id" varchar(40),
        "status" varchar(16) NOT NULL DEFAULT 'available',
        "reservation_id" uuid,
        "unit_cost" numeric(12,4),
        "source_ref" varchar(120),
        "received_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_iu_status" CHECK ("status" IN ('available','reserved','picked','shipped','returned','quarantined','written_off'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_iu_org_serial" ON "inventory_units" ("organization_id","serial_private") WHERE "serial_private" IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_iu_source_ref" ON "inventory_units" ("source_ref") WHERE "source_ref" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_iu_item_status" ON "inventory_units" ("inventory_item_id","status")`);

    await q.query(`CREATE SEQUENCE IF NOT EXISTS "stock_document_seq"`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "stock_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "doc_type" varchar(20) NOT NULL,
        "doc_number" varchar(40) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'draft',
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
        "dest_warehouse_id" uuid REFERENCES "warehouses"("id"),
        "supplier_id" uuid REFERENCES "suppliers"("id"),
        "reason_code" varchar(40),
        "reference" varchar(200),
        "note" text,
        "expected_at" timestamptz,
        "currency" varchar(3),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid, "approved_by" uuid, "completed_by" uuid,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_sd_type" CHECK ("doc_type" IN ('receipt','transfer','adjustment','count','purchase_order')),
        CONSTRAINT "chk_sd_status" CHECK ("status" IN ('draft','pending_approval','ordered','in_transit','partially_received','completed','cancelled'))
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_sd_number" ON "stock_documents" ("organization_id","doc_number")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sd_org_type_status" ON "stock_documents" ("organization_id","doc_type","status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "stock_document_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL REFERENCES "stock_documents"("id") ON DELETE CASCADE,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id"),
        "location_id" uuid REFERENCES "warehouse_locations"("id"),
        "dest_location_id" uuid REFERENCES "warehouse_locations"("id"),
        "unit_id" uuid REFERENCES "inventory_units"("id"),
        "quantity" integer NOT NULL DEFAULT 0,
        "processed_qty" integer NOT NULL DEFAULT 0,
        "counted_qty" integer,
        "system_qty" integer,
        "unit_cost" numeric(12,4),
        "serials" text[] NOT NULL DEFAULT '{}',
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sdl_document" ON "stock_document_lines" ("document_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        "location_id" uuid,
        "unit_id" uuid,
        "movement_type" varchar(30) NOT NULL,
        "qty_on_hand" integer NOT NULL DEFAULT 0,
        "qty_reserved" integer NOT NULL DEFAULT 0,
        "qty_damaged" integer NOT NULL DEFAULT 0,
        "qty_inbound" integer NOT NULL DEFAULT 0,
        "on_hand_after" integer NOT NULL,
        "reserved_after" integer NOT NULL,
        "unit_cost" numeric(12,4),
        "reason_code" varchar(40),
        "note" text,
        "document_id" uuid,
        "source_channel" varchar(30),
        "store_id" uuid,
        "order_id" uuid,
        "order_item_id" uuid,
        "operation_key" varchar(200),
        "idempotency_key" varchar(220),
        "actor_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_sm_idempotency" ON "stock_movements" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sm_operation" ON "stock_movements" ("operation_key")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sm_item_time" ON "stock_movements" ("organization_id","inventory_item_id","created_at" DESC)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sm_org_time" ON "stock_movements" ("organization_id","created_at" DESC)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sm_document" ON "stock_movements" ("document_id")`);
    // The ledger is append-only. Purges must opt in per transaction:
    //   SET LOCAL stock.allow_purge = 'on';
    await q.query(`
      CREATE OR REPLACE FUNCTION stock_movements_append_only() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' AND current_setting('stock.allow_purge', true) = 'on' THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'stock_movements is append-only (%)', TG_OP;
      END $$ LANGUAGE plpgsql`);
    await q.query(`DROP TRIGGER IF EXISTS "trg_stock_movements_append_only" ON "stock_movements"`);
    await q.query(`CREATE TRIGGER "trg_stock_movements_append_only" BEFORE UPDATE OR DELETE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION stock_movements_append_only()`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "stock_reservations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id"),
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
        "location_id" uuid,
        "unit_id" uuid,
        "order_id" uuid,
        "order_item_id" uuid,
        "store_id" uuid,
        "quantity" integer NOT NULL CHECK ("quantity" > 0),
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_sr_status" CHECK ("status" IN ('active','picked','shipped','released'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sr_order_item" ON "stock_reservations" ("order_item_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sr_item_status" ON "stock_reservations" ("inventory_item_id","status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "procurement_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id"),
        "quantity" integer NOT NULL CHECK ("quantity" > 0),
        "received_qty" integer NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "reason" varchar(20) NOT NULL DEFAULT 'order',
        "fulfillment_mode" varchar(20) NOT NULL DEFAULT 'ship_to_warehouse',
        "supplier_id" uuid REFERENCES "suppliers"("id"),
        "source_id" uuid REFERENCES "inventory_item_sources"("id") ON DELETE SET NULL,
        "warehouse_id" uuid REFERENCES "warehouses"("id"),
        "purchase_order_id" uuid REFERENCES "stock_documents"("id") ON DELETE SET NULL,
        "purchase_order_line_id" uuid,
        "order_id" uuid,
        "order_item_id" uuid,
        "store_id" uuid,
        "estimated_unit_cost" numeric(12,4),
        "needed_by" timestamptz,
        "supplier_tracking" varchar(120),
        "note" text,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_pr_status" CHECK ("status" IN ('open','ordered','received','dropshipped','fulfilled','cancelled')),
        CONSTRAINT "chk_pr_reason" CHECK ("reason" IN ('order','reorder','manual')),
        CONSTRAINT "chk_pr_mode" CHECK ("fulfillment_mode" IN ('ship_to_warehouse','dropship'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pr_org_status" ON "procurement_requests" ("organization_id","status")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pr_order_item" ON "procurement_requests" ("order_item_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pr_po" ON "procurement_requests" ("purchase_order_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "store_warehouse_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
        "priority" integer NOT NULL DEFAULT 100,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_swl_store_wh" ON "store_warehouse_links" ("store_id","warehouse_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_swl_wh" ON "store_warehouse_links" ("warehouse_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "store_stock_policies" (
        "store_id" uuid PRIMARY KEY REFERENCES "stores"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL,
        "push_enabled" boolean NOT NULL DEFAULT false,
        "buffer_qty" integer NOT NULL DEFAULT 0 CHECK ("buffer_qty" >= 0),
        "max_qty" integer CHECK ("max_qty" IS NULL OR "max_qty" >= 0),
        "include_sourceable" boolean NOT NULL DEFAULT true,
        "max_sourceable_qty" integer NOT NULL DEFAULT 5 CHECK ("max_sourceable_qty" >= 0),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "channel_stock_sync_state" (
        "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
        "inventory_item_id" uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL,
        "dirty" boolean NOT NULL DEFAULT true,
        "desired_qty" integer,
        "pushed_qty" integer,
        "channel_qty" integer,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "targets" jsonb NOT NULL DEFAULT '[]',
        "last_pushed_at" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("store_id","inventory_item_id"),
        CONSTRAINT "chk_cs_status" CHECK ("status" IN ('pending','synced','shadow','failed','no_target','paused'))
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_cs_dirty" ON "channel_stock_sync_state" ("dirty") WHERE "dirty"`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_cs_org_status" ON "channel_stock_sync_state" ("organization_id","status")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_warehouse_assignments" (
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id","warehouse_id")
      )`);

    await q.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid`);
    await q.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "stock_status" varchar(24)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_order_items_stock_status" ON "order_items" ("stock_status") WHERE "stock_status" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_order_items_stock_status"`);
    await q.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "stock_status"`);
    await q.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "inventory_item_id"`);
    for (const table of [
      'user_warehouse_assignments',
      'channel_stock_sync_state',
      'store_stock_policies',
      'store_warehouse_links',
      'procurement_requests',
      'stock_reservations',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await q.query(`DROP TRIGGER IF EXISTS "trg_stock_movements_append_only" ON "stock_movements"`);
    await q.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await q.query(`DROP FUNCTION IF EXISTS stock_movements_append_only()`);
    for (const table of [
      'stock_document_lines',
      'stock_documents',
      'inventory_units',
      'stock_levels',
      'inventory_item_sources',
      'inventory_items',
      'suppliers',
      'warehouse_locations',
      'warehouses',
    ]) {
      await q.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await q.query(`DROP SEQUENCE IF EXISTS "stock_document_seq"`);
  }
}

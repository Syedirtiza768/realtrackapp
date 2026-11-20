import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cross-store sale sync: a part sold on one eBay store is ended (or lowered)
 * on every other connected store.
 *
 * ebay_cross_store_sale_syncs records one row per (order line, other listing)
 * — or per line with target_key 'line' when the line itself was skipped — so a
 * retried run never takes the same sale off a listing twice.
 *
 * Seeds the feature flag `ebay_cross_store_sale_sync` ENABLED: it is the off
 * switch, not an opt-in.
 */
export class CrossStoreSaleSync1791900000000 implements MigrationInterface {
  name = 'CrossStoreSaleSync1791900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "ebay_cross_store_sale_syncs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
        "target_key" varchar(64) NOT NULL,
        "target_published_listing_id" uuid NULL,
        "target_store_id" uuid NULL,
        "target_item_id" varchar(100) NULL,
        "sku" varchar(200) NULL,
        "sold_item_id" varchar(100) NULL,
        "sold_qty" int NOT NULL DEFAULT 1,
        "action" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL,
        "reason" varchar(60) NULL,
        "quantity_before" int NULL,
        "quantity_after" int NULL,
        "error" text NULL,
        "attempts" int NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_cross_store_sale_sync_line_target" UNIQUE ("order_item_id", "target_key")
      )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_cross_store_sale_sync_order" ON "ebay_cross_store_sale_syncs" ("order_id")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_cross_store_sale_sync_updated" ON "ebay_cross_store_sale_syncs" ("updated_at" DESC)`,
    );
    await q.query(`
      INSERT INTO "feature_flags" ("key", "enabled", "description")
      VALUES ('ebay_cross_store_sale_sync', true,
              'A part sold on one eBay store is ended (or its quantity lowered) on every other connected eBay store')
      ON CONFLICT ("key") DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM "feature_flags" WHERE "key" = 'ebay_cross_store_sale_sync'`,
    );
    await q.query(`DROP TABLE IF EXISTS "ebay_cross_store_sale_syncs"`);
  }
}

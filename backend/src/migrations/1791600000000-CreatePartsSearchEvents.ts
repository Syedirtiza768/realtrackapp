import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Parts Search audit + demand log (see parts-search/entities/parts-search-event.entity.ts).
 *
 * Additive only. Timestamp is above every migration recorded in production
 * (1791400000000 PrimemotiveListingChangeFeed, present in production only), so
 * it runs after them wherever they exist.
 */
export class CreatePartsSearchEvents1791600000000 implements MigrationInterface {
  name = 'CreatePartsSearchEvents1791600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "parts_search_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "type" varchar(12) NOT NULL,
        "user_id" uuid,
        "user_email" varchar(255),
        "query" text NOT NULL DEFAULT '',
        "numbers" text[] NOT NULL DEFAULT '{}',
        "vehicle" jsonb,
        "result_count" integer NOT NULL DEFAULT 0,
        "in_stock_count" integer NOT NULL DEFAULT 0,
        "fits_count" integer NOT NULL DEFAULT 0,
        "demand" boolean NOT NULL DEFAULT false,
        "part_id" varchar(100),
        "request_ref" varchar(64),
        "note" text,
        "status" varchar(12),
        "updated_by" uuid,
        "updated_at" timestamptz
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pse_type_created" ON "parts_search_events" ("type", "created_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pse_demand_created" ON "parts_search_events" ("demand", "created_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_pse_numbers" ON "parts_search_events" USING gin ("numbers")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "parts_search_events"`);
  }
}

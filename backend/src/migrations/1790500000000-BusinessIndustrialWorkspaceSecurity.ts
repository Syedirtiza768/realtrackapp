import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive Business & Industrial workspace data. Existing automotive and
 * Fashion rows are untouched; all new rows are organization- and
 * vertical-scoped. The migration is intentionally not run automatically by
 * this change request.
 */
export class BusinessIndustrialWorkspaceSecurity1790500000000 implements MigrationInterface {
  name = 'BusinessIndustrialWorkspaceSecurity1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "catalog_product_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "provenance_confirmed" boolean NOT NULL DEFAULT false,
        "specifications_verified" boolean NOT NULL DEFAULT false,
        "testing_reviewed" boolean NOT NULL DEFAULT false,
        "restricted_category_cleared" boolean NOT NULL DEFAULT false,
        "evidence_keys" text[] NOT NULL DEFAULT '{}',
        "risk_flags" text[] NOT NULL DEFAULT '{}',
        "reviewed_by_user_id" uuid,
        "notes" text,
        "reviewed_at" timestamptz,
        "reviewed_product_updated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bi_review_product" UNIQUE ("organization_id", "catalog_product_id"),
        CONSTRAINT "fk_bi_review_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_review_product" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bi_review_org_status" ON "business_industrial_reviews" ("organization_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "catalog_product_id" uuid NOT NULL,
        "serial_number_private" text NOT NULL,
        "serial_number_public" text,
        "status" varchar(20) NOT NULL DEFAULT 'available',
        "allocated_store_id" uuid,
        "allocated_offer_id" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bi_unit_private_serial" UNIQUE ("organization_id", "serial_number_private"),
        CONSTRAINT "uq_bi_unit_public_serial" UNIQUE ("organization_id", "serial_number_public"),
        CONSTRAINT "fk_bi_unit_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_unit_product" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bi_unit_product_status" ON "business_industrial_units" ("catalog_product_id", "status")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_incidents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "catalog_product_id" uuid,
        "external_event_id" varchar(200) NOT NULL,
        "incident_type" varchar(32) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'received',
        "verified" boolean NOT NULL DEFAULT false,
        "event_occurred_at" timestamptz,
        "detected_at" timestamptz NOT NULL DEFAULT now(),
        "first_takedown_attempt_at" timestamptz,
        "takedown_completed_at" timestamptz,
        "event_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "takedown_attempts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_by_user_id" uuid,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bi_incident_event" UNIQUE ("organization_id", "external_event_id"),
        CONSTRAINT "fk_bi_incident_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_incident_product" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bi_incident_org_status" ON "business_industrial_incidents" ("organization_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_bi_incident_product" ON "business_industrial_incidents" ("catalog_product_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_industrial_incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_industrial_units"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_industrial_reviews"`);
  }
}

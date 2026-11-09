import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fashion "Publish next N" pipeline: per-listing pipeline state, batches,
 * batch membership and per-org compliance rule overrides.
 * Additive only — no existing rows are read or changed.
 */
export class CreateFashionBatchPublish1791700000000
  implements MigrationInterface
{
  name = 'CreateFashionBatchPublish1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_listing_pipeline" (
        "catalog_product_id" uuid PRIMARY KEY REFERENCES "catalog_products"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL,
        "state" varchar(24) NOT NULL DEFAULT 'UNPUBLISHED',
        "active_batch_id" uuid,
        "last_batch_id" uuid,
        "compliance_result" varchar(16),
        "risk_score" integer,
        "issues" jsonb NOT NULL DEFAULT '[]',
        "fixes" jsonb NOT NULL DEFAULT '[]',
        "suggestion" jsonb,
        "images" jsonb NOT NULL DEFAULT '[]',
        "vision_result" jsonb,
        "vision_fingerprint" varchar(64),
        "ebay_master_urls" text[] NOT NULL DEFAULT '{}',
        "ebay_image_urls" text[] NOT NULL DEFAULT '{}',
        "checked_at" timestamptz,
        "approved_by_user_id" uuid,
        "publish_attempt" integer NOT NULL DEFAULT 0,
        "listing_job_id" uuid,
        "ebay_account_id" uuid,
        "marketplace_id" varchar(30),
        "ebay_item_id" text,
        "ebay_offer_id" text,
        "published_at" timestamptz,
        "last_error" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_flp_org_state" ON "fashion_listing_pipeline" ("organization_id", "state")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_publish_batches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "requested_by_user_id" uuid NOT NULL,
        "requested_size" integer NOT NULL,
        "dry_run" boolean NOT NULL DEFAULT true,
        "ebay_account_id" uuid,
        "marketplace_id" varchar(30),
        "confirmed_by_user_id" uuid,
        "status" varchar(16) NOT NULL DEFAULT 'queued',
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fpb_org_created" ON "fashion_publish_batches" ("organization_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_publish_batch_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "batch_id" uuid NOT NULL REFERENCES "fashion_publish_batches"("id") ON DELETE CASCADE,
        "organization_id" uuid NOT NULL,
        "catalog_product_id" uuid NOT NULL REFERENCES "catalog_products"("id") ON DELETE CASCADE,
        "position" integer NOT NULL,
        "state" varchar(24) NOT NULL DEFAULT 'UNPUBLISHED',
        "compliance_result" varchar(16),
        "risk_score" integer,
        "issue_codes" text[] NOT NULL DEFAULT '{}',
        "ebay_item_id" text,
        "error" text,
        "finished_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_fpbi_batch_product" ON "fashion_publish_batch_items" ("batch_id", "catalog_product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fpbi_product" ON "fashion_publish_batch_items" ("catalog_product_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_compliance_configs" (
        "organization_id" uuid PRIMARY KEY,
        "config" jsonb NOT NULL DEFAULT '{}',
        "updated_by_user_id" uuid,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fashion_compliance_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fashion_publish_batch_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fashion_publish_batches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fashion_listing_pipeline"`);
  }
}

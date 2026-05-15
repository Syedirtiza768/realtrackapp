import { MigrationInterface, QueryRunner } from 'typeorm';

export class ListingOptimizationPipeline1775300000000 implements MigrationInterface {
  name = 'ListingOptimizationPipeline1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "optimization_status" varchar(32) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "optimization_version" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "optimized_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "source_data_hash" text,
        ADD COLUMN IF NOT EXISTS "fitment_status" varchar(32) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "fitment_confidence" numeric(5,4),
        ADD COLUMN IF NOT EXISTS "ebay_validation_status" varchar(32),
        ADD COLUMN IF NOT EXISTS "optimization_errors" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "optimization_warnings" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "optimized_title" text,
        ADD COLUMN IF NOT EXISTS "optimized_description" text,
        ADD COLUMN IF NOT EXISTS "optimization_payload" jsonb,
        ADD COLUMN IF NOT EXISTS "fitment_rows" jsonb,
        ADD COLUMN IF NOT EXISTS "donor_vin_decoded" jsonb,
        ADD COLUMN IF NOT EXISTS "seo_score" numeric(5,4),
        ADD COLUMN IF NOT EXISTS "readiness_score" numeric(5,4),
        ADD COLUMN IF NOT EXISTS "manual_review" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "donor_vin" text
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_catalog_optimization_status"
        ON "catalog_products" ("optimization_status")
        WHERE "pipeline_job_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        ADD COLUMN IF NOT EXISTS "optimization_status" varchar(32) DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "optimization_processed" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "optimization_total" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "optimization_pass_count" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "optimization_review_count" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "optimization_block_count" integer DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        DROP COLUMN IF EXISTS "optimization_block_count",
        DROP COLUMN IF EXISTS "optimization_review_count",
        DROP COLUMN IF EXISTS "optimization_pass_count",
        DROP COLUMN IF EXISTS "optimization_total",
        DROP COLUMN IF EXISTS "optimization_processed",
        DROP COLUMN IF EXISTS "optimization_status"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_catalog_optimization_status"`);

    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "donor_vin",
        DROP COLUMN IF EXISTS "manual_review",
        DROP COLUMN IF EXISTS "readiness_score",
        DROP COLUMN IF EXISTS "seo_score",
        DROP COLUMN IF EXISTS "donor_vin_decoded",
        DROP COLUMN IF EXISTS "fitment_rows",
        DROP COLUMN IF EXISTS "optimization_payload",
        DROP COLUMN IF EXISTS "optimized_description",
        DROP COLUMN IF EXISTS "optimized_title",
        DROP COLUMN IF EXISTS "optimization_warnings",
        DROP COLUMN IF EXISTS "optimization_errors",
        DROP COLUMN IF EXISTS "ebay_validation_status",
        DROP COLUMN IF EXISTS "fitment_confidence",
        DROP COLUMN IF EXISTS "fitment_status",
        DROP COLUMN IF EXISTS "source_data_hash",
        DROP COLUMN IF EXISTS "optimized_at",
        DROP COLUMN IF EXISTS "optimization_version",
        DROP COLUMN IF EXISTS "optimization_status"
    `);
  }
}

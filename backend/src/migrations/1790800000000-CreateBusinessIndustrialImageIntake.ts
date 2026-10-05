import { MigrationInterface, QueryRunner } from 'typeorm';

/** Organization-scoped B&I image intake runs, grouped parts, and source assets. */
export class CreateBusinessIndustrialImageIntake1790800000000 implements MigrationInterface {
  name = 'CreateBusinessIndustrialImageIntake1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_image_intake_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid,
        "source_root_name" text NOT NULL,
        "source_reference_url" text,
        "status" varchar(24) NOT NULL DEFAULT 'pending',
        "total_folders" int NOT NULL DEFAULT 0,
        "total_images" int NOT NULL DEFAULT 0,
        "processed_folders" int NOT NULL DEFAULT 0,
        "processed_images" int NOT NULL DEFAULT 0,
        "grouped_parts" int NOT NULL DEFAULT 0,
        "failed_folders" int NOT NULL DEFAULT 0,
        "error_message" text,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_bi_image_intake_job_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bi_image_intake_job_org_status" ON "business_industrial_image_intake_jobs" ("organization_id", "status")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_image_intake_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "base_part_name" text NOT NULL,
        "base_part_normalized" text NOT NULL,
        "raw_folder_names" text[] NOT NULL DEFAULT '{}',
        "instance_suffixes" text[] NOT NULL DEFAULT '{}',
        "instance_count" int NOT NULL DEFAULT 1,
        "detection_status" varchar(24) NOT NULL DEFAULT 'pending',
        "detection" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "confidence" numeric(5,4),
        "catalog_product_id" uuid,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bi_image_intake_group_job_base" UNIQUE ("job_id", "base_part_normalized"),
        CONSTRAINT "fk_bi_image_intake_group_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_image_intake_group_job" FOREIGN KEY ("job_id") REFERENCES "business_industrial_image_intake_jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_image_intake_group_product" FOREIGN KEY ("catalog_product_id") REFERENCES "catalog_products"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bi_image_intake_group_org_status" ON "business_industrial_image_intake_groups" ("organization_id", "detection_status")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_industrial_image_intake_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "source_folder_name" text NOT NULL,
        "relative_path" text NOT NULL,
        "filename" text NOT NULL,
        "s3_bucket" text NOT NULL,
        "s3_key" text NOT NULL,
        "cdn_url" text NOT NULL,
        "mime_type" text,
        "file_size_bytes" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_bi_image_intake_asset_job_path" UNIQUE ("job_id", "relative_path"),
        CONSTRAINT "fk_bi_image_intake_asset_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_image_intake_asset_job" FOREIGN KEY ("job_id") REFERENCES "business_industrial_image_intake_jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_bi_image_intake_asset_group" FOREIGN KEY ("group_id") REFERENCES "business_industrial_image_intake_groups"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bi_image_intake_asset_group" ON "business_industrial_image_intake_assets" ("group_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_industrial_image_intake_assets"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_industrial_image_intake_groups"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_industrial_image_intake_jobs"`,
    );
  }
}

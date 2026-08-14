import { MigrationInterface, QueryRunner } from 'typeorm';

export class RedesignImageDriveFolders1789900000000 implements MigrationInterface {
  name = 'RedesignImageDriveFolders1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "image_drive_folders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "name_normalized" text NOT NULL,
        "s3_prefix" text NOT NULL,
        "linked_part_number" text,
        "linked_part_number_normalized" text,
        "file_count" integer NOT NULL DEFAULT 0,
        "total_size_bytes" bigint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_image_drive_folders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_image_drive_folders_name_normalized"
        ON "image_drive_folders" ("name_normalized")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_image_drive_folders_part_number"
        ON "image_drive_folders" ("linked_part_number_normalized")
        WHERE "linked_part_number_normalized" IS NOT NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_image_drive_part_cdn"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_image_drive_part_number"`,
    );

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        DROP COLUMN IF EXISTS "part_number_normalized",
        DROP COLUMN IF EXISTS "part_number_raw",
        DROP COLUMN IF EXISTS "source",
        DROP COLUMN IF EXISTS "source_listing_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        ADD COLUMN "folder_id" uuid NOT NULL,
        ADD COLUMN "filename" text NOT NULL DEFAULT '',
        ADD COLUMN "s3_key_thumb" text,
        ADD COLUMN "s3_key_medium" text,
        ADD COLUMN "width" integer,
        ADD COLUMN "height" integer,
        ADD COLUMN "blurhash" text
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        ADD CONSTRAINT "FK_image_drive_assets_folder"
        FOREIGN KEY ("folder_id") REFERENCES "image_drive_folders"("id")
        ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_image_drive_assets_folder"
        ON "image_drive_assets" ("folder_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_image_drive_assets_folder_s3key"
        ON "image_drive_assets" ("folder_id", "s3_key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        ALTER COLUMN "filename" DROP DEFAULT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_image_drive_assets_folder_s3key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_image_drive_assets_folder"`,
    );

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        DROP CONSTRAINT IF EXISTS "FK_image_drive_assets_folder"
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        DROP COLUMN IF EXISTS "folder_id",
        DROP COLUMN IF EXISTS "filename",
        DROP COLUMN IF EXISTS "s3_key_thumb",
        DROP COLUMN IF EXISTS "s3_key_medium",
        DROP COLUMN IF EXISTS "width",
        DROP COLUMN IF EXISTS "height",
        DROP COLUMN IF EXISTS "blurhash"
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        ADD COLUMN "part_number_normalized" text NOT NULL DEFAULT '',
        ADD COLUMN "part_number_raw" text NOT NULL DEFAULT '',
        ADD COLUMN "source" varchar(20) NOT NULL DEFAULT 'direct',
        ADD COLUMN "source_listing_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_image_drive_part_number"
        ON "image_drive_assets" ("part_number_normalized")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_image_drive_part_cdn"
        ON "image_drive_assets" ("part_number_normalized", "s3_key")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "image_drive_assets"
        ALTER COLUMN "part_number_normalized" DROP DEFAULT,
        ALTER COLUMN "part_number_raw" DROP DEFAULT
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "image_drive_folders"`);
  }
}

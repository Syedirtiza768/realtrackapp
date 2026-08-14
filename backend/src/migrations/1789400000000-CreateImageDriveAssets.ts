import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImageDriveAssets1789400000000 implements MigrationInterface {
  name = 'CreateImageDriveAssets1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "image_drive_assets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "part_number_normalized" text NOT NULL,
        "part_number_raw" text NOT NULL,
        "cdn_url" text NOT NULL,
        "s3_key" text NOT NULL,
        "original_filename" text,
        "mime_type" varchar(50),
        "file_size_bytes" bigint NOT NULL DEFAULT 0,
        "source" varchar(20) NOT NULL DEFAULT 'direct',
        "source_listing_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_image_drive_assets" PRIMARY KEY ("id")
      )
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_image_drive_part_cdn"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_image_drive_part_number"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "image_drive_assets"`);
  }
}

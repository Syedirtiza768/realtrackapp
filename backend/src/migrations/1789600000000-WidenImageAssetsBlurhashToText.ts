import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `blurhash` stores a full `data:image/webp;base64,...` placeholder (see
 * ImageProcessorService), not a compact BlurHash string — varchar(50) was too
 * short and every ThumbnailProcessor update failed with "value too long for
 * type character varying(50)", silently dropping s3_key_thumb/medium, width,
 * height, and the placeholder for every processed image.
 */
export class WidenImageAssetsBlurhashToText1789600000000
  implements MigrationInterface
{
  name = 'WidenImageAssetsBlurhashToText1789600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "image_assets"
        ALTER COLUMN "blurhash" TYPE text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "image_assets"
        ALTER COLUMN "blurhash" TYPE varchar(50)
    `);
  }
}

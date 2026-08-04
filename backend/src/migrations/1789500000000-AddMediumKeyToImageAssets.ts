import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediumKeyToImageAssets1789500000000
  implements MigrationInterface
{
  name = 'AddMediumKeyToImageAssets1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "image_assets"
        ADD COLUMN IF NOT EXISTS "s3_key_medium" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "image_assets"
        DROP COLUMN IF EXISTS "s3_key_medium"
    `);
  }
}

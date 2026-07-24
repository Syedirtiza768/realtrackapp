import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDonorYearMakeModelToCatalogProducts1789300000000
  implements MigrationInterface
{
  name = 'AddDonorYearMakeModelToCatalogProducts1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        ADD COLUMN IF NOT EXISTS "donor_year" text,
        ADD COLUMN IF NOT EXISTS "donor_make" text,
        ADD COLUMN IF NOT EXISTS "donor_model" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "catalog_products"
        DROP COLUMN IF EXISTS "donor_model",
        DROP COLUMN IF EXISTS "donor_make",
        DROP COLUMN IF EXISTS "donor_year"
    `);
  }
}

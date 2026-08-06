import { MigrationInterface, QueryRunner } from 'typeorm';

export class TruncateImageDriveAssets1789800000000 implements MigrationInterface {
  name = 'TruncateImageDriveAssets1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hard-delete all rows including soft-deleted ones to start fresh
    await queryRunner.query(`DELETE FROM "image_drive_assets"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Data cannot be restored after truncation
  }
}

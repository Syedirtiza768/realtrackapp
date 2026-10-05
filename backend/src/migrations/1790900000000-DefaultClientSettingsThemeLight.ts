import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultClientSettingsThemeLight1790900000000 implements MigrationInterface {
  name = 'DefaultClientSettingsThemeLight1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "client_settings"
      ALTER COLUMN "themeMode" SET DEFAULT 'light'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "themeMode" = 'light', "updatedAt" = now()
      WHERE "themeMode" = 'dark'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "client_settings"
      ALTER COLUMN "themeMode" SET DEFAULT 'dark'
    `);
  }
}

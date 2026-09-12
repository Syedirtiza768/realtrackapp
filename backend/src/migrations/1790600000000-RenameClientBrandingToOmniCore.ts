import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Standardize the default application branding on the Omni Core name.
 * Customized white-label settings are intentionally left unchanged.
 */
export class RenameClientBrandingToOmniCore1790600000000 implements MigrationInterface {
  name = 'RenameClientBrandingToOmniCore1790600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "appName" = 'Omni Core'
      WHERE "appName" = 'RealTrackApp'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "clientName" = 'Omni Core'
      WHERE "clientName" = 'RealTrack'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "shortName" = 'OC'
      WHERE "shortName" = 'RT'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "footerText" = '© Omni Core'
      WHERE "footerText" = '© RealTrack'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "appName" = 'RealTrackApp'
      WHERE "appName" = 'Omni Core'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "clientName" = 'RealTrack'
      WHERE "clientName" = 'Omni Core'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "shortName" = 'RT'
      WHERE "shortName" = 'OC'
    `);
    await queryRunner.query(`
      UPDATE "client_settings"
      SET "footerText" = '© RealTrack'
      WHERE "footerText" = '© Omni Core'
    `);
  }
}

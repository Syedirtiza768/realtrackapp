"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameClientBrandingToOmniCore1790600000000 = void 0;
class RenameClientBrandingToOmniCore1790600000000 {
    name = 'RenameClientBrandingToOmniCore1790600000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
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
exports.RenameClientBrandingToOmniCore1790600000000 = RenameClientBrandingToOmniCore1790600000000;
//# sourceMappingURL=1790600000000-RenameClientBrandingToOmniCore.js.map
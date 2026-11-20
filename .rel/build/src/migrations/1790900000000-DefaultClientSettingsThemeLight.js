"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultClientSettingsThemeLight1790900000000 = void 0;
class DefaultClientSettingsThemeLight1790900000000 {
    name = 'DefaultClientSettingsThemeLight1790900000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "client_settings"
      ALTER COLUMN "themeMode" SET DEFAULT 'dark'
    `);
    }
}
exports.DefaultClientSettingsThemeLight1790900000000 = DefaultClientSettingsThemeLight1790900000000;
//# sourceMappingURL=1790900000000-DefaultClientSettingsThemeLight.js.map
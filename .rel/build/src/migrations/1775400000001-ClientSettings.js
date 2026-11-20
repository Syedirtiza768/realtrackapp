"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientSettings1775400000001 = void 0;
class ClientSettings1775400000001 {
    name = 'ClientSettings1775400000001';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid,
        "appName" character varying(200) NOT NULL DEFAULT 'RealTrackApp',
        "clientName" character varying(200) NOT NULL DEFAULT 'RealTrack',
        "shortName" character varying(80),
        "logoUrl" text,
        "faviconUrl" text,
        "loginLogoUrl" text,
        "primaryColor" character varying(20) NOT NULL DEFAULT '#2563eb',
        "secondaryColor" character varying(20) NOT NULL DEFAULT '#1e293b',
        "accentColor" character varying(20) NOT NULL DEFAULT '#0ea5e9',
        "themeMode" character varying(20) NOT NULL DEFAULT 'dark',
        "sidebarTheme" character varying(40) NOT NULL DEFAULT 'slate',
        "navbarTheme" character varying(40) NOT NULL DEFAULT 'slate',
        "footerText" text,
        "supportEmail" character varying(200),
        "supportPhone" character varying(40),
        "whiteLabelEnabled" boolean NOT NULL DEFAULT true,
        "poweredByVisible" boolean NOT NULL DEFAULT false,
        "updatedBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_settings" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_settings_org"
      ON "client_settings" ("organizationId")
      WHERE "organizationId" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_client_settings_global"
      ON "client_settings" ((1))
      WHERE "organizationId" IS NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "client_settings"`);
    }
}
exports.ClientSettings1775400000001 = ClientSettings1775400000001;
//# sourceMappingURL=1775400000001-ClientSettings.js.map
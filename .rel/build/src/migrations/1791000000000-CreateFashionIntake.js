"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFashionIntake1791000000000 = void 0;
class CreateFashionIntake1791000000000 {
    name = 'CreateFashionIntake1791000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_warehouses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "code" varchar(40) NOT NULL,
        "name" varchar(120) NOT NULL,
        "country_code" varchar(2),
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_fashion_warehouses_org_code" ON "fashion_warehouses" ("organization_id", "code")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fashion_sku_counters" (
        "organization_id" uuid NOT NULL,
        "batch" varchar(20) NOT NULL,
        "last_value" integer NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("organization_id", "batch")
      )
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "fashion_sku_counters"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_fashion_warehouses_org_code"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "fashion_warehouses"`);
    }
}
exports.CreateFashionIntake1791000000000 = CreateFashionIntake1791000000000;
//# sourceMappingURL=1791000000000-CreateFashionIntake.js.map
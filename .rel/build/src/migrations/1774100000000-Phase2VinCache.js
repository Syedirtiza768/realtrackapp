"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase2VinCache1774100000000 = void 0;
class Phase2VinCache1774100000000 {
    name = 'Phase2VinCache1774100000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vin_cache" (
        "vin"           varchar(17) NOT NULL PRIMARY KEY,
        "decoded_data"  jsonb NOT NULL,
        "fetched_at"    timestamptz NOT NULL DEFAULT now(),
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now()
      );
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vin_cache_fetched_at"
        ON "vin_cache" ("fetched_at");
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_vin_cache_fetched_at";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vin_cache";`);
    }
}
exports.Phase2VinCache1774100000000 = Phase2VinCache1774100000000;
//# sourceMappingURL=1774100000000-Phase2VinCache.js.map
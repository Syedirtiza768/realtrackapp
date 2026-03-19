import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 Upgrade: VIN Cache table for NHTSA VIN decode caching.
 *
 * The vin_cache table stores NHTSA vPIC API responses with a 30-day TTL
 * to avoid hitting the free API repeatedly for the same VIN.
 */
export class Phase2VinCache1774100000000 implements MigrationInterface {
  name = 'Phase2VinCache1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ═══════════════════════════════════════════════════════
    //  vin_cache
    // ═══════════════════════════════════════════════════════
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vin_cache" (
        "vin"           varchar(17) NOT NULL PRIMARY KEY,
        "decoded_data"  jsonb NOT NULL,
        "fetched_at"    timestamptz NOT NULL DEFAULT now(),
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Index on fetched_at for TTL cleanup queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_vin_cache_fetched_at"
        ON "vin_cache" ("fetched_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_vin_cache_fetched_at";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vin_cache";`);
  }
}

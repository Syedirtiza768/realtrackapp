import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.2 — Deprecate channel_listings in favor of listing_channel_instances.
 *
 * Strategy:
 * 1. Migrate any data in channel_listings → listing_channel_instances
 *    that doesn't already exist there
 * 2. Create a view `channel_listings_v` for backward compat during transition
 * 3. Mark channel_listings as deprecated (rename to channel_listings_deprecated)
 *
 * The application code is simultaneously updated to use
 * listing_channel_instances exclusively.
 */
export class Phase3DeprecateChannelListings1709510400000 implements MigrationInterface {
  name = 'Phase3DeprecateChannelListings1709510400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Step 1: Migrate orphaned data from channel_listings → listing_channel_instances ───
    // Only rows in channel_listings that don't already exist in listing_channel_instances
    // We need to resolve storeId from channel_connections → stores
    await queryRunner.query(`
      INSERT INTO listing_channel_instances (
        listing_id, connection_id, store_id, channel,
        external_id, external_url, sync_status,
        last_pushed_version, last_synced_at, last_error
      )
      SELECT
        cl.listing_id,
        cl.connection_id,
        COALESCE(
          (SELECT s.id FROM stores s
           INNER JOIN channel_connections cc ON cc.id = cl.connection_id
           WHERE s.channel = cc.channel AND s.is_primary = true
           LIMIT 1),
          (SELECT s.id FROM stores s
           INNER JOIN channel_connections cc ON cc.id = cl.connection_id
           WHERE s.channel = cc.channel
           LIMIT 1)
        ) AS store_id,
        cc.channel,
        cl.external_id,
        cl.external_url,
        cl.sync_status,
        cl.last_pushed_version,
        cl.last_synced_at,
        cl.last_error
      FROM channel_listings cl
      INNER JOIN channel_connections cc ON cc.id = cl.connection_id
      WHERE NOT EXISTS (
        SELECT 1 FROM listing_channel_instances lci
        WHERE lci.listing_id = cl.listing_id
          AND lci.connection_id = cl.connection_id
      )
      -- Only migrate if we can resolve a store
      AND EXISTS (
        SELECT 1 FROM stores s
        INNER JOIN channel_connections cc2 ON cc2.id = cl.connection_id
        WHERE s.channel = cc2.channel
      )
    `);

    // ─── Step 2: Create backward-compat view ───
    await queryRunner.query(`
      CREATE OR REPLACE VIEW channel_listings_v AS
      SELECT
        lci.id,
        lci.connection_id,
        lci.listing_id,
        lci.external_id,
        lci.external_url,
        lci.sync_status,
        lci.last_pushed_version::INTEGER AS last_pushed_version,
        lci.last_synced_at,
        lci.last_error,
        lci.created_at,
        lci.updated_at
      FROM listing_channel_instances lci
    `);

    // ─── Step 3: Rename old table (preserve for rollback) ───
    await queryRunner.query(`ALTER TABLE IF EXISTS channel_listings RENAME TO channel_listings_deprecated`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS channel_listings_deprecated RENAME TO channel_listings`);
    await queryRunner.query(`DROP VIEW IF EXISTS channel_listings_v`);
  }
}

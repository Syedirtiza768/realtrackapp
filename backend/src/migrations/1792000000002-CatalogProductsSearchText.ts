import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stored search document for the catalog workspace typed search.
 *
 * The typed search matched `concat_ws(' ', sku, title, brand, mpn, category_id,
 * category_name, description, part_type, source_file, location,
 * vertical_attributes::text)` with ILIKE and with pg_trgm similarity(). Neither
 * could use an index, and every request rebuilt the text (about 3.6 KB per
 * Fashion row, mostly the jsonb cast) and its trigrams for every row. On the
 * Fashion catalog (22k rows) one pass took about 16 s, so the search page took
 * about 12 s and the facets about 17 s.
 *
 * This migration stores that exact text in `search_text` and its number of
 * distinct pg_trgm trigrams in `search_trgm_count`. A BEFORE INSERT OR UPDATE
 * trigger keeps both current, so no application write path has to know about
 * them. `search_text` gets a GIN trigram index for the ILIKE match.
 * `search_trgm_count` lets the similarity check and the relevance ranking skip
 * rows whose similarity cannot reach the threshold (see
 * CatalogWorkspaceService.applySearchAndFilters).
 *
 * Rollout on production: columns and trigger first, then a batched backfill
 * (short row locks only; raw UPDATEs leave "updatedAt" untouched), then both
 * indexes with CREATE INDEX CONCURRENTLY. That is why this migration opts out of
 * the per-migration transaction. Code that reads the columns must only be
 * deployed after this migration has finished. The previous code ignores the
 * columns, so rolling the code back needs no schema change.
 *
 * Reverting: TypeORM 0.3 wraps `migration:revert` in a transaction even when a
 * migration sets `transaction = false`, and DROP INDEX CONCURRENTLY then
 * fails. Revert with `migration:revert -t none` (same for 1792000000001).
 */
export class CatalogProductsSearchText1792000000002 implements MigrationInterface {
  name = 'CatalogProductsSearchText1792000000002';

  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The backfill and the GIN build take minutes on production. This session
    // must not inherit the app pool's 30 s statement_timeout. The short
    // lock_timeout keeps the brief ACCESS EXCLUSIVE steps from queueing all
    // catalog traffic behind a long-running query; they are retried instead.
    await queryRunner.query(`SET statement_timeout = 0`);
    await queryRunner.query(`SET lock_timeout = '5s'`);
    try {
      await this.createColumnsAndTrigger(queryRunner);
      await this.backfill(queryRunner);
      await this.createIndexes(queryRunner);
      await queryRunner.query(`ANALYZE catalog_products`);
    } finally {
      await queryRunner.query(`RESET lock_timeout`);
      await queryRunner.query(`RESET statement_timeout`);
    }
  }

  private async createColumnsAndTrigger(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await withLockRetry(queryRunner, `
      ALTER TABLE catalog_products
        ADD COLUMN IF NOT EXISTS search_text text,
        ADD COLUMN IF NOT EXISTS search_trgm_count integer
    `);
    // The document expression must stay identical to the former SEARCH_SOURCE
    // in catalog-workspace.service.ts; search results depend on it byte for
    // byte. When an UPDATE leaves the document unchanged (stock, price and
    // status writes), the stored text keeps its TOAST pointer and the trigram
    // count is not recomputed. Setting search_trgm_count to NULL forces a
    // recompute (used by the backfill and after a libc or Postgres upgrade).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION catalog_products_search_text_update()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $function$
      DECLARE
        doc text := concat_ws(' ', NEW.sku, NEW.title, NEW.brand, NEW.mpn,
          NEW.category_id, NEW.category_name, NEW.description, NEW.part_type,
          NEW.source_file, NEW.location, cast(NEW.vertical_attributes as text));
      BEGIN
        IF TG_OP = 'UPDATE'
           AND NEW.search_trgm_count IS NOT NULL
           AND NEW.search_trgm_count IS NOT DISTINCT FROM OLD.search_trgm_count
           AND NEW.search_text IS NOT DISTINCT FROM doc THEN
          RETURN NEW;
        END IF;
        NEW.search_text := doc;
        NEW.search_trgm_count := coalesce(array_length(public.show_trgm(doc), 1), 0);
        RETURN NEW;
      END;
      $function$
    `);
    await withLockRetry(
      queryRunner,
      `DROP TRIGGER IF EXISTS trg_catalog_products_search_text ON catalog_products`,
    );
    await withLockRetry(queryRunner, `
      CREATE TRIGGER trg_catalog_products_search_text
      BEFORE INSERT OR UPDATE ON catalog_products
      FOR EACH ROW EXECUTE FUNCTION catalog_products_search_text_update()
    `);
  }

  private async backfill(queryRunner: QueryRunner) {
    // Walk the primary key, 500 rows per statement, so no row stays locked for
    // long and each row is visited once. Every row that exists before the
    // trigger was created exists when the walk starts, so the walk reaches it;
    // rows written after that are filled in by the trigger. Setting the count
    // to NULL makes the trigger compute both columns. A raw UPDATE leaves
    // "updatedAt" untouched (TypeORM sets it, not the database).
    let lastId: string | null = null;
    for (;;) {
      const batch = (await queryRunner.query(
        `SELECT id FROM catalog_products ${lastId ? 'WHERE id > $1' : ''} ORDER BY id LIMIT 500`,
        lastId ? [lastId] : [],
      )) as Array<{ id: string }>;
      if (!batch.length) break;
      lastId = batch[batch.length - 1].id;
      await queryRunner.query(
        `UPDATE catalog_products
         SET search_trgm_count = NULL
         WHERE id = ANY($1::uuid[])
           AND (search_text IS NULL OR search_trgm_count IS NULL)`,
        [batch.map((row) => row.id)],
      );
    }
    // concat_ws never returns NULL, so nothing may be left. Fail loudly rather
    // than let the new search silently skip rows.
    const [remaining] = (await queryRunner.query(
      `SELECT count(*)::int AS n FROM catalog_products WHERE search_text IS NULL OR search_trgm_count IS NULL`,
    )) as Array<{ n: number }>;
    if (remaining && remaining.n > 0)
      throw new Error(
        `catalog_products search backfill left ${remaining.n} rows without search_text`,
      );
  }

  private async createIndexes(queryRunner: QueryRunner) {
    // CREATE INDEX CONCURRENTLY waits for every transaction that is already
    // running (slow catalog queries included). That wait is a lock wait, so a
    // lock_timeout would cancel the build and leave an INVALID index.
    await queryRunner.query(`SET lock_timeout = 0`);
    // A failed CONCURRENTLY build leaves an INVALID index that IF NOT EXISTS
    // would silently keep, so drop any invalid leftover first.
    for (const index of [
      'idx_catalog_products_search_text_trgm',
      'idx_catalog_products_search_trgm_count',
    ]) {
      const invalid = (await queryRunner.query(
        `SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = $1 AND NOT i.indisvalid`,
        [index],
      )) as unknown[];
      if (invalid.length)
        await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS ${index}`);
    }
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_products_search_text_trgm
      ON catalog_products USING gin (search_text public.gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_products_search_trgm_count
      ON catalog_products (organization_id, vertical, search_trgm_count)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_catalog_products_search_trgm_count`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_catalog_products_search_text_trgm`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_catalog_products_search_text ON catalog_products`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS catalog_products_search_text_update()`,
    );
    await queryRunner.query(`
      ALTER TABLE catalog_products
        DROP COLUMN IF EXISTS search_trgm_count,
        DROP COLUMN IF EXISTS search_text
    `);
  }
}

/**
 * Runs a brief ACCESS EXCLUSIVE / SHARE ROW EXCLUSIVE statement under the
 * session's lock_timeout, retrying when it times out (55P03) behind a
 * long-running query instead of failing the migration.
 */
async function withLockRetry(queryRunner: QueryRunner, sql: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await queryRunner.query(sql);
      return;
    } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string })
        .driverError?.code ?? (error as { code?: string }).code;
      if (code !== '55P03' || attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

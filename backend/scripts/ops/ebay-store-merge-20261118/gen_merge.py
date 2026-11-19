"""Generate dry-run (read-only) and apply SQL for merging duplicate eBay stores.

Each group: one surviving connected_ebay_accounts row; loser accounts are merged
into it. Store/connection IDs are derived from the accounts at run time.
Dry run and apply share the same row filters, so dry-run counts are what apply
would touch.

Usage: python gen_merge.py <out_dir>
"""
import os
import sys

TAG = "20261118"

GROUPS = {
    # grp: (survivor account, [loser accounts], label)
    "A": ("a7b47ae4-768a-4506-8d74-d56212dc2478",
          ["5215d15e-04da-43c8-8b48-4b799e21da2a"],
          "K. Euro Japan Auto Parts <- All About Mercedes"),
    "B": ("42e665b4-21fd-4ccb-ad9b-0353fd633908",
          ["26fdc135-0c5a-4ed4-a872-e7ea0cf46962", "4a5b2637-5e9c-4cea-b99b-a527f56a394c"],
          "prime motive (B&I) <- 2x Business & Industrial eBay store"),
    "C": ("5bf483d5-3f3d-443c-b517-397fa5faff56",
          ["967fde23-4483-48a3-8cef-8b0c99d002ac", "555bcacd-3eda-4175-b3e1-61744a6837f6"],
          "GMCadiFordRover4*4 Parts <- B.JLRWORLD, eBay store"),
    "D": ("ae5ab4da-0d74-49ff-840c-2783dc555754",
          ["f6e5e951-03c7-4973-b3ad-9335e5876c7b", "faec29ab-0588-4684-9bac-b920d2e47dd5",
           "791f1a7c-27b2-4994-b176-cf4c5b8b0ad2"],
          "Salvage Auto Parts <- 2x K. Salvage Auto Parts, eBay store"),
    "F": ("4179c74f-761c-4064-a9cc-91c65e3f108c",
          ["f968fcc2-6a01-4fc5-95e1-24e2d308a74a"],
          "Superior Auto Parts <- Superior Auto Parts (old)"),
}
ORPHAN_STORE = "70ad5c44-6424-4998-815c-99adf28c2487"

# Account-keyed tables with a unique key that includes ebay_account_id.
ACCOUNT_UNIQUE = [
    ("ebay_listing_channels", ["catalog_product_id", "marketplace_id"]),
    ("listing_store_overrides", ["catalog_product_id", "marketplace_id"]),
    ("variant_marketplace_mappings", ["variant_id", "marketplace_id"]),
]
# Account-keyed history/work tables: move every row.
ACCOUNT_MOVE = ["ebay_listing_job_targets", "fashion_listing_pipeline",
                "fashion_publish_batches", "inventory_movements"]
# Store-keyed tables with a unique key that includes store_id (other key cols).
STORE_UNIQUE = [
    ("ebay_hosted_images", ["source_url"], "updated_at"),
    ("channel_stock_sync_state", ["inventory_item_id"], "updated_at"),
    ("store_stock_policies", [], "updated_at"),
    ("store_warehouse_links", ["warehouse_id"], "created_at"),
    ("user_store_assignments", ["user_id"], "created_at"),
    ("listing_channel_instances", ["listing_id"], "updated_at"),
    ("store_inventory_allocations", ["listing_id"], "updated_at"),
    ("ebay_offers", ["sku"], "updated_at"),
]
# Store-keyed tables: move every row.
STORE_MOVE = ["orders", "sales_records", "pipeline_jobs", "ebay_published_listing_changes",
              "export_rules", "pricing_rules", "automation_rules", "procurement_requests",
              "stock_movements", "stock_reservations", "motoark_orders", "motoark_order_events"]


def header(read_only: bool, grp: str, survivor: str, losers: list[str]) -> str:
    arr = "{" + ",".join(losers) + "}"
    lines = []
    if read_only:
        lines.append("SET default_transaction_read_only = on;")
        lines.append("SET statement_timeout = '300s';")
    lines += [
        "\\set ON_ERROR_STOP on",
        f"\\set grp '{grp}'",
        f"\\set survivor '{survivor}'",
        f"\\set losers '{arr}'",
        # Survivor store/connection/name/org/env.
        "SELECT primary_store_id AS s_store, channel_connection_id AS s_conn, account_display_name AS s_name,"
        " organization_id AS s_org, environment AS s_env FROM connected_ebay_accounts WHERE id = :'survivor' \\gset",
        "SELECT '{' || string_agg(primary_store_id::text, ',') || '}' AS l_stores,"
        " '{' || string_agg(channel_connection_id::text, ',') || '}' AS l_conns,"
        " count(*) AS l_n FROM connected_ebay_accounts WHERE id = ANY(:'losers'::uuid[]) \\gset",
    ]
    return "\n".join(lines) + "\n"


def prechecks() -> str:
    return """
-- Pre-checks: every loser exists, same workspace and environment, native OAuth, not the survivor.
SELECT :'grp' AS grp, :'s_name' AS survivor_name, :l_n AS losers_found, array_length(:'losers'::uuid[], 1) AS losers_expected,
  (SELECT count(*) FROM connected_ebay_accounts WHERE id = ANY(:'losers'::uuid[]) AND (organization_id <> :'s_org' OR environment <> :'s_env' OR connection_source = 'sellerpundit' OR id = :'survivor')) AS bad_losers,
  (SELECT count(*) FROM stores WHERE id = ANY(:'l_stores'::uuid[]) AND (organization_id <> :'s_org' OR channel <> 'ebay')) AS bad_stores;
SELECT (:l_n = array_length(:'losers'::uuid[], 1)
  AND (SELECT count(*) FROM connected_ebay_accounts WHERE id = ANY(:'losers'::uuid[]) AND (organization_id <> :'s_org' OR environment <> :'s_env' OR connection_source = 'sellerpundit' OR id = :'survivor')) = 0
  AND (SELECT count(*) FROM stores WHERE id = ANY(:'l_stores'::uuid[]) AND (organization_id <> :'s_org' OR channel <> 'ebay')) = 0) AS precheck_ok \\gset
\\if :precheck_ok
\\else
\\echo PRECHECK FAILED for group :grp
\\quit
\\endif
"""


def _null_guard(keys: list[str]) -> str:
    """Unique indexes let NULL keys repeat, so a row with a NULL key never collides."""
    return " OR ".join(f"{k} IS NULL" for k in keys) if keys else "false"


def acct_unique_rank(table: str, keys: list[str]) -> str:
    part = ", ".join(keys)
    return (f"SELECT ctid AS c, ebay_account_id AS a, CASE WHEN {_null_guard(keys)} THEN 1 ELSE "
            f"row_number() OVER (PARTITION BY {part} "
            f"ORDER BY (ebay_account_id = :'survivor') DESC, updated_at DESC NULLS LAST, id) END AS rn "
            f"FROM {table} WHERE ebay_account_id = :'survivor' OR ebay_account_id = ANY(:'losers'::uuid[])")


def store_unique_rank(table: str, keys: list[str], fresh: str) -> str:
    part = ", ".join(keys) if keys else "true"
    return (f"SELECT ctid AS c, store_id AS s, CASE WHEN {_null_guard(keys)} THEN 1 ELSE "
            f"row_number() OVER (PARTITION BY {part} "
            f"ORDER BY (store_id = :'s_store') DESC, {fresh} DESC NULLS LAST) END AS rn "
            f"FROM {table} WHERE store_id = :'s_store' OR store_id = ANY(:'l_stores'::uuid[])")


EPL_KEYS = ("id, ebay_account_id, store_id, marketplace_id, ebay_item_id, sku, catalog_product_id, "
            "ebay_listing_channel_id, listing_status, last_synced_at, account_display_name")


def dry_run(grp: str, survivor: str, losers: list[str], label: str) -> str:
    out = [f"-- DRY RUN group {grp}: {label}", header(True, grp, survivor, losers), prechecks()]
    q = []
    for t, keys in ACCOUNT_UNIQUE:
        r = acct_unique_rank(t, keys)
        q.append(f"SELECT '{t}' AS step, count(*) FILTER (WHERE a <> :'survivor' AND rn > 1) AS would_delete_collisions, "
                 f"count(*) FILTER (WHERE a <> :'survivor' AND rn = 1) AS would_move FROM ({r}) r")
    for t in ACCOUNT_MOVE:
        q.append(f"SELECT '{t}' AS step, 0 AS would_delete_collisions, count(*) AS would_move FROM {t} WHERE ebay_account_id = ANY(:'losers'::uuid[])")
    for t, keys, fresh in STORE_UNIQUE:
        r = store_unique_rank(t, keys, fresh)
        q.append(f"SELECT '{t}' AS step, count(*) FILTER (WHERE s <> :'s_store' AND rn > 1) AS would_delete_collisions, "
                 f"count(*) FILTER (WHERE s <> :'s_store' AND rn = 1) AS would_move FROM ({r}) r")
    for t in STORE_MOVE:
        q.append(f"SELECT '{t}' AS step, 0 AS would_delete_collisions, count(*) AS would_move FROM {t} WHERE store_id = ANY(:'l_stores'::uuid[])")
    q.append("SELECT 'business_industrial_units' AS step, 0, count(*) FROM business_industrial_units WHERE allocated_store_id = ANY(:'l_stores'::uuid[])")
    union = "\nUNION ALL ".join(f"({x})" for x in q)
    out.append(f"SELECT :'grp' AS grp, * FROM (\n{union}\n) v WHERE would_delete_collisions + would_move > 0;")
    # Publish-record collisions by status pair, so we can see what "keep survivor" drops.
    out.append(f"""
SELECT 'ebay_listing_channels collisions by status' AS step, s.listing_status AS survivor_status, l.listing_status AS loser_status, count(*)
FROM ebay_listing_channels l JOIN ebay_listing_channels s
  ON s.catalog_product_id = l.catalog_product_id AND s.marketplace_id = l.marketplace_id AND s.ebay_account_id = :'survivor'
WHERE l.ebay_account_id = ANY(:'losers'::uuid[]) GROUP BY 2, 3 ORDER BY 4 DESC;""")
    # Listing mirrors.
    out.append(f"""
SELECT 'ebay_published_listings' AS step,
  count(*) AS loser_rows,
  count(*) FILTER (WHERE on_survivor) AS would_delete_already_on_survivor,
  count(*) FILTER (WHERE NOT on_survivor AND rn > 1) AS would_delete_dup_among_losers,
  count(*) FILTER (WHERE NOT on_survivor AND rn = 1) AS would_move,
  count(*) FILTER (WHERE on_survivor AND catalog_product_id IS NOT NULL) AS deleted_rows_with_catalog_link,
  count(*) FILTER (WHERE on_survivor AND catalog_product_id IS NOT NULL AND survivor_link IS NULL) AS links_copied_to_survivor,
  count(*) FILTER (WHERE on_survivor AND catalog_product_id IS NOT NULL AND survivor_link IS NOT NULL AND survivor_link <> catalog_product_id) AS conflicting_links_dropped
FROM (
  SELECT l.catalog_product_id,
    (l.ebay_item_id IS NOT NULL AND s.id IS NOT NULL) AS on_survivor,
    s.catalog_product_id AS survivor_link,
    CASE WHEN l.ebay_item_id IS NULL THEN 1 ELSE row_number() OVER (PARTITION BY l.marketplace_id, l.ebay_item_id
      ORDER BY (l.catalog_product_id IS NOT NULL) DESC, l.last_synced_at DESC NULLS LAST, l.id) END AS rn
  FROM ebay_published_listings l
  LEFT JOIN ebay_published_listings s ON s.ebay_account_id = :'survivor' AND s.marketplace_id = l.marketplace_id AND s.ebay_item_id = l.ebay_item_id
  WHERE l.ebay_account_id = ANY(:'losers'::uuid[])
) x;""")
    out.append("""
SELECT 'retire' AS step, a.account_display_name, a.connection_status, s.store_name, s.status
FROM connected_ebay_accounts a JOIN stores s ON s.id = a.primary_store_id WHERE a.id = ANY(:'losers'::uuid[]);""")
    return "\n".join(out) + "\n"


BATCH = 2000


def _backups(grp_tag: str) -> list[str]:
    bk = f"merge_backup_{TAG}"
    bks = []

    def backup(table: str, where: str, cols: str = "t.*") -> None:
        name = f"{bk}_{table}"
        bks.append(f"CREATE TABLE IF NOT EXISTS {name} AS SELECT ''::text AS merge_group, {cols} FROM {table} t WHERE false")
        # Re-runs must not double the backup.
        bks.append(f"INSERT INTO {name} SELECT :'grp', {cols} FROM {table} t WHERE ({where}) "
                   f"AND NOT EXISTS (SELECT 1 FROM {name} b WHERE b.merge_group = :'grp')")
    backup("connected_ebay_accounts", "t.id = ANY(:'losers'::uuid[]) OR t.id = :'survivor'")
    backup("stores", "t.id = ANY(:'l_stores'::uuid[]) OR t.id = :'s_store'")
    backup("ebay_oauth_tokens", "t.ebay_account_id = ANY(:'losers'::uuid[])")
    for t, _ in ACCOUNT_UNIQUE:
        backup(t, "t.ebay_account_id = ANY(:'losers'::uuid[])")
    for t in ACCOUNT_MOVE:
        backup(t, "t.ebay_account_id = ANY(:'losers'::uuid[])")
    for t, _, _ in STORE_UNIQUE:
        backup(t, "t.store_id = ANY(:'l_stores'::uuid[])")
    for t in STORE_MOVE:
        if t == "ebay_published_listing_changes":
            backup(t, "t.store_id = ANY(:'l_stores'::uuid[])", "t.id, t.store_id")
        else:
            backup(t, "t.store_id = ANY(:'l_stores'::uuid[])")
    backup("business_industrial_units", "t.allocated_store_id = ANY(:'l_stores'::uuid[])")
    epl_cols = ", ".join(f"t.{c.strip()}" for c in EPL_KEYS.split(","))
    backup("ebay_published_listings",
           "t.ebay_account_id = ANY(:'losers'::uuid[]) OR (t.ebay_account_id = :'survivor' AND t.catalog_product_id IS NULL)",
           epl_cols)
    return bks


def apply_phase1(grp: str, survivor: str, losers: list[str], label: str) -> str:
    """Backups + every small table, in one short transaction. Re-runnable."""
    out = [f"-- APPLY PHASE 1 group {grp}: {label}", header(False, grp, survivor, losers), prechecks()]
    out.append("BEGIN;")
    out.append("SET LOCAL lock_timeout = '5s';")
    out.append("SET LOCAL statement_timeout = '5min';")
    out.append(";\n".join(_backups(grp)) + ";")
    dml = []
    for t, keys in ACCOUNT_UNIQUE:
        r = acct_unique_rank(t, keys)
        dml.append(f"WITH r AS ({r}) DELETE FROM {t} x USING r WHERE x.ctid = r.c AND r.a <> :'survivor' AND r.rn > 1")
        dml.append(f"UPDATE {t} SET ebay_account_id = :'survivor' WHERE ebay_account_id = ANY(:'losers'::uuid[])")
    for t in ACCOUNT_MOVE:
        dml.append(f"UPDATE {t} SET ebay_account_id = :'survivor' WHERE ebay_account_id = ANY(:'losers'::uuid[])")
    for t, keys, fresh in STORE_UNIQUE:
        r = store_unique_rank(t, keys, fresh)
        dml.append(f"WITH r AS ({r}) DELETE FROM {t} x USING r WHERE x.ctid = r.c AND r.s <> :'s_store' AND r.rn > 1")
        extra = ", connection_id = :'s_conn'" if t == "listing_channel_instances" else ""
        dml.append(f"UPDATE {t} SET store_id = :'s_store'{extra} WHERE store_id = ANY(:'l_stores'::uuid[])")
    for t in STORE_MOVE:
        dml.append(f"UPDATE {t} SET store_id = :'s_store' WHERE store_id = ANY(:'l_stores'::uuid[])")
    dml.append("UPDATE orders SET connection_id = :'s_conn' WHERE connection_id = ANY(:'l_conns'::uuid[])")
    dml.append("UPDATE business_industrial_units SET allocated_store_id = :'s_store' WHERE allocated_store_id = ANY(:'l_stores'::uuid[])")
    out.append(";\n".join(dml) + ";")
    out.append("COMMIT;")
    out.append("\\echo PHASE 1 COMMITTED group :grp")
    return "\n".join(out) + "\n"


def _batched(temp: str, action: str, label: str) -> str:
    """Server-side loop: take BATCH ids off a temp table, act on them, commit, pause."""
    return f"""DO $$
DECLARE batches int := 0; left_n bigint;
BEGIN
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM {temp});
    WITH b AS (DELETE FROM {temp} WHERE id IN (SELECT id FROM {temp} LIMIT {BATCH}) RETURNING id)
    {action};
    COMMIT;
    batches := batches + 1;
    IF batches % 20 = 0 THEN
      SELECT count(*) INTO left_n FROM {temp};
      RAISE NOTICE '{label}: % batches done, % rows left', batches, left_n;
    END IF;
    PERFORM pg_sleep(0.1);
  END LOOP;
  RAISE NOTICE '{label}: finished after % batches', batches;
END $$;"""


def apply_phase2(grp: str, survivor: str, losers: list[str], label: str) -> str:
    """Listing mirrors in committed batches of BATCH rows. Re-runnable."""
    out = [f"-- APPLY PHASE 2 group {grp}: {label}", header(False, grp, survivor, losers), prechecks()]
    out.append("SET lock_timeout = '5s';")
    # A DO block counts as one statement, so no statement limit here; each batch is
    # protected by lock_timeout instead (it stops rather than wait on the app).
    out.append("SET statement_timeout = 0;")
    out.append("""CREATE TEMP TABLE merge_ctx AS SELECT :'survivor'::uuid AS survivor, :'s_store'::uuid AS s_store, :'s_name'::text AS s_name;""")
    # 1. Carry catalog links onto survivor rows for the same eBay item (small, one statement).
    out.append("""UPDATE ebay_published_listings s
SET catalog_product_id = l.catalog_product_id,
    ebay_listing_channel_id = COALESCE(s.ebay_listing_channel_id, l.ebay_listing_channel_id)
FROM (SELECT DISTINCT ON (marketplace_id, ebay_item_id) marketplace_id, ebay_item_id, catalog_product_id, ebay_listing_channel_id
      FROM ebay_published_listings
      WHERE ebay_account_id = ANY(:'losers'::uuid[]) AND catalog_product_id IS NOT NULL AND ebay_item_id IS NOT NULL
      ORDER BY marketplace_id, ebay_item_id, last_synced_at DESC NULLS LAST, id) l
WHERE s.ebay_account_id = :'survivor' AND s.marketplace_id = l.marketplace_id AND s.ebay_item_id = l.ebay_item_id
  AND s.catalog_product_id IS NULL;""")
    # 2. Rows to delete: already on the survivor, or a duplicate among losers.
    out.append("""CREATE TEMP TABLE merge_epl_del AS
SELECT l.id FROM ebay_published_listings l
WHERE l.ebay_account_id = ANY(:'losers'::uuid[]) AND l.ebay_item_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM ebay_published_listings s WHERE s.ebay_account_id = :'survivor'
              AND s.marketplace_id = l.marketplace_id AND s.ebay_item_id = l.ebay_item_id)
UNION ALL
SELECT id FROM (
  SELECT l.id, row_number() OVER (PARTITION BY l.marketplace_id, l.ebay_item_id
           ORDER BY (l.catalog_product_id IS NOT NULL) DESC, l.last_synced_at DESC NULLS LAST, l.id) AS rn
  FROM ebay_published_listings l
  WHERE l.ebay_account_id = ANY(:'losers'::uuid[]) AND l.ebay_item_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ebay_published_listings s WHERE s.ebay_account_id = :'survivor'
                    AND s.marketplace_id = l.marketplace_id AND s.ebay_item_id = l.ebay_item_id)) x
WHERE rn > 1;
CREATE INDEX ON merge_epl_del (id);
SELECT :'grp' AS grp, count(*) AS mirror_rows_to_delete FROM merge_epl_del;""")
    out.append(_batched("merge_epl_del", "DELETE FROM ebay_published_listings e USING b WHERE e.id = b.id", f"group {grp} delete"))
    # 3. Move the rest.
    out.append("""CREATE TEMP TABLE merge_epl_move AS SELECT id FROM ebay_published_listings WHERE ebay_account_id = ANY(:'losers'::uuid[]);
CREATE INDEX ON merge_epl_move (id);
SELECT :'grp' AS grp, count(*) AS mirror_rows_to_move FROM merge_epl_move;""")
    out.append(_batched("merge_epl_move",
                        "UPDATE ebay_published_listings e SET ebay_account_id = c.survivor, store_id = c.s_store, "
                        "account_display_name = c.s_name FROM b, merge_ctx c WHERE e.id = b.id",
                        f"group {grp} move"))
    out.append("SELECT :'grp' AS grp, count(*) AS mirror_rows_left_on_losers FROM ebay_published_listings WHERE ebay_account_id = ANY(:'losers'::uuid[]);")
    out.append("\\echo PHASE 2 DONE group :grp")
    return "\n".join(out) + "\n"


def apply_phase3(grp: str, survivor: str, losers: list[str], label: str) -> str:
    """Retire losers and verify nothing still points at them; commit only if clean."""
    out = [f"-- APPLY PHASE 3 group {grp}: {label}", header(False, grp, survivor, losers), prechecks()]
    out.append("BEGIN;")
    out.append("SET LOCAL lock_timeout = '5s';")
    out.append("SET LOCAL statement_timeout = '5min';")
    dml = []
    dml.append("""UPDATE connected_ebay_accounts SET connection_status = 'disabled',
  account_display_name = account_display_name || ' (merged into ' || :'s_name' || ')',
  last_error_message = 'Merged into account ' || :'survivor' || ' on """ + TAG + """', updated_at = now()
WHERE id = ANY(:'losers'::uuid[]) AND account_display_name NOT LIKE '%(merged into %'""")
    dml.append("""UPDATE stores SET status = 'archived',
  store_name = store_name || ' (merged into ' || :'s_name' || ')', updated_at = now()
WHERE id = ANY(:'l_stores'::uuid[]) AND store_name NOT LIKE '%(merged into %'""")
    dml.append("UPDATE ebay_oauth_tokens SET reconnect_required = true, updated_at = now() WHERE ebay_account_id = ANY(:'losers'::uuid[])")
    out.append(";\n".join(dml) + ";")
    checks = [f"SELECT '{t}.ebay_account_id' AS left_on_losers, count(*) AS n FROM {t} WHERE ebay_account_id = ANY(:'losers'::uuid[])"
              for t in [x for x, _ in ACCOUNT_UNIQUE] + ACCOUNT_MOVE + ["ebay_published_listings"]]
    checks += [f"SELECT '{t}.store_id', count(*) FROM {t} WHERE store_id = ANY(:'l_stores'::uuid[])"
               for t in [x for x, _, _ in STORE_UNIQUE] + STORE_MOVE + ["ebay_published_listings"]]
    checks.append("SELECT 'orders.connection_id', count(*) FROM orders WHERE connection_id = ANY(:'l_conns'::uuid[])")
    checks.append("SELECT 'business_industrial_units.allocated_store_id', count(*) FROM business_industrial_units WHERE allocated_store_id = ANY(:'l_stores'::uuid[])")
    union = "\nUNION ALL ".join(checks)
    out.append(f"SELECT * FROM (\n{union}\n) v WHERE n > 0;")
    out.append(f"SELECT NOT EXISTS (SELECT 1 FROM (\n{union}\n) v WHERE n > 0) AS clean \\gset")
    out.append("\\if :clean\nCOMMIT;\n\\echo PHASE 3 COMMITTED group :grp\n\\else\nROLLBACK;\n\\echo PHASE 3 ROLLED BACK group :grp - rows still point at losers\n\\endif")
    out.append("""SELECT 'after' AS step, a.account_display_name, a.connection_status, s.store_name, s.status
FROM connected_ebay_accounts a JOIN stores s ON s.id = a.primary_store_id
WHERE a.id = ANY(:'losers'::uuid[]) OR a.id = :'survivor' ORDER BY (a.id = :'survivor') DESC;""")
    return "\n".join(out) + "\n"


INDEXES = [
    ("idx_lal_published_listing", "listing_action_logs", "ebay_published_listing_id"),
    ("idx_lal_listing_channel", "listing_action_logs", "ebay_listing_channel_id"),
    ("idx_epl_listing_channel", "ebay_published_listings", "ebay_listing_channel_id"),
    ("idx_eplbji_published_listing", "ebay_published_listing_bulk_job_items", "published_listing_id"),
    ("idx_eae_listing_channel", "ebay_api_errors", "ebay_listing_channel_id"),
]


def indexes_sql() -> str:
    lines = ["\\set ON_ERROR_STOP on", "SET statement_timeout = 0;", "SET lock_timeout = '30s';", "\\timing on"]
    for name, table, col in INDEXES:
        lines.append(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} ({col}) WHERE {col} IS NOT NULL;")
    names = ",".join(f"'{n}'" for n, _, _ in INDEXES)
    lines.append(f"SELECT c.relname AS index, i.indisvalid AS valid, pg_size_pretty(pg_relation_size(c.oid)) AS size "
                 f"FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname IN ({names}) ORDER BY 1;")
    return "\n".join(lines) + "\n"


def orphan_dry() -> str:
    return f"""SET default_transaction_read_only = on;
SELECT 'orphan store' AS step, s.id, s.store_name, s.status,
  (SELECT count(*) FROM connected_ebay_accounts a WHERE a.primary_store_id = s.id) AS accounts,
  (SELECT count(*) FROM orders WHERE store_id = s.id) AS orders
FROM stores s WHERE s.id = '{ORPHAN_STORE}';
"""


def orphan_apply() -> str:
    return f"""\\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS merge_backup_{TAG}_stores AS SELECT ''::text AS merge_group, t.* FROM stores t WHERE false;
INSERT INTO merge_backup_{TAG}_stores SELECT 'O', t.* FROM stores t WHERE t.id = '{ORPHAN_STORE}';
UPDATE stores SET status = 'archived', store_name = store_name || ' (archived {TAG}: no eBay account)', updated_at = now()
WHERE id = '{ORPHAN_STORE}' AND NOT EXISTS (SELECT 1 FROM connected_ebay_accounts a WHERE a.primary_store_id = stores.id);
COMMIT;
"""


def main() -> None:
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    def write(name: str, text: str) -> None:
        with open(os.path.join(out_dir, name), "w", newline="\n") as f:
            f.write(text)
    for grp, (survivor, losers, label) in GROUPS.items():
        write(f"dryrun_{grp}.sql", dry_run(grp, survivor, losers, label))
        write(f"apply1_{grp}.sql", apply_phase1(grp, survivor, losers, label))
        write(f"apply2_{grp}.sql", apply_phase2(grp, survivor, losers, label))
        write(f"apply3_{grp}.sql", apply_phase3(grp, survivor, losers, label))
    write("dryrun_O.sql", orphan_dry())
    write("apply_O.sql", orphan_apply())
    write("indexes.sql", indexes_sql())


if __name__ == "__main__":
    main()

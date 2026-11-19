# eBay duplicate-store merge (2026-11-18)

One-off tooling used to merge Omni eBay accounts that turned out to be the same
eBay seller. The record of what was merged and the results is in
[docs/operations/EBAY_DUPLICATE_STORE_MERGE_2026-11-18.md](../../../../docs/operations/EBAY_DUPLICATE_STORE_MERGE_2026-11-18.md).

`gen_merge.py` writes the SQL for each group (`python gen_merge.py <out_dir>`):

| File | What it does |
|---|---|
| `dryrun_<grp>.sql` | Read-only counts of what the merge would delete and move |
| `apply1_<grp>.sql` | One short transaction: backups into `merge_backup_20261118_*`, then every small table (publish records, job targets, orders, images, user assignments, warehouse links, stock settings) |
| `apply2_<grp>.sql` | Listing mirrors (`ebay_published_listings`) in committed batches of 2,000 rows: carry catalog links to the survivor, delete rows the survivor already mirrors and duplicates among losers, move the rest |
| `apply3_<grp>.sql` | Retire losers (account `disabled`, store `archived`, names suffixed "(merged into …)", tokens `reconnect_required`) and verify nothing still points at them; commits only if clean |
| `indexes.sql` | `CREATE INDEX CONCURRENTLY` for the foreign-key columns the deletes need (also migration `1791900000000`) |

Rules: where the survivor already has a row with the same unique key, the
survivor's row is kept. Among losers, the row with a catalog link wins, then the
most recently synced. Every phase is safe to re-run.

Run each file with `psql -f` against `listingpro` (from the Postgres container),
in order 1, 2, 3, one group at a time, watching `pg_blocking_pids` meanwhile.
`lock_timeout` is 5s, so a batch that would wait on the app stops instead.

`test/seed.sql` + `test/assert.sql` build a synthetic seller in an empty database
loaded with the production schema (`pg_dump --schema-only`) and check the end
state of all three phases, including a full re-run.

Do not run bulk changes on `ebay_published_listings` in one transaction: a
74k-row delete without the foreign-key indexes ran for over 10 minutes and
blocked the published-listings sync.

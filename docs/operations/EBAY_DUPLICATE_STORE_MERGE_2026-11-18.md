# eBay duplicate-store merge — 2026-11-18

Production clean-up after "Sign in with eBay" used to create a new store on
every reconnect (fixed the same day in PR #12, `8611a1ac`). Scripts and tests:
[backend/scripts/ops/ebay-store-merge-20261118/](../../backend/scripts/ops/ebay-store-merge-20261118/README.md).

## How duplicates were identified

Display names were unreliable (most accounts carried placeholder `unknown_<ms>`
seller IDs, and some rows held another seller's login). Two accounts were treated
as the same eBay seller when they share **business-policy IDs** in
`ebay_business_policies` (all rows came from eBay's Account API with each account's
own token) and **eBay item IDs** in `ebay_published_listings`. Both are unique to
one seller.

## Groups merged (survivor ← losers)

| Group | Survivor (kept) | Merged in | Workspace |
|---|---|---|---|
| A | K. Euro Japan Auto Parts `a7b47ae4` | All About Mercedes `5215d15e` (held K. Euro Japan's login, 0 listings) | Super Admin |
| B | prime motive `42e665b4` | 2 × Business & Industrial eBay store `26fdc135`, `4a5b2637` (identical 50k-row copies) | Business & Industrial |
| C | GMCadiFordRover4*4 Parts `5bf483d5` | B.JLRWORLD `967fde23`, eBay store `555bcacd` | Super Admin |
| D | Salvage Auto Parts `ae5ab4da` | K. Salvage Auto Parts `f6e5e951`, `faec29ab`; eBay store `791f1a7c` | Super Admin |
| F | Superior Auto Parts `4179c74f` | Superior Auto Parts (old) `f968fcc2` | Super Admin |
| O | — | Store `70ad5c44` "eBay store" with no account: archived only | Super Admin |

Survivor rule: the active account with the most Omni data (publish records,
orders, working token).

**Deliberately not merged** (operator decision, 2026-11-18):
- *Primemotive* is one eBay seller in two workspaces: Auto Parts (`7c7d7de8`,
  173k mirrors, the Primemotive change feed) and Business & Industrial. One store
  per workspace is kept.
- *Prime Wardrobe De* (`c5e17d56`) and *Primewardrobeusa* (`718461ce`) hold the
  same eBay login but serve different marketplaces; left as they are.

## Method

1. Read-only dry run per group (`dryrun_<grp>.sql`).
2. Rollback test of the apply script. The group F test (one transaction, ~74k
   listing-row deletes) ran over 10 minutes and blocked six
   `published-listings` sync updates for up to 8 minutes before it was cancelled
   with `pg_cancel_backend`. Cause: unindexed foreign keys
   (`listing_action_logs.ebay_published_listing_id`,
   `ebay_published_listings.ebay_listing_channel_id`, …), so every deleted row
   scanned a whole table.
3. Added the five missing indexes with `CREATE INDEX CONCURRENTLY` (migration
   `1791900000000-EbayListingForeignKeyIndexes` records them; it is a no-op on
   production).
4. Rebuilt the apply into three phases (small tables in one transaction; listing
   mirrors in committed batches of 2,000 rows with `lock_timeout = 5s`; retire and
   verify in one transaction that commits only if nothing still points at a
   loser). Tested end to end, including a full re-run, on a throwaway Postgres
   container loaded with the production schema and synthetic rows (27 checks).
5. Applied group by group, smallest first, watching `pg_blocking_pids`.

Merge rules: where the survivor already has a row with the same unique key
(publish record, warehouse link, stock policy, stock sync state, user assignment,
hosted image), the survivor's row is kept. Among losers the row with a catalog
link wins, then the most recently synced. Catalog links on deleted mirror rows
are copied to the survivor's row for the same eBay item.

Backups: `merge_backup_20261118_*` tables (full rows, except listing mirrors,
which keep id, account, store, marketplace, item, SKU, catalog link, listing
channel, status and sync time).

## Results

Indexes: created 2026-11-18 12:45 UTC with `CREATE INDEX CONCURRENTLY`, all
valid; the one on `ebay_published_listings` took 55 s. Nothing was blocked.

| Group | Applied (UTC) | Duration | Mirrors deleted / moved | Survivor after merge | Blocked app sessions |
|---|---|---|---|---|---|
| O | 2026-11-18 12:47 | <1 s | — | store archived (9 orders stay on it) | 0 |
| A | 2026-11-18 12:48 | 19 s | 0 / 0 | K. Euro Japan: 12 orders, 3 user assignments | 0 |
| B | 2026-11-18 12:56 | 48 s | 99,993 / 7 | prime motive: 50,007 mirrors, 23 orders | 0 |
| F | 2026-11-19 08:23 | 287 s | 73,713 / 54,759 | Superior: 132,488 mirrors, 5,877 publish records, 143 orders | 0 |
| C | 2026-11-19 08:39 | 352 s | 124,974 / 9,014 | GMCadiFordRover4*4: 96,270 mirrors, 2,562 publish records, 54 orders, 3 users | 0 |
| D | 2026-11-19 10:07 | 5,286 s | 290,686 / 132,292 | Salvage Auto Parts: 226,174 mirrors (10,351 with catalog links), 11,464 publish records, 181 orders, 50 pipeline jobs | 0 |

Group D ran while another session's full `pg_dump -Fc` (started 08:36 UTC) read
the same table, so delete batches took ~30–50 s instead of ~3 s. Afterwards the
listing mirror table held ~1.37M rows (from ~1.96M); autovacuum ran at 10:07 and
`ANALYZE` was run by hand. Order import now covers 22 stores (was 29) and no
backend log line mentions a merged account or store after 10:08 UTC.

302 Salvage products had been listed twice on eBay (Jul–Aug and Sep); the
September publish records were kept, so the older listings stay live on eBay but
untracked (deleted records are in `merge_backup_20261118_ebay_listing_channels`,
group D).

**Still to do:** delete the 9 retired accounts and their archived stores after
2026-11-26; drop the `merge_backup_20261118_*` tables after that; reconnect
K. Euro Japan Auto Parts (reconnect_required).

Group B's first run was cut off by an SSH disconnect after phase 1 committed;
re-running all three phases (detached with `nohup setsid`) completed it without
doubling the backups. Later groups ran detached.

Every merged duplicate now has 0 mirrors, publish records, orders and store
links; its account is `disabled`, its store `archived`, and both names end in
"(merged into …)".

# PrimeMotive US production reconciliation — 2026-11-05

## Status

**API access follow-up completed (2026-11-05):** After the user explicitly
approved resetting the API reader password, the reset committed at
`2026-11-05T08:20:51.523Z` (13:20 Asia/Karachi). A fresh authenticated check
completed at `2026-11-05T08:22:19.839Z` (13:22 Asia/Karachi): representative
active, out-of-stock, and ended listings and the dedicated PrimeMotive feed
all returned HTTP 200 with the expected item IDs, quantities, and statuses.
The earlier credential failures below are retained as history and no longer
block this reader-account API check. Consumer applications still need the
rotated credential before their own logins can be claimed verified.

**Committed and independently verified on production.** Commit completed `2026-11-05T06:43:17.049Z` (11:43 Asia/Karachi); independent post-commit verification completed `2026-11-05T06:45:00.937Z` (11:45 Asia/Karachi). All 90535 source rows and 5222 matching publication links passed with zero quantity/status/SKU mismatches. No further mirror inserts are required for this source population.

Actual committed changes: **71911 mirror updates, 18624 mirror inserts, 5222 inventory publication-link updates**. Resulting source population: 50935 active, 37940 out of stock, 1660 ended; 62221 advertised available units. Result JSONs are retained beside the durable host backup as `apply-result.json` and `verify-result.json`.

Backend health returned HTTP 200. Authenticated listing API verification is incomplete: the first server's configured integration credentials returned HTTP 401. Automatic approval review initially rejected trying the documented read-only reader credentials without explicit permission. The user subsequently approved that exact account check, and it ran once; the documented reader login also returned HTTP 401, so no authenticated listing requests were made. A read-only production query confirmed reader account `2697aa94-2061-4cbd-a414-6b2bd4d63e6e` exists, is active, and has no password-change-required flag. Current valid credentials are needed to finish the API check; no password reset, access grant, or authentication bypass was attempted. This does not undo or invalidate the independently verified database transaction, but API/consumer visibility and integration authentication must not be claimed verified.

## Scope and evidence

### Authorized API reader reset and verification

- Target: `api-published-listings@realtrack.local`, user `2697aa94-2061-4cbd-a414-6b2bd4d63e6e` only.
- Generated a cryptographically random password on the production server; stored its bcrypt hash with cost 12, matching the application's reset behavior. A compare-and-swap check rejected any concurrent password change. The password hash update and `auth.admin_password_reset` system audit event committed in one transaction.
- Account activation, password-change-required flag, roles, permissions, and store access were preserved. No password or hash was displayed in tool output or committed to source control.
- New credential environment file: `/home/ubuntu/.config/realtrack/api-reader-20261105.env` on the production host. The directory is mode `0700`, the file is mode `0600`; it contains operational environment variables `RECON_VERIFY_EMAIL` and `RECON_VERIFY_PASSWORD`. It is not a Compose configuration change.
- Protected reset rollback record: `/home/ubuntu/backups/primemotive-us-20261105/api-reader-reset-private.json`, mode `0600`. It contains the previous/new hashes and target identity; keep it private. The new credential and rollback record were durably copied before changing the database.
- Verification results: `/home/ubuntu/backups/primemotive-us-20261105/api-verification-result.jsonl`, created with umask `077`. It contains no credentials or bearer tokens.
- Verified listing `365879436193`: active, available 1, revision 2; listing `365872496203`: out_of_stock, available 0, revision 2; listing `366106193577`: ended, available 0, revision 1. Each returned HTTP 200 and exactly one matching result.
- The dedicated `/api/published-listings/primemotive` feed returned HTTP 200 for the verified active listing using the same account. This verifies the reader/API path, not MotoArk ingestion or a stock deduction.
- Helpers: `reset-api-user.cjs` (one-time authorized prepare/apply operation) and `verify-api.cjs` (environment-based login and strict response assertions), under the operational workspace. Password reset does not redeploy or reconfigure the first server's consumers; provision the rotated credential through protected configuration before verifying them.

**Follow-up database credential check (2026-11-05):** At the user's request,
SSH read-only inspection confirmed the reader login is
`api-published-listings@realtrack.local`. The production `users` table stores
its password only as a bcrypt `passwordHash`; its only password-related
columns are `passwordHash` and `password_change_required`. There is no
recoverable plaintext password or API token in that user record. The hash
itself was not displayed. Resetting the password would be a separate access
change requiring authorization and coordination with consumers of this account.

- Production host: `ec2-34-196-184-100.compute-1.amazonaws.com`, account `ubuntu`; running backend image `realtrackapp-backend:ebay-oauth-return-20261104-r1`.
- Organization `3ed54be6-7138-4264-bd8b-73dfa9336245`, eBay account `7c7d7de8-ac02-4e69-9d5e-a2bc0d9c9347`, store `cfcc4a9c-c41b-4166-ab41-989c00a6fad1` (PrimeMotive).
- User authorized the mirror export and production reconciliation, then explicitly approved staging the 90535 US source rows with their IDs, titles, SKUs, prices, and quantities in protected temporary production storage. The initial automated upload rejection was resolved by that explicit approval; no alternate transfer was used to bypass it.
- Input: `eBay-all-active-listings-report-2026-11-04-12357579011.csv`, filtered to `Listing site = US`, all USD, unique item IDs and nonnegative integer quantities, no variation-detail rows.
- Source SHA-256: `a2ce33e1e550a756b3a42f0f4faef26c5135f544eebd2f296e15bb081a310a70`.
- Current eBay feed task: `task-20-30225128423426`, `LMS_ACTIVE_INVENTORY_REPORT`, created `2026-11-05T06:19:31.685Z`, completed `2026-11-05T06:20:28.575Z` (11:19–11:20 Asia/Karachi). Task completion was verified before download.
- Feed archive SHA-256: `10a00b9c506d219abc53a2fe91c9b1e88367fa76e84951eb60acb164acdf148d`.
- The completed report contains 272462 inventory records across the seller account. Only the intersection with the approved US input is used for mutation: 88875 records. There are no duplicate matching item IDs or variation records, and their live SKUs match the input exactly.
- The remaining 1660 supplied US listings are absent from the completed full seller inventory report. Eight direct Trading GetItem checks returned seller `primemotive`, site `US`, and status `Completed`; one also reports removal for an eBay policy violation. This supports ended status, not a fabricated sale. The full report includes zero-quantity active listings, so absence is not treated as ordinary out-of-stock.
- One still-active listing's available quantity changed since the supplied source. Live availability is used, not the older CSV quantity.

## Planned resulting source population

| State | Listings |
|---|---:|
| Active, positive available quantity | 50935 |
| Active offer with zero available quantity (`out_of_stock`) | 37940 |
| Absent from completed full inventory report (`ended`) | 1660 |
| Total supplied US listings accounted for | 90535 |

Advertised available units: **62221**. These are channel quantities, not verified warehouse counts.

The plan updates 71911 existing mirror rows and inserts 18624 missing rows. It aligns the 5222 existing US `ebay_listing_channels` rows that match the source by item ID and account, because `InventoryWorkbenchService.loadStoreListingsBySkus()` reads those publication links separately from the published-listing mirror. Other account/store/marketplace rows are outside the transaction's scope.

## Backup

Durable host backup:

`/home/ubuntu/backups/primemotive-us-20261105/before-4b2a34a0.json.gz`

- SHA-256: `4b2a34a0ef8713b60434e3d226acd9ad715e6a76dd910cabaec90cb8bc18ee14`.
- Size: 14494870 bytes; mode `0600`, protected backup directory created with umask `077`.
- Contains source/current-report identity, scoped target rows including planned insertion IDs, original values of all modified mirror columns, original mirror revisions, and the 5222 publication link before-images.
- A mirror-only earlier checkpoint is also retained as `before-45c29960.json.gz` (SHA-256 `45c299606f007397be4d6a74ada7d359d938a63528c9cc9226fcc657271ad226`). Use the expanded backup above for the combined repair.

Protected container work directory: `/tmp/primemotive-us-reconciliation-20261105/`. It holds the approved US source, downloaded report, filtered live input, prepared backup, and JSON operation results. The durable host backup survives backend-container replacement.

## Transaction and verification

Operational helpers: `workspaces/primemotive-us-reconciliation-20261105/` (`prepare.py`, `probe-live.cjs`, `parse-live.cjs`, `apply-mirror.cjs`, `prepare-channels.cjs`). These helpers are not an application deployment.

- Temporary staging tables exist only within a transaction. No permanent schema changes or migrations are needed.
- Account/organization/store associations, source count/hash, unique IDs, live report coverage, variation absence, and SKU consistency are validated before writes.
- An advisory lock prevents concurrent copies of this repair. Existing rows are locked and their revisions checked against the before-image backup. Rows synced after the feed boundary are held rather than overwritten.
- Existing descriptions, images, fitment, catalog links, and record IDs are preserved. New mirror rows use the supplied US metadata and current availability. New rows do not invent missing images or catalog/physical-inventory links.
- Existing sold counters are not decreased; source cumulative counters are not replayed as orders. No order or warehouse stock write is part of this repair.
- Standard revision and listing-change triggers stay enabled. Changed eligible rows therefore enter the existing feed/outbox. The repair does not enable outbound callbacks or send a message to MotoArk.
- Full-account sync freshness is not advanced by the partial US reconciliation, and unknown mirror-only IDs are not pruned.
- A rollback trial performed all 71911 mirror updates and 18624 inserts and verified 90535 matching rows, zero quantity/status/SKU mismatches, and 62221 available units before rolling back.
- A separate publication-link rollback trial updated 5222 matching links and verified zero quantity/status mismatches before rolling back. The production transaction combines both operations and requires both checks to pass before commit.
- JavaScript syntax checks passed for all new operational scripts. No application build is required for these data-only operations. Backend health returned HTTP 200 during the transaction.

## Rollback approach

Rollback requires a separately reviewed production data operation. Restore only the columns captured in the expanded backup, checking that each target has not received a later legitimate revision/update. Preserve newer changes as conflicts. Planned insertion IDs are recorded; assess external references before undoing those additions. Do not blindly delete referenced records or roll back the existing lifecycle migrations. Retain change-feed revision monotonicity and let standard triggers emit corrective changes.

## Remaining work

- This repair reconciles the supplied US population as of the current report boundary; it is not proof that every US listing created after the source export has been discovered.
- The earlier comparison found 12347 positive active mirror IDs outside the supplied US source. Their marketplace ownership/current state must be reviewed separately; some internal US marketplace labels contain records from other source sites. They are not ended or counted as sales by this repair.
- Fix and production-verify the recurring sync completeness path before trusting future prune operations. Recent production sync logs each processed exactly 25000 items. Code can treat capped/fallback enumerations as complete; a data repair does not fix that behavior.
- Verify warehouse counts and explicit physical-stock mappings before enabling cross-channel stock pushes. The original 200-row PrimeMotive stock sample had no mappings. No opening balances are inferred from eBay availability.
- Verify the actual MotoArk sender uses the signed lifecycle API and consumes committed quantity revisions. Acknowledged legacy sale receipts alone do not update stock. Order ingestion, lifecycle recovery, and concurrent last-unit behavior remain separate gates.
- The first supplied server hosts PartsBazar360 and a RealTrack copy; inspection has not established that it hosts MotoArk checkout/sender code.

Background: [assessment and source statistics](../planning/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md), [MotoArk lifecycle](../architecture/MOTOARK_ORDER_LIFECYCLE.md), [warehouse stock architecture](../architecture/WAREHOUSE_INVENTORY.md).

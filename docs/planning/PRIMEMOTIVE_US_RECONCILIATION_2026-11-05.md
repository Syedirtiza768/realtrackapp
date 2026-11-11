# PrimeMotive US inventory reconciliation assessment

Assessment date: 2026-11-05. No production inventory data, marketplace quantities, policies, or services changed. A read-only eBay inventory report task was created to obtain current availability.

**Historical assessment statement above superseded by the approved production
execution on 2026-11-05:** Reconciliation committed at 06:43 UTC and passed
independent post-commit verification at 06:45 UTC. It updated 71911 mirror rows,
inserted 18624 missing mirror rows, and aligned 5222 existing US inventory
publication links. All 90535 source rows match current report quantities/statuses:
50935 active, 37940 out of stock, 1660 ended; 62221 advertised available units.
Both earlier transfer approval gates below were resolved by explicit user
approval. Physical warehouse stock was not initialized. The authenticated
reader API check subsequently passed: after historical credentials failed,
the user approved a password reset, committed at 08:20 UTC. Authenticated
active/out-of-stock/ended listing checks and the dedicated PrimeMotive feed
returned HTTP 200 with expected values at 08:22 UTC. The rotated credential is
protected on the server; roles/permissions were preserved and consumer
configuration/ingestion still needs its own verification. See the
[production execution record](../operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md)
for actual results and the verified before-image backup. The original assessment
and gate descriptions below are retained as history.

## Scope and supplied evidence

Use only rows whose `Listing site` is `US` from the three supplied Seller Hub CSVs in the user's Downloads directory. Currency alone is insufficient. These files include multiple listing sites despite being exported through US Seller Hub.

| Report suffix | All rows | US rows | US available units | US zero-quantity rows | US sold-counter sum | US duplicate SKU groups | US blank SKUs |
|---|---:|---:|---:|---:|---:|---:|---:|
| 12357579246 | 127211 | 38385 | 37519 | 1010 | 135 | 88 | 0 |
| 12357579011 | 279406 | 90535 | 63761 | 38066 | 157 | 30 | 0 |
| 12357581531 | 91520 | 25135 | 23417 | 2469 | 51 | 559 | 4 |

Combined US rows: 154055, all distinct item numbers. Excluded non-US rows: 344082. There are 52338 duplicate nonblank SKU groups across the US reports; cross-store SKU equality must not automatically merge physical inventory.

Production item lookup associated `306506868333` with BLACKLINEAUTOPARTS and `365872496203` with PrimeMotive. This identifies the likely report accounts by sample, not verified ownership of every row. The third report's US sample IDs still require ownership verification. One non-US sample item from that file occurs under multiple store associations in the mirror, reinforcing the need for explicit organization/account/store/site scope.

## Live observations

- First supplied host (`3.217.241.37`) runs PartsBazar360 plus a RealTrack copy. Its source has RealTrack bridge/publish modules. This inspection did not establish that it hosts the separate MotoArk checkout/sender implementation.
- Second host (`34.196.184.100`) runs the primary RealTrack deployment. SSH requires `ubuntu`; the supplied `root` login instructs callers to use that account.
- The active backend image is `realtrackapp-backend:ebay-oauth-return-20261104-r1`. MotoArk lifecycle runtime files and lifecycle database tables are present.
- PrimeMotive mirror rows use `EBAY_MOTORS_US`: 27986 active, 28101 out_of_stock, 98711 ended. These internal marketplace labels require verification against each report's explicit listing site; they are not sufficient proof of source-site ownership by themselves.
- A deterministic sample of 200 active PrimeMotive US/Motors mirror rows has zero active inventory-item matches by organization-scoped SKU or catalog link. This is a bounded sample, not a full-population mapping count.
- PrimeMotive `store_stock_policies.push_enabled` is false.
- The MotoArk inbox contains three rejected events and no other statuses at inspection time. Production order processing is therefore not demonstrated by this inbox.
- PrimeMotive has 248 imported eBay orders; latest order timestamp is 2026-11-04 08:12:45 UTC. Import presence does not prove stock deduction or complete lifecycle synchronization.

## Code findings and implications

- `backend/src/stock/stock-ledger.service.ts` and `reservations.service.ts` provide the existing common stock foundation. Extend and map this system rather than introduce another quantity owner.
- `backend/src/published-listings/services/published-listings.service.ts::recordPrimemotiveSaleEvent()` persists/deduplicates legacy sale receipts; it does not reserve or deduct stock.
- `backend/src/integrations/motoark/` implements a separate signed lifecycle with reservation, shipment, cancellation, physical returns, refunds, and quantity reads. It needs verified stock mappings and balances. A successful HTTP receipt does not establish an applied stock operation or acknowledged marketplace update.
- `backend/src/stock/channel-stock-sync.service.ts` computes desired advertised quantity from warehouse policy and optional supplier stock; both global and store push gates must permit writes. MotoArk must consume warehouse-derived availability and observe revisions, not treat the eBay listing mirror as physical stock.
- `backend/src/orders/order-import-ebay.service.ts` queries by order creation time and skips existing orders. Its path does not refresh existing orders' later shipment/cancellation facts. It advances the shared store sync timestamp even with import errors. Review durable ingestion, independent watermarks, retries, payment eligibility, and lifecycle updates before claiming complete eBay sales coverage.
- `backend/src/orders/orders.service.ts::importOrder()` saves the order and its lines before emitting an in-process allocation event. Crash recovery and concurrent ingestion need explicit verification; MotoArk's transactional inbox protections do not automatically cover this generic eBay path.

## Required reconciliation and operating rules

1. Validate each report/account association; filter source rows to US and scope matches by organization, seller account, store, item ID, and variation where applicable. Preserve original SKU text; flag duplicate SKU mappings instead of selecting an arbitrary match.
2. Compare the November 4 source snapshot to RealTrack as of a recorded time. Classify matched, missing, quantity mismatch, sold-counter mismatch, status mismatch, ambiguous mapping, and mirror-only records. Later legitimate changes must not be overwritten by the older report.
3. Show eBay advertised quantity/status, warehouse on-hand/reserved/damaged/sellable quantity, MotoArk availability, and sync state separately. Supplier sourceable stock needs explicit policy.
4. Use verified warehouse counts for physical opening balances. Do not seed physical stock from report availability. Do not subtract cumulative `Sold quantity` from already remaining availability. Active-listing exports cannot reconstruct a complete order ledger; obtain order/fulfillment/cancellation/return history with a declared cutover to avoid omissions and duplicate deductions.
5. A paid order reserves stock once; shipment consumes that reservation; unshipped cancellation releases it; refunds alone leave stock unchanged. Returned goods become sellable only after physical receipt and inspection.
6. Preserve original order/event identity and origin across both channels so echoed events cannot apply a sale twice. Durably accept signed events, apply stock atomically, retry failures, reject stale revisions, and expose pending/rejected/applied/channel-sync states.
7. For the last unit, concurrent sales must produce at most one successful stock allocation. Because channel updates are asynchronous, define MotoArk checkout reservation/payment failure behavior and oversell handling. Do not claim asynchronous synchronization alone prevents all overselling.
8. Test duplicates, partial operations, missed events, replay after outages, existing eBay order updates, stock shortages, sourceable-only products, missing mappings, concurrent last-unit sales, and stale snapshots. Start with a reviewed dry run before enabling marketplace pushes.

## Outstanding access gate

Automatic approval review rejected running `workspaces/primemotive-us-reconciliation-20261105/analyze.py` because it exports a full live PrimeMotive US listing mirror (internal identifiers, SKUs, quantities, statuses, sync timestamps) to the local workspace. The helper was created but was not executed; no full row-level comparison output exists. Obtain explicit approval for that data export before running it. Do not work around the rejection. The script's exception output includes the exported fields for mismatched records, so approval must cover local storage of those fields as well.

### User approval and completed comparison (2026-11-05 follow-up)

The user explicitly approved the mirror export and requested reconciliation on live production. `analyze.py` then completed successfully against the live PrimeMotive mirror. Artifacts are under `workspaces/primemotive-us-reconciliation-20261105/`:

- `summary.json`: aggregate reconciliation results.
- `exceptions.json`: 59251 report rows with one or more differences, including scoped mirror records.
- `source-us.json`: validated US-only input prepared locally; not uploaded to production.

Results for 90535 report rows:

| Outcome | Count |
|---|---:|
| Exact match on SKU, quantity available, sold counter, and availability status | 31284 |
| Unique item matched to the scoped mirror | 71911 |
| Missing from scoped mirror | 18624 |
| Available quantity differs | 13680 |
| Availability status differs | 40593 |
| Sold counter differs | 32 |
| SKU differs | 236 |
| Active positive mirror rows absent from source report | 12347 |

Difference categories overlap. Absence from the source report is not evidence of a sale, nor a safe basis to end a listing. Missing rows need seller verification before insertion. Scope is PrimeMotive's organization/account/store and US report IDs.

PrimeMotive has three exact-case duplicate SKU groups; the earlier count of 30 is case-insensitive grouping. Both are relevant diagnostics and must not be conflated. SHA-256 of the supplied PrimeMotive CSV: `a2ce33e1e550a756b3a42f0f4faef26c5135f544eebd2f296e15bb081a310a70`. US input has 90535 unique item IDs, all USD, nonnegative integer quantities, and no variation-detail rows. Prepared JSON size: 29091678 bytes.

The most recent mirror sync timestamps are 2026-11-01 or earlier. Recent sync logs (October 11, 18, 25, November 1) each processed exactly 25000 items. This is strong evidence of a truncated or incomplete synchronization path, requiring correction before trusting prune operations. Inspection also found that `getAllLiveListings()` can fall back to capped ActiveList results and the caller then treats success as a complete set. Browse sync similarly explicitly allows pruning after a capped search. The exact runtime failure path must be verified before attributing every mismatch to this defect.

Direct authenticated Trading GetItem reads verified seller `primemotive`, site `US`, and active state for `365872496203` (quantity 0/sold 0) and `365879436193` (quantity 1/sold 0). Credentials stayed on the production server. Current report task `task-20-30225128423426` is `COMPLETED`, created 2026-11-05T06:19:31.685Z and completed 2026-11-05T06:20:28.575Z. It has not yet been downloaded or used to mutate production. See eBay's [report download flow](https://developer.ebay.com/api-docs/sell/static/feed/merchant-data-downloadable-reports-flow.html) and [active inventory report fields](https://developer.ebay.com/DevZone/merchant-data/CallRef/ActiveInventoryReport.html).

### Current blocking approval

Automatic approval review separately rejected `prepare.py --upload`: it requires explicit permission to transfer and persist the 90535 source rows (item IDs, titles, SKUs, prices, and quantities) in a protected temporary production directory. It did not accept the user's general production reconciliation approval as authorization for that exact transfer. A question requesting this permission is pending in chat. The non-upload preparation ran successfully. Do not bypass this rejection through another transfer mechanism.

### Concrete production execution plan after access is granted

1. Stage the validated US-only source in `/tmp/primemotive-us-reconciliation-20261105/` with restricted permissions; verify source hash, count, unique IDs, and the exact organization/account/store scope.
2. Retrieve the completed eBay report and intersect its item IDs with the approved US source. Use current available quantities; preserve variation distinctions and surface any missing or ambiguous live result. Verify representative missing/mismatched IDs against seller/site. A report lacking site metadata cannot authorize adding unknown, newly discovered non-US items.
3. Prepare and inspect exact proposed inserts/updates. Preserve existing images, descriptions, fitment, and catalog links. Do not alter physical stock, manufacture orders, enable stock pushes, or touch other seller accounts/marketplaces. Preserve newer changes using a recorded report boundary and concurrent-update checks.
4. Save a protected before-image backup and source manifest on the server. Run the scoped transaction as a rollback dry run first, checking row counts, constraints, feed effects, and idempotency. No permanent schema changes are planned.
5. Apply the validated transaction under the user's production reconciliation authorization, keeping standard listing revision/change-feed triggers active. Do not advance the full-account live sync watermark for a partial US import or prune unknown mirror-only IDs.
6. Verify the US mirror against the current report, query application visibility, record actual changed/held counts, confirm stock movements and other store data were unaffected, and document rollback instructions and remaining stock mapping/warehouse-count requirements.

The supplied reports, live comparison, and read-only API checks support this assessment. They do not establish a completed production reconciliation, verified physical stock, a live MotoArk sender, or successful cross-channel stock propagation.

Related contracts: [warehouse inventory](../architecture/WAREHOUSE_INVENTORY.md), [MotoArk lifecycle](../architecture/MOTOARK_ORDER_LIFECYCLE.md), [production release record](../operations/MOTOARK_RELEASE_2026-11-02.md).

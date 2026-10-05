# Warehouse inventory (StockModule)

**Status:** Implemented 2026-10-05; not deployed. **Code:** `backend/src/stock/`, `src/components/stock/`, `src/lib/stockApi.ts`.
**Migration:** `backend/src/migrations/1791100000000-CreateWarehouseInventory.ts` (additive only).
**Plan and history:** [../planning/INVENTORY_AND_WAREHOUSE_PLAN.md](../planning/INVENTORY_AND_WAREHOUSE_PLAN.md).

One stock system shared by Auto Parts, Fashion and Business & Industrial. It tracks what
is physically on hand, in which warehouse and bin. It also tracks what is reserved for
orders, and what must be **acquired from a supplier** because it is not on hand.

## 1. Model

```
Organization
 ├─ warehouses ── warehouse_locations (bins)
 ├─ suppliers
 ├─ inventory_items (SKU master: org + sku, links to catalog_products / listing_records / product_variants)
 │    ├─ inventory_item_sources   supplier offers: cost, available qty, lead time, ship-to-us | dropship
 │    ├─ stock_levels             projection per item × warehouse × bin: on_hand, reserved, damaged, inbound, available*
 │    ├─ inventory_units          one row per physical piece for serial / one-off items
 │    └─ stock_movements          APPEND-ONLY ledger (trigger rejects UPDATE/DELETE)
 ├─ stock_documents + lines       receipt | transfer | adjustment | count | purchase_order
 ├─ stock_reservations            stock held for an order line in a specific warehouse/bin
 ├─ procurement_requests          stock to acquire (order shortfall, reorder, manual)
 ├─ store_warehouse_links         which warehouses feed which sales-channel store (+priority)
 ├─ store_stock_policies          per store: push on/off (default OFF), buffer, max, sourced-qty cap
 ├─ channel_stock_sync_state      per store × item: desired vs pushed vs channel quantity (transactional outbox)
 └─ user_warehouse_assignments    optional per-user warehouse restriction
order_items.inventory_item_id, order_items.stock_status   (new columns)
* available = on_hand − reserved − damaged (generated column)
```

### Tracking and sourcing modes (per SKU)

| `tracking_mode` | Meaning |
|---|---|
| `quantity` | Counted only (aftermarket multi-qty parts). |
| `one_off` | Each piece is a unit row without a serial (used donor parts, pre-owned garments). `lot_code` holds the donor VIN / batch. |
| `serial` | Each piece has a serial. B&I serialized units are imported as these. Private serials need `stock.serials.private`. |

| `sourcing_mode` | Meaning |
|---|---|
| `stocked` | Sell only from on-hand stock. A shortfall is backordered unless an active supplier offer exists, in which case a procurement request is raised. |
| `hybrid` | Use on-hand stock first, then buy the rest from a supplier. Supplier quantity is advertised on channels (capped). |
| `on_demand` | Never held. Every sale raises a procurement request. Channel quantity is supplier availability (capped). |

## 2. The single write path — `StockLedgerService.apply()`

Every stock change goes through `apply(ctx, commands, em?)`, which works as follows:
- It inserts any missing `stock_levels` rows (`UNIQUE NULLS NOT DISTINCT (item, warehouse, location)`, so this needs PG ≥ 15).
- It then locks those rows with `SELECT … FOR UPDATE` in sorted (item|warehouse|location) order. The fixed order prevents deadlocks.
- It applies deltas and enforces `on_hand, reserved, damaged, inbound ≥ 0` and `reserved + damaged ≤ on_hand`. A violation throws `InsufficientStockException`, which returns 409 with `code: INSUFFICIENT_STOCK`.
- It appends `stock_movements`. With `operationKey` it is idempotent: replays return the original rows, and concurrent duplicates hit `uq_sm_idempotency` and resolve to the winner.
- It updates `inventory_units` (`unitPatch`) for unit-tracked commands.
- It marks `channel_stock_sync_state` dirty for every store linked to the org's warehouses, **in the same transaction** (outbox).
- It projects sellable on-hand availability onto legacy `catalog_products.quantity`, `listing_records.quantity/quantityNum` and `product_variants.quantity` for `stocked` items. Existing publish flows therefore read a correct number. on_demand/hybrid legacy quantities are left alone.
- It emits `stock.changed` after commit when it owns the transaction. Callers passing `em` call `emitChanged()` themselves.

Isolation is READ COMMITTED plus row locks, not SERIALIZABLE. This was verified with 12 concurrent reservations for the last unit: exactly one wins (`stock-ledger.service.int.spec.ts`).

## 3. Orders, reservations and procurement

`OrderStockService` listens to:

| Event (emitter) | Action |
|---|---|
| `order.new` (`OrdersService.importOrder`, new orders only) | Match each line to an item. The order is: `order_items.inventory_item_id`, then `listing_id` (listing or catalog id), then `sku`. Then reserve stock. **Shortfall**: if the item can be sourced (`sourcing_mode ≠ stocked` or it has an active supplier offer), a `procurement_request` is created and the line becomes `awaiting_procurement`. Otherwise the line becomes `backorder`. Unmatched lines become `unmatched`. Notifications are raised for all three. |
| `order.cancelled` (`OrdersService.transitionStatus`) | Release reservations. `open` requests are cancelled. **`ordered`** requests are detached from the order (reason → `reorder`) so the goods still arrive as stock. Backorders for the same items are then retried. |
| `order.shipped` (`updateShipping` / `transitionStatus` / fulfilment) | `ship` movements: on_hand −q, reserved −q, unit → shipped. Idempotent per reservation (the event can fire twice). Dropshipped requests → `fulfilled`. Shipping while a ship-to-warehouse request is still pending raises a warning notification. |
| `stock.received` (receipts, transfer/PO receipt, positive adjustments) | `allocateBackorders`: retry `backorder`/`awaiting_procurement` lines, oldest order first. Open requests that are not yet ordered and that on-hand stock can now cover are cancelled. |

**Allocation order:** warehouses linked to the selling store by `priority`. If the store has no links, every sellable warehouse is used, with the default first. A warehouse that can fill the whole line is preferred. Within a warehouse, pickable storage bins with the most available stock come first.

**Procurement lifecycle:**
- `ship_to_warehouse` path:
  1. A request starts as `open`. Supplier/source is chosen by: in-stock at supplier, then priority, then cost.
  2. Requests are grouped into a draft PO per supplier (`purchase-orders/from-requests`).
  3. **Mark ordered**: inbound += qty at the receiving warehouse.
  4. **Receive** into a bin: on_hand += q, inbound −= q, and the received units are **reserved for the waiting order lines** (oldest request first). This is receive-to-order. The line becomes `reserved`.
- `dropship` path: the supplier ships straight to the buyer. **Mark dropshipped** records the tracking and a zero-quantity `dropship` movement for audit; the line becomes `dropshipped`. Shipping the order then marks the request `fulfilled`.
- Closing a PO early reverses the outstanding inbound quantity and reopens unfilled requests.

`order_items.stock_status` values: `unmatched | reserved | picked | awaiting_procurement | backorder | dropshipped | shipped | released`. They are recomputed by `refreshLineStatus()`.

## 4. Channel quantity (shadow mode first)

```
desired(store, item) = max(0, Σ available in active sellable warehouses linked to the store − buffer_qty)
                     + sourceable                      (only if include_sourceable and sourcing_mode ≠ stocked)
sourceable           = clamp(Σ active supplier available_qty − open unordered request qty, 0, max_sourceable_qty)
desired              = min(desired, max_qty)           (if set);  0 for non-active items
```

- `ChannelStockSyncService.sweep()` claims dirty rows with `FOR UPDATE SKIP LOCKED`. Failed rows back off 2/4/6/8 minutes, for up to 5 attempts. The sweep then:
  - computes `desired`;
  - finds targets: `ebay_published_listings` (active/out_of_stock, matched by SKU or catalog product) and PartsBazar360 `listing_channel_instances`;
  - either pushes the absolute quantity or records `shadow`.
- **Push happens only when** the global flag `stock_channel_push` is on **and** the store policy has `push_enabled`. Both default OFF. In shadow mode the UI shows "stock says X, channel shows Y" for every SKU × store.
- How quantity is pushed to each channel:
  - **eBay Inventory API offers:** `bulkUpdatePriceQuantity`, 25 per call.
  - **eBay Trading listings** (item-ID tracked): `ReviseFixedPriceItem` with Quantity. Out-of-stock control must be enabled on the eBay account for quantity 0 to keep the listing alive.
  - **PartsBazar360:** `publish(..., {quantity})`, or `end()` at 0. The service is resolved lazily through `ModuleRef`, so StockModule also builds where that integration is absent; a push to a PartsBazar360 store then fails with a clear error. The Trading-API revise is guarded the same way.
- Triggers:
  - `stock.changed` enqueues a debounced (3 s, per-org jobId) sweep on queue `stock-channel-sync`, with concurrency 1.
  - A leader-elected cron runs every 2 minutes as a safety net.
  - A nightly drift check (02:30) refreshes `channel_qty` from the eBay snapshot and re-queues mismatches.

## 5. Vertical hooks (event-based; ignored until the org has a default warehouse)

| Vertical | Event | Effect |
|---|---|---|
| Auto Parts warehouse intake (`POST /api/pipeline/single-listing/add-part`) | `stock.intake.received` from `PipelineController` | Item found or created by SKU (linked to listing + catalog product). Quantity received into the default warehouse. The intake `location` text is used as the bin code if a bin with that code exists. Idempotency key `auto-parts-intake:<listingId>`. |
| Fashion quick capture (`FashionIntakeService.create`; ships with the Fashion quick-capture feature, which is not committed as of 2026-10-05) | `stock.intake.received` | Received into the chosen Fashion warehouse code as `one_off` (qty 1). Batch is the lot code. |
| Fashion warehouse create/update (same feature) | `stock.fashion-warehouse.saved` | Upserted into `warehouses` (same code). The default warehouse is never deactivated. |
| B&I serialized units saved | `stock.bi-units.saved` | Units imported as `serial` `inventory_units` (`source_ref = bi_unit:<id>`), received into the default warehouse. B&I unit statuses (`allocated` to an offer) are a listing concept and are not mirrored. Sales deduct through orders. |

## 6. Setup / backfill (`POST /api/stock/setup/bootstrap`)

This is re-runnable and idempotent. Run it with `dryRun: true` first, which rolls everything back and returns the report. It does the following:
1. Fashion warehouses → `warehouses` (skipped when the `fashion_warehouses` table does not exist). Then it ensures a default warehouse (named by the request, or the first active one). The eBay `location_key` of the org's primary store is copied onto it.
2. SKU master from `catalog_products` (org-scoped; optionally unscoped automotive rows), `listing_records` (newest per SKU; duplicates reported) and `product_variants`.
3. B&I serialized units → `inventory_units`.
4. Opening balances from current product quantity (`opening:<itemId>` operation keys). Items that already have stock rows are skipped.
5. Every store is linked to the default warehouse, with a policy in shadow mode, and marked dirty for computation.

## 7. API (`/api/stock`, all accept `?organizationId=`)

The prefix is deliberately not `/api/inventory`, which is the Auto Parts enrichment workbench. See [API_CONTRACTS.md](API_CONTRACTS.md#warehouse-stock-apistock) for the route list.

## 8. RBAC

| Permission | Default roles |
|---|---|
| `stock.view` | all operational/read roles + all Fashion + all B&I roles |
| `stock.receive`, `stock.move`, `stock.count`, `stock.fulfil` | read-write roles + all Fashion + all B&I roles |
| `stock.adjust`, `stock.adjust.approve`, `stock.procure`, `stock.valuation.view`, `stock.serials.private` | manager+ (incl. Fashion/B&I managers) |
| `stock.warehouses.manage`, `stock.channel_sync.manage` | admin+ (incl. Fashion/B&I admins) |

- Adjustments and count variances larger than `STOCK_ADJUST_APPROVAL_QTY` (default 10 units) by a user without `stock.adjust.approve` are parked as `pending_approval` documents.
- Counts are blind: system quantities are hidden from users without approve permission until the count is submitted.
- Warehouse scoping: a user with no `user_warehouse_assignments` rows sees all warehouses; any rows restrict them to those warehouses. This is deliberately not "no rows = no access" (see the 2026-09-15 B&I `AND 1 = 0` incident).

## 9. UI

`StockWorkspace` (`src/components/stock/`) is mounted at `/auto-parts/stock`, `/fashion/stock` and `/business-industrial/stock`. Its tabs are in `?tab=`:
- Overview (KPIs, needs-attention list, channel summary, aging, valuation)
- Stock (table/cards, filters, scan box, item drawer with receive/adjust/move/damage, supplier offers, settings, reservations, channels, units, history)
- Orders & picking (pick list by warehouse/bin, exceptions with link-to-SKU / source-it / retry)
- Procurement (to acquire, purchase orders with receive, suppliers, reorder)
- Transfers & counts
- Warehouses & channels (warehouses, bins with grid generator and printable labels, store links/policies, quantity check)
- Ledger (filters + CSV export)

A first-run setup panel replaces the tabs until the workspace is initialised. The Orders page shows each line's stock status.

## 10. Tests

| Spec | What |
|---|---|
| `stock/stock-ledger.service.int.spec.ts` | Receipts + legacy projection, invariants, idempotency under concurrent replay, last-unit race, Σ movements = projection (random walk), outbox, cross-org rejection, append-only trigger |
| `stock/order-stock.flow.int.spec.ts` | Partial stock + PO receive-to-order + ship idempotency, backorder auto-fill, dropship of on-demand items, cancel after purchase, one-off units through pick/ship, in-transit transfer, count approval, channel shadow vs push vs failure/retry |
| `stock/stock-setup.int.spec.ts` | Dry run, bootstrap counts, SKU merge across catalog/listing, B&I units incl. quarantined, idempotent re-run |
| `stock/testing/migration-roundtrip.int.spec.ts` | up → up → down → up against a restored real schema (`STOCK_SCHEMA_DATABASE_URL`) |

To run the tests you need a disposable Postgres ≥ 15:

```bash
docker run -d --name omnicore-stock-it -e POSTGRES_PASSWORD=stockit -e POSTGRES_DB=stockit -p 127.0.0.1:47432:5432 postgres:16-alpine
```

```bash
STOCK_IT_DATABASE_URL=postgres://postgres:stockit@127.0.0.1:47432/stockit npx jest src/stock
```

Without the env var these specs are skipped.

## 11. Not done yet / follow-ups

- FIFO costing (weighted average only); landed cost; multi-currency PO valuation.
- eBay multi-location `availabilityDistributions` (totals are pushed); handling-time sync for sourced items.
- Supplier availability feeds (supplier `available_qty` is entered manually or via API today).
- Shopify/Amazon/Walmart quantity adapters.
- Returns workflow beyond manual receive into a `returns` bin.
- Dropping the legacy tables `inventory_ledger`, `inventory_events`, `inventory_movements` and `store_inventory_allocations`. They are no longer written by new code. `/api/inventory/:id/adjust` still writes the old ledger.

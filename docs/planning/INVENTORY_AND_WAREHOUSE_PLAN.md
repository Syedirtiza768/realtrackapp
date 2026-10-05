# Inventory & Warehouse Management — Analysis and Development Plan

**Status:** Implemented 2026-10-05 (phases 0–5 core; not deployed). The authoritative design of what was built is
[../architecture/WAREHOUSE_INVENTORY.md](../architecture/WAREHOUSE_INVENTORY.md). This plan is kept as history.
**Written:** 2026-10-01 · **Branch analysed:** `codex/auto-parts-image-save`

> **Deviations made during implementation (2026-10-05):**
> - **Selling stock that is not on hand (added at the user's request).** Each SKU has a `sourcing_mode`: `stocked`, `hybrid` or `on_demand`. Supplier offers (`suppliers`, `inventory_item_sources`) were added, together with `procurement_requests`.
>   - Order shortfalls raise requests instead of failing.
>   - Purchase orders are a `stock_documents` type; when they are received, the goods are reserved for the waiting orders.
>   - Dropship is a fulfilment mode of a supplier offer or request, not a warehouse type, so the `dropship` warehouse type was dropped.
> - **Documents.** One generic `stock_documents` + `stock_document_lines` pair replaces the separate receipt/transfer/adjustment/count tables proposed in §4.7.
> - **Outbox.** `channel_stock_sync_state` (keyed by store × item, with a `dirty` flag) plays the role of `channel_stock_sync_outbox`. `channel_stock_policies` became the per-store `store_stock_policies`; there are no per-item overrides yet.
> - **Permissions.** Vertical-prefixed permission aliases were not created. The `stock.*` keys are granted directly to the Fashion and B&I roles instead.
> - **API prefix.** The prefix is `/api/stock` as planned. The Auto Parts nav item "Inventory" is unchanged and "Stock" was added beside it.
> - **Order matching.** Order lines are matched to SKUs by listing/catalog ID or SKU. Matching by eBay item ID is not implemented, because order lines carry `lineItemId` rather than the item ID.
**Scope:** All verticals — Auto Parts (`/auto-parts`), Fashion (`/fashion`), Business & Industrial (`/business-industrial`) — and all sales channels (eBay multi-store, partsbazar360.com, future Shopify/Amazon/Walmart adapters).

---

## 1. Executive summary

Omni Core today is a **listing** system that also stores some quantities. Its inventory features
were started but never connected to the rest of the system:

* Quantity is stored in **ten separate places**, and none of them is authoritative.
* The real ledger (`inventory_ledger` + `inventory_events`) is **only written by the manual
  "adjust" endpoint**. Import, intake, publish and orders never touch it.
* Imported orders emit `order.new`, but the handler enqueues a reconcile with `listingIds: []`,
  so **no stock is ever deducted on a sale**. Stock shared between eBay stores and partsbazar360
  can therefore be oversold.
* "Warehouse" exists in three unrelated forms: `fashion_warehouses` (Fashion only, saved as a
  JSON attribute on the product), `master_products.warehouse_location` (free text), and eBay
  `merchantLocationKey` on `stores.location_key` (a ship-from address, not stock).

The plan adds a **single, vertical-neutral inventory core**. It has four parts: SKU master →
warehouse/bin → stock level → append-only movement ledger. Receiving, transfers, counts,
reservations and fulfilment all run on that core. **Channel quantities are derived from it and
pushed out**; they are no longer edited by hand. Each vertical keeps its own intake UX and plugs
in through a small adapter. Delivery is in 6 phases behind an org-level feature flag, and nothing
is pushed to live channels until a reconciliation report has been reviewed.

---

## 2. Current-state analysis

### 2.1 Where quantity lives today

| # | Table.column | Keyed by | Written by | Read by | Notes |
|---|---|---|---|---|---|
| 1 | `listing_records.quantity` (text) + `quantity_num` | listing | imports, pipeline, warehouse intake, editor | eBay publish (`ebay-publish.service.ts` ~L849), PB360 mapper | Auto Parts' de-facto source |
| 2 | `catalog_products.quantity` (int, nullable) | catalog product | catalog import, Fashion/B&I editors | catalog publish, CatalogWorkspace "stock" facet | Fashion/B&I de-facto source |
| 3 | `product_variants.quantity` | variant | Fashion variant editor | `ebay-variant-publishing.service.ts` | Fashion size/colour |
| 4 | `master_products.total_quantity` + `warehouse_location` | master product | legacy | little | Free-text location |
| 5 | `inventory_ledger.quantity_total/reserved` | listing (no `organization_id`) | **only** `POST /inventory/:id/adjust` | dashboard, low-stock cron | Effectively empty in prod |
| 6 | `inventory_events` | listing | ledger service | reconcile | Has idempotency key ✔ |
| 7 | `inventory_movements` | catalog product + org | **nothing** (entity registered only) | nothing | Duplicate concept of #6 |
| 8 | `store_inventory_allocations` | listing × store | allocate endpoint (flag `per_store_inventory`) | nothing in publish | Unused |
| 9 | `ebay_offers.quantity`, `ebay_listing_channels.channel_quantity`, `listing_store_overrides.quantity_override`, `listing_channel_instances.override_quantity` | channel | publish/overrides | publish | Per-channel copies |
| 10 | `ebay_published_listings.quantity_available/quantity_sold` | eBay item | eBay sync | Published Listings page | Snapshot of what eBay shows |
| — | `business_industrial_units` (status available/allocated/sold/quarantined) | physical unit | B&I units API | B&I publish | Only real per-unit tracking; no location |

### 2.2 Event and flow gaps (confirmed in code)

* `orders/order-import-ebay.service.ts` emits `order.new` →
  `channels/inventory-realtime-sync.service.ts#handleOrderCreated` enqueues `reconcile` with
  `listingIds: []` → `inventory-sync.processor.ts#handleReconcile` loops over an empty list.
  The **webhook path behaves the same way**. Nothing is deducted.
* `InventoryService.reconcile` only compares the ledger against its own event sum. It never
  checks a channel or a physical count.
* `order-fulfillment.service.ts#markShipped` pushes tracking to eBay and emits `order.shipped`,
  but there is no inventory listener.
* `OrderItem` has `listing_id` + `sku`, but nothing links it to a catalog product, a variant or a
  serialized unit.
* The `inventory-low-stock-check` cron (`common/scheduler/scheduler.service.ts`, every 4h) runs
  against an empty ledger.
* Concurrency: ledger operations use `SERIALIZABLE` transactions and a `@VersionColumn`. That is
  correct but will retry heavily under bulk load (see §6.4).

### 2.3 Per-vertical reality

| | Auto Parts | Fashion | Business & Industrial |
|---|---|---|---|
| Primary record | `listing_records` (pipeline/workbench) → `catalog_products` | `catalog_products` + `product_families/variants` | `catalog_products` + `business_industrial_units` |
| Typical qty | Mostly **1** (used donor parts); some multi-qty aftermarket (FEBEST etc.) | Mostly **1** (pre-owned); variants for new stock | 1–N; **serialized** units with private serials |
| Physical intake today | Pipeline "warehouse intake" (`add-intake-part`, `warehouse_intake_row_seq`) | `/fashion/capture` quick capture with warehouse picker (`PAK_KHI`, `UK_LU7`) | Image intake jobs; eBay location `AE_Dubai` |
| Location concept | None (donor vehicle only) | `_warehouseCode` in `vertical_attributes` JSON | Store-level eBay location only |
| Channels | eBay (multi-store), partsbazar360 | eBay | eBay (dedicated store) |
| Oversell risk | **High**: same part on multiple stores + PB360 | Medium: cross-border stores | Medium: units over-allocated across offers |

### 2.4 Naming collision

In Auto Parts, `/auto-parts/inventory` (`InventoryManager`, `inventory-workbench.service.ts` at
2,910 lines) is actually a **listing enrichment workbench**, not stock management. Leave it
where it is. Add the new module under **"Stock"** / `…/stock`. The nav label can be renamed to
"Parts Workbench" in a later, separate change.

### 2.5 Reusable building blocks

* BullMQ + `SchedulerLeaderService` (single-leader crons), the `inventory` queue.
* The idempotency-key pattern on `inventory_events`.
* `EbayInventoryApiService.bulkUpdatePriceQuantity` (already used by published-listings actions).
* eBay merchant-location utilities (`ebay-inventory-location.util.ts`).
* The CatalogWorkspace pattern: one shared component mounted in each vertical shell with a
  vertical config. The inventory UI should follow the same pattern.
* RBAC registry (`inventory.view/adjust/allocate/reconcile` exist), `user_store_assignments`
  scoping, and the feature-flag service.

---

## 3. Target domain model

```
Organization
 ├─ Warehouse (code, type, address, country, ships_to, eBay location key)
 │    └─ WarehouseLocation / Bin (zone-aisle-rack-shelf-bin, barcode, pickable?)
 ├─ InventoryItem  (= SKU master; org+sku unique; links to catalog_product / listing_record / variant)
 │    ├─ StockLevel (item × warehouse × bin): on_hand, reserved, inbound, damaged → available
 │    ├─ InventoryUnit (optional serialized/one-off unit: serial, condition, bin, status, lot)
 │    └─ StockMovement (append-only ledger; every change; idempotent)
 ├─ Documents: Receipt (GRN), Transfer, Adjustment, CycleCount, Reservation, Shipment(pick/pack)
 └─ ChannelStockPolicy (store ↔ warehouses, priority, buffer, max qty) → ChannelStockSync outbox
```

**Golden rule:** `stock_movements` is the source of truth. `stock_levels` is a cached projection,
updated in the same transaction. Channel quantity is a *computed output*, never an input. The one
exception is an explicit "import from channel" during opening balance.

### 3.1 Why a separate `inventory_items` (SKU master)

The three verticals anchor products on different tables (`listing_records`, `catalog_products`,
`product_variants`). The SKU master gives stock one stable key, `(organization_id, sku)`, plus
nullable links to whichever product record applies. This lets stock exist before a listing exists
(receiving first), survive listing deletion or re-creation, and be shared by many channel
listings.

---

## 4. Database design (new migrations)

Naming follows the existing `17xxxxxxxxxxx-Name.ts` convention. **Never** use `DB_SYNCHRONIZE`.

```sql
-- 4.1 Warehouses (generalises fashion_warehouses)
CREATE TABLE warehouses (
  id uuid PK, organization_id uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  code varchar(40) NOT NULL, name varchar(120) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'owned',      -- owned | 3pl | dropship | virtual(returns/quarantine)
  address jsonb, country_code char(2), timezone varchar(60),
  ebay_merchant_location_key varchar(36),           -- maps to eBay inventory location
  is_default boolean DEFAULT false, is_sellable boolean DEFAULT true,
  active boolean DEFAULT true, created_at, updated_at,
  UNIQUE (organization_id, code)
);

-- 4.2 Bins
CREATE TABLE warehouse_locations (
  id uuid PK, warehouse_id uuid NOT NULL REFERENCES warehouses ON DELETE CASCADE,
  code varchar(60) NOT NULL,            -- e.g. A-03-2-B
  zone varchar(40), aisle varchar(20), rack varchar(20), shelf varchar(20), bin varchar(20),
  barcode varchar(80), type varchar(20) DEFAULT 'storage',  -- storage|receiving|staging|returns|quarantine
  is_pickable boolean DEFAULT true, capacity_units int, active boolean DEFAULT true,
  UNIQUE (warehouse_id, code)
);

-- 4.3 SKU master
CREATE TABLE inventory_items (
  id uuid PK, organization_id uuid NOT NULL, vertical varchar(32) NOT NULL,
  sku varchar(160) NOT NULL,
  catalog_product_id uuid NULL REFERENCES catalog_products ON DELETE SET NULL,
  listing_record_id uuid NULL REFERENCES listing_records ON DELETE SET NULL,
  product_variant_id uuid NULL REFERENCES product_variants ON DELETE SET NULL,
  tracking_mode varchar(12) NOT NULL DEFAULT 'quantity',   -- quantity | serial | one_off
  unit_cost numeric(12,4), cost_method varchar(10) DEFAULT 'avg', -- avg | fifo (phase 6)
  weight, dimensions jsonb, barcode varchar(80),
  low_stock_threshold int DEFAULT 1, reorder_point int DEFAULT 0, reorder_qty int DEFAULT 0,
  status varchar(16) DEFAULT 'active',  -- active | discontinued | archived
  UNIQUE (organization_id, sku)
);

-- 4.4 Stock projection
CREATE TABLE stock_levels (
  id uuid PK, organization_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses,
  location_id uuid NULL REFERENCES warehouse_locations,
  on_hand int NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved int NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  damaged int NOT NULL DEFAULT 0, inbound int NOT NULL DEFAULT 0,
  available int GENERATED ALWAYS AS (on_hand - reserved - damaged) STORED,
  version int NOT NULL DEFAULT 1, updated_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (inventory_item_id, warehouse_id, location_id),   -- PG15+; else COALESCE index
  CHECK (reserved + damaged <= on_hand)
);

-- 4.5 Serialized / one-off units (generalises business_industrial_units)
CREATE TABLE inventory_units (
  id uuid PK, organization_id uuid NOT NULL, inventory_item_id uuid NOT NULL,
  warehouse_id uuid, location_id uuid,
  serial_private text, serial_public text, lot_code varchar(80),   -- lot = donor VIN for auto parts
  condition_id varchar(40), status varchar(16) NOT NULL DEFAULT 'available',
     -- receiving|available|reserved|picked|shipped|returned|quarantined|written_off
  reservation_id uuid, unit_cost numeric(12,4), received_at timestamptz,
  UNIQUE (organization_id, serial_private)
);

-- 4.6 Append-only ledger (replaces inventory_events + inventory_movements)
CREATE TABLE stock_movements (
  id uuid PK, organization_id uuid NOT NULL, inventory_item_id uuid NOT NULL,
  warehouse_id uuid NOT NULL, location_id uuid, unit_id uuid,
  movement_type varchar(30) NOT NULL,
     -- opening_balance|receipt|putaway|transfer_out|transfer_in|adjustment|count_variance|
     -- reserve|release|pick|ship|return_receipt|damage|write_off|channel_correction
  qty_delta_on_hand int NOT NULL DEFAULT 0, qty_delta_reserved int NOT NULL DEFAULT 0,
  on_hand_after int, reserved_after int,
  unit_cost numeric(12,4), reason_code varchar(40), note text,
  document_type varchar(20), document_id uuid,   -- receipt|transfer|adjustment|count|order
  source_channel varchar(30), store_id uuid, order_id uuid, order_item_id uuid,
  idempotency_key varchar(200) UNIQUE, actor_user_id uuid, created_at timestamptz DEFAULT now()
);
CREATE INDEX ON stock_movements (organization_id, inventory_item_id, created_at DESC);
-- Make it append-only: REVOKE UPDATE, DELETE for the app role, or use a trigger that raises.

-- 4.7 Documents
inventory_receipts (+ inventory_receipt_lines)   -- GRN: supplier/donor vehicle/intake batch, expected vs received
inventory_transfers (+ lines)                    -- draft → picked → in_transit → received (inbound counted)
inventory_adjustments (+ lines, reason_code)     -- approval required above threshold
cycle_counts (+ cycle_count_lines)               -- blind count; variance → count_variance movement
stock_reservations                               -- (order_item_id, item, warehouse, unit, qty, status, expires_at)

-- 4.8 Channel stock policy
store_warehouse_links (store_id, warehouse_id, priority int, active)    -- which warehouses feed which store
channel_stock_policies (store_id, inventory_item_id NULL = default,
   buffer_qty int DEFAULT 0, max_qty int NULL, pct_of_available int NULL, paused bool)
channel_stock_sync_outbox (id, store_id, inventory_item_id, target_qty, status, attempts,
   last_error, pushed_qty, pushed_at)  -- unique pending row per (store,item) → natural debounce

-- 4.9 Access
user_warehouse_assignments (user_id, warehouse_id)   -- mirrors user_store_assignments
```

**Order linkage:** add `order_items.inventory_item_id`, `order_items.reservation_id`, and
`orders.fulfillment_warehouse_id`.

**Deprecations** (mark them in docs; drop only after Phase 6): `inventory_ledger`,
`inventory_events`, `inventory_movements`, `store_inventory_allocations`,
`master_products.warehouse_location`, and `fashion_warehouses` (migrated into `warehouses`, then
replaced with a compatibility view).

---

## 5. Backend architecture

New Nest module **`backend/src/warehouse-inventory/`**. It sits alongside the legacy
`inventory/`, which stays as the Auto Parts workbench.

```
warehouse-inventory/
  entities/…                       (§4)
  stock-ledger.service.ts          ← the ONLY writer of stock_levels/stock_movements
  warehouses.service.ts / .controller.ts
  locations.service.ts             (bins, barcode labels)
  inventory-items.service.ts       (SKU master, link/resolve sku → item)
  receiving.service.ts             (GRN, put-away)
  transfers.service.ts
  adjustments.service.ts           (reason codes, approval thresholds)
  cycle-counts.service.ts
  reservations.service.ts          (allocation strategy, expiry)
  fulfillment-bridge.service.ts    (listens to order.* events)
  channel-availability.service.ts  (computes sellable qty per store)
  channel-stock-sync.processor.ts  (BullMQ queue `inventory-channel-sync`)
  reconciliation.service.ts        (ledger vs projection vs channel vs counts)
  adapters/
    vertical-inventory.adapter.ts  (interface)
    auto-parts.adapter.ts / fashion.adapter.ts / business-industrial.adapter.ts
  reports.service.ts               (valuation, aging, movement, sell-through)
```

### 5.1 `StockLedgerService` contract (single write path)

```ts
applyMovements(cmds: MovementCommand[], ctx: { orgId; actorId; idempotencyKey; document? }): Promise<StockMovement[]>
```

* Opens one transaction and locks the affected `stock_levels` rows with
  `SELECT … FOR UPDATE`, **ordered by (item_id, warehouse_id, location_id)** to avoid deadlocks.
  Missing rows are created first with `INSERT … ON CONFLICT DO NOTHING`.
* It validates invariants (no negative on-hand; reserved ≤ on-hand). It then writes the movement
  rows and updates the projection. Finally it writes `channel_stock_sync_outbox` rows **in the
  same transaction** (transactional outbox). An enqueue cannot be lost, and a channel can never
  be updated for stock that rolled back.
* On idempotency-key conflict it returns the previously applied movements (safe for webhook,
  queue and UI retries).
* It uses `READ COMMITTED` plus row locks rather than `SERIALIZABLE`, which avoids retry storms
  during bulk receiving.

### 5.2 Order lifecycle → stock

| Event (existing emitter) | Action |
|---|---|
| `order.new` (`order-import-ebay.service.ts`, PB360 import) | Resolve each line `sku/listing_id/externalItemId` → `inventory_item`. **Reserve** using the allocation strategy (below). Unresolvable → `order_items.inventory_status = 'unmatched'` + notification, no silent skip |
| status → `cancelled` | **Release** reservation |
| Pick confirmed (new pick UI / scan) | `pick` movement: item moves from bin to staging; unit status `picked` |
| `order.shipped` (`order-fulfillment.service.ts`) | **Ship**: `on_hand -= qty`, `reserved -= qty`; unit → `shipped` |
| `refund_requested`/return received | Return receipt into `returns` bin (quarantine, not sellable) → inspect → put-away or write-off |

**Allocation strategy** (configurable per org): (1) warehouses linked to the selling store, by
`priority`; (2) same country as the buyer's ship-to; (3) the single warehouse that can fill the
whole line (no split shipments by default); (4) FEFO/FIFO by `received_at` for unit-tracked items.
If nothing can be allocated → the order is flagged `backorder` and an alert is raised.

**Sale-before-import race:** eBay already decremented its own quantity. Reservation happens when
we import, which may be minutes later, so the outbox push after reserve must not raise quantity
back up. Channel sync therefore always pushes `computed_available`. It does not add deltas to
eBay's value. During the gap between the sale and our import, eBay's own decrement protects that
store. **The other stores and PB360 are what the push protects.** Speed matters here: subscribe to eBay
`ITEM_SOLD`/order notifications (already wired via `processEbayInventoryWebhook`) to trigger an
immediate order pull instead of waiting for the polling interval.

### 5.3 Channel availability and sync

```
sellable(store, item) = clamp(
    Σ available over warehouses linked to store (is_sellable, active)
    − buffer_qty,  0, max_qty ?? ∞ )   × pct_of_available
```

* **eBay Inventory API listings (ManageBySKU):** `bulkUpdatePriceQuantity` (up to 25 per call),
  with `shipToLocationAvailability.availabilityDistributions[]` per `merchantLocationKey` when a
  store is fed by more than one warehouse. Each warehouse maps to an eBay location via
  `warehouses.ebay_merchant_location_key`. The existing location util creates the location if it
  is missing.
* **eBay Trading-API listings** (item-ID tracked; this is the 2026-10-01 custom-label change):
  `ReviseInventoryStatus` (4 items/call), total quantity only. This adapter method has to be
  added to `ebay-trading-api.service.ts`.
* **partsbazar360:** `PartsBazar360Client` quantity update. Map `quantityAvailable`.
* **Out of stock:** push 0 (keeps eBay listing history/watchers when "out-of-stock control" is
  on) rather than ending the listing. This is a per-store setting.
* The processor drains the outbox: it groups by store, batches, applies per-store rate limits,
  and backs off exponentially. It records `pushed_qty`. A nightly **drift job** compares
  `ebay_published_listings.quantity_available` (already synced) with `sellable`, then re-queues
  any mismatch and writes a reconciliation report.
* Feature flag `warehouse_inventory_channel_push` per org, **default off**, so the first
  deployment is read-only for channels.

### 5.4 Vertical adapters

```ts
interface VerticalInventoryAdapter {
  vertical: ProductVertical;
  resolveItem(ref: { sku?; catalogProductId?; listingRecordId?; variantId? }): Promise<InventoryItem>;
  defaultTrackingMode(product): 'quantity' | 'serial' | 'one_off';
  onIntakeCompleted(payload): MovementCommand[];   // intake → receipt
  listingTargets(item): ChannelTarget[];           // which offers/listings to push
}
```

* **Auto Parts.** Pipeline warehouse intake (`add-intake-part`) creates a receipt line and asks
  for a **bin scan**. The donor vehicle (VIN/YMM already stored) becomes the unit `lot_code`, so
  you can ask "everything from donor X". Used parts default to `one_off`; multi-qty aftermarket
  rows (FEBEST) default to `quantity`. Workbench "send to catalog" links
  `listing_record_id ↔ catalog_product_id` on the same `inventory_item`.
* **Fashion.** `fashion_warehouses` are migrated to `warehouses`. Quick capture's warehouse
  picker writes a real receipt instead of `_warehouseCode` (the attribute is kept as a read-only
  echo for one release). Pre-owned items use `one_off` (each garment is unique). New-stock
  variants use `quantity` per `product_variant`, and the variant publisher reads sellable qty.
  A PAK_KHI → UK_LU7 consignment uses a **transfer with in-transit**.
* **B&I.** `business_industrial_units` become `inventory_units` (`tracking_mode = serial`), and
  private serials stay permission-gated. Today's unit statuses map directly
  (`allocated` → `reserved`). The `AE_Dubai` eBay location maps to warehouse `AE_DXB`. Publish
  quantity = count of `available` units.

### 5.5 RBAC (register in `backend/src/rbac/permission-registry.ts`)

| Permission | Default roles | Purpose |
|---|---|---|
| `inventory.view` (exists) | READ_ONLY+ | Stock overview, movements |
| `inventory.warehouses.manage` | ADMIN_UP | Warehouses, bins, store links |
| `inventory.receive` | READ_WRITE+ | Receiving & put-away |
| `inventory.transfer` | READ_WRITE+ (create), MANAGER_UP (approve) | Transfers |
| `inventory.adjust` (exists) | MANAGER_UP | Adjustments; above threshold needs `inventory.adjust.approve` |
| `inventory.count` | READ_WRITE+ | Perform cycle counts; approve variance = MANAGER_UP |
| `inventory.fulfil` | READ_WRITE+ | Pick/pack/ship |
| `inventory.channel_sync.manage` | ADMIN_UP | Buffers, push enable, force-sync |
| `inventory.valuation.view` | MANAGER_UP | Cost & valuation reports |

Fashion and B&I use vertical-prefixed permissions (`fashion.*`, `business_industrial.*`). Add
`fashion.inventory.*` / `business_industrial.inventory.*` aliases that map to the same guards,
consistent with how those shells already scope access. **Warehouse scoping:** queries filter by
`user_warehouse_assignments`, unless the user has `warehouse_access_all`. This mirrors
`store_access_all`. Remember the B&I lesson from 2026-09-15: an empty assignment list compiled
to `AND 1 = 0`. Write explicit tests for "no assignments" vs "all access".

### 5.6 API surface (prefix `/api/stock`; avoids clashing with the existing `/api/inventory`)

```
GET/POST/PATCH  /stock/warehouses                 /stock/warehouses/:id/locations (+ /labels.pdf)
GET             /stock/items?q&warehouse&status&lowStock     /stock/items/:id (levels, units, movements)
POST            /stock/items/link                  (link sku ↔ catalog/listing/variant)
GET             /stock/movements?item&warehouse&type&from&to (CSV export)
POST            /stock/receipts  · /:id/lines · /:id/complete · /:id/putaway
POST            /stock/transfers · /:id/ship · /:id/receive
POST            /stock/adjustments · /:id/approve
POST            /stock/counts · /:id/lines (scan) · /:id/submit · /:id/approve
GET/POST        /stock/reservations · /orders/:id/allocate · /orders/:id/pick · /orders/:id/release
GET/PUT         /stock/channel-policies/:storeId     POST /stock/channel-sync/:storeId/run
GET             /stock/reconciliation/latest       /stock/reports/{valuation,aging,movement,sell-through}
POST            /stock/scan   (barcode → item|unit|bin resolution for mobile)
```

Document these in `docs/architecture/API_CONTRACTS.md` and `docs/architecture/api-map.md` when
built.

---

## 6. Frontend plan

A shared **`src/components/stock/`** module follows the CatalogWorkspace pattern. There is one
implementation, configured per vertical, and it is mounted in each shell:

| Route | Auto Parts | Fashion | B&I |
|---|---|---|---|
| Stock overview | `/auto-parts/stock` | `/fashion/stock` | `/business-industrial/stock` |
| Item detail | `…/stock/items/:id` | same | same (serials gated) |
| Warehouses & bins | `…/stock/warehouses` | replaces `FashionWarehousesPanel` | same |
| Receiving | `…/stock/receiving` | integrated into `/fashion/capture` | integrated into image intake |
| Transfers | `…/stock/transfers` | ✔ (PAK→UK) | ✔ |
| Counts | `…/stock/counts` | ✔ | ✔ |
| Pick / pack | `…/orders` → "Pick list" tab | ✔ | ✔ |
| Movements / audit | `…/stock/movements` | ✔ | ✔ |
| Channel stock | store detail → "Stock policy" tab | stores page | stores page |

**Screens:**
1. **Stock overview:** table-first, matching the catalog. Columns: SKU, title, image, on hand,
   reserved, available, inbound, per-warehouse breakdown, bins, sellable-per-store chips, last
   movement, and a drift ⚠ badge. Facets: warehouse, status, low stock, unlinked to listing, drift.
   Mobile card layout below `lg`.
2. **Item drawer:** levels by warehouse/bin, serialized units, linked listings/offers with pushed
   qty, a movement timeline, and quick actions (adjust, move bin, transfer, print label).
3. **Receiving (scan-first):** pick warehouse → scan or enter SKU → qty/condition → scan bin.
   Uses the browser `BarcodeDetector` API with a manual fallback. It must follow the established
   B&I mobile rules (16px inputs, `dvh`, `viewport-fit=cover`).
4. **Cycle count:** choose bins/zone → blind count by scanning → variance review → approve.
5. **Pick list:** orders grouped by warehouse, sorted by bin path → scan to confirm → "Mark
   shipped" calls the existing `OrderShipmentPanel` flow.
6. **Labels:** a PDF of bin labels and SKU labels (Code128/QR), with ZPL as a later option.
7. **Dashboard widgets:** low stock, unallocated orders, drift count, stock value, aged stock
   (more than 90 days unsold).

---

## 7. Data migration and opening balance

These are the riskiest steps. They run per organization, behind the flag.

1. **Warehouses:** copy `fashion_warehouses` → `warehouses` (same IDs/codes). For each other org,
   create one default warehouse from the store `location_key` / eBay inventory location address
   (for example `AE_Dubai` → `AE_DXB`). Admins rename and add bins afterwards.
2. **SKU master:** backfill `inventory_items` from `catalog_products.sku` (org-scoped),
   `listing_records.custom_label_sku` and `product_variants.sku`. SKU collisions and
   `organization_id IS NULL` Auto Parts rows go to a **conflict report**. They are not merged
   silently.
3. **Opening balance:** choose the source quantity per item. Precedence: physical count (if
   supplied via CSV) > `catalog_products.quantity` / `listing_records.quantity_num` > live eBay
   `quantity_available`. Write `opening_balance` movements into the default warehouse, in
   **unassigned bin**.
4. **Units:** `business_industrial_units` → `inventory_units`, preserving status and allocation.
5. **Dry-run reconciliation report:** per item, compare ledger qty vs each store's live quantity
   vs PB360. **Nothing is pushed** until an admin reviews the report and enables
   `warehouse_inventory_channel_push` for that org.
6. Freeze writes to legacy quantity columns. The editors' quantity fields become read-only
   ("Managed by Stock") and link to the item. During transition, a projection job keeps
   `catalog_products.quantity` / `listing_records.quantity` updated from `available`, so any
   unconverted code path still reads a sane value.

Scripts go in `backend/scripts/` (idempotent and re-runnable), with a matching
`scripts/*.sql` verification query.

---

## 8. Delivery phases

| Phase | Scope | Exit criteria | Est. |
|---|---|---|---|
| **0. Fix the leaks** (can ship now, independent) | Make `order.new` resolve order items → listing IDs and deduct from the existing quantity (or at least alert); add an oversell alert when an item sells on one store and is live elsewhere at qty 1 | No silent no-op handler; test proves deduction | 2–3 d |
| **1. Core ledger** | Migrations §4.1–4.6, `StockLedgerService`, warehouses/bins CRUD, SKU master + backfill script, read-only Stock overview, RBAC, flag `warehouse_inventory` | Concurrency tests (parallel reserve on qty 1 → exactly one wins); backfill dry-run on prod copy | 2 wks |
| **2. Inbound & internal ops** | Receiving + put-away (hooked into AP warehouse intake, Fashion capture, B&I intake), adjustments with reasons/approval, bin moves, transfers with in-transit, labels, mobile scan | Each vertical's intake writes receipts; Fashion warehouse attribute replaced | 2–3 wks |
| **3. Orders & fulfilment** | Reservations + allocation strategy, pick list, ship → deduct, cancel/return flows, `order_items.inventory_item_id`, unmatched-line queue | End-to-end: eBay order import → reserve → pick → ship → on-hand decremented, idempotent on re-import | 2 wks |
| **4. Channel sync** | Store↔warehouse links, buffers/caps, outbox processor, eBay Inventory API multi-location, Trading `ReviseInventoryStatus`, PB360 qty, drift job + reconciliation report | Shadow mode for 1 week (compute + report, no push) → enable per store | 2–3 wks |
| **5. Counts & reporting** | Cycle counts (blind, ABC scheduling), valuation (avg cost), aging, sell-through, low-stock/reorder alerts via notifications | Count variance posts correctly; reports match ledger sums | 1–2 wks |
| **6. Advanced / cleanup** | FIFO costing, purchase orders/suppliers, 3PL/dropship warehouses, Shopify/Amazon adapters, drop legacy tables (`inventory_ledger`, `inventory_events`, `inventory_movements`, `store_inventory_allocations`) | Legacy reads removed; docs updated | as needed |

Phases 1–4 are the minimum viable "complete" system, about **9–11 engineer-weeks**.

---

## 9. Testing strategy

* **Unit:** allocation strategy, sellable formula, idempotency, invariant violations, vertical
  adapters' tracking-mode defaults.
* **Concurrency (Jest + real Postgres via docker-compose):** N parallel reserves on the same
  item/warehouse; transfer racing a sale; deadlock-free lock ordering under multi-line orders.
* **Ledger property test:** for random movement sequences,
  `Σ movements == stock_levels` and `available ≥ 0`.
* **Integration:** mocked eBay Inventory/Trading/PB360 clients verify batching, retry, and that
  pushes are always absolute quantities.
* **Migration:** run the backfill on a sanitized prod dump (`listingpro.dump`) and assert the
  conflict-report counts.
* **E2E UI:** extend the existing Playwright-style scripts (`scripts/test-business-industrial-catalog-ui.mjs`
  pattern) for receive → publish → order → pick → ship at 360px and desktop widths.

---

## 10. Risks and decisions to confirm

| # | Decision / risk | Recommendation |
|---|---|---|
| 1 | Is stock per **organization** (each vertical workspace is its own org) or shared across verticals? | Per org. Cross-vertical sharing isn't a real use case today. |
| 2 | Auto Parts rows with `organization_id IS NULL` | Assign to the Auto Parts org during backfill; report leftovers |
| 3 | Same physical part listed on multiple eBay stores + PB360 | Exactly the case the shared ledger solves; require store↔warehouse links before push |
| 4 | eBay Trading-API listings can't do per-location quantity | Push totals; per-location only for Inventory-API offers |
| 5 | Costing method | Weighted average first; FIFO in Phase 6 |
| 6 | Negative stock allowed? | No (DB CHECK). Oversold orders become `backorder` |
| 7 | Existing `/inventory` naming | Keep as workbench; new module is "Stock" |
| 8 | Pushing wrong quantities to live stores | Shadow mode + reconciliation report + per-store enable; absolute pushes only |
| 9 | `feature-flag`/`export-rule` `/api/api/...` quirk | Don't copy it: the new controller uses `@Controller('stock')` |

---

## 11. Documentation to update when implemented

Per `CLAUDE.md` continuous-documentation rules: `docs/architecture/DATABASE_SCHEMA.md` +
`DATABASE_MAP.md` (new tables), `API_CONTRACTS.md` / `api-map.md`, `AUTH_RBAC.md` +
`RBAC_AND_SECURITY.md` (new permissions), `docs/product/features.md`,
`docs/frontend/ROUTES_AND_SCREENS.md` + `FRONTEND_MAP.md`, `BACKEND_MAP.md` / `CODEMAP.md`,
`docs/context/CURRENT_STATE.md`, `docs/decisions.md`, `KNOWN_GAPS_AND_RISKS.md` (mark the
order-deduction gap fixed), and `CHANGELOG.md`.

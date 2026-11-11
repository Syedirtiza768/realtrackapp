# MotoArk order lifecycle and quantity integration

**Status:** Deployed and production-verified on 2026-11-03. The legacy sales
route remains receipt-only; purchase, shipment, cancellation, return, refund,
and quantity operations use the separate lifecycle contract below. See the
[production release record](../operations/MOTOARK_RELEASE_2026-11-02.md).

**Opening-stock policy confirmed by the user (2026-11-02):** Use verified
warehouse counts and keep unmapped sales pending. Do not infer opening stock
from the eBay mirror. Production follows this policy; no opening balances were
initialized. A bounded 200-row Primemotive sample had no inventory mappings,
so mapped/verified warehouse stock is still required before purchase events can
apply.

## Contract

| Method | Route | Permission | Purpose |
|---|---|---|---|
| POST | `/api/integrations/motoark/order-events` | `motoark.orders.notify` | Durably accept and attempt an order lifecycle event; HTTP 202 |
| GET | `/api/integrations/motoark/order-events/:eventId` | `motoark.orders.view` | Read the original event's processing status/result |
| GET | `/api/integrations/motoark/quantities/:listingId` | `motoark.orders.view` | Read warehouse-derived advertised availability separately from the marketplace mirror |

JWT authentication and organization membership are enforced through the existing global guards and organization resolver. All routes resolve the organization's single Primemotive store and enforce caller store access. `organizationId` is an optional organization selector subject to membership authorization, never a replacement for it. Physical return events additionally require `motoark.returns.receive` or `motoark.returns.restock`.

The external reader role receives notify/view only. Administrators receive all four permissions. A consumer's ability to report a return request or refund does not grant it authority to assert physical receipt or inspection.

### Signing

Use the **separate** `MOTOARK_ORDER_WEBHOOK_SECRET` in the backend and trusted sender. Send `X-Primemotive-Timestamp` (10-digit Unix seconds within five minutes) and `X-Primemotive-Signature: sha256=<hex HMAC-SHA256>`, signing the exact UTF-8 bytes of `<timestamp>.<raw body>`. Missing secret returns 503; invalid/stale signatures return 401. The existing `PRIMEMOTIVE_SALES_WEBHOOK_SECRET` remains dedicated to the legacy receipt route. No secret values belong in documentation, URLs, request bodies, or source control.

### Purchase example

```json
{
  "schemaVersion": 1,
  "eventId": "motoark-9281-paid-v1",
  "eventType": "order.paid",
  "occurredAt": "2026-11-02T09:15:00.000Z",
  "externalOrderId": "9281",
  "orderVersion": 1,
  "currency": "USD",
  "shippingAmount": "0.00",
  "taxAmount": "0.00",
  "lines": [{
    "externalLineId": "1",
    "listingId": "<RealTrack listing UUID>",
    "quantity": 2,
    "unitPrice": "154.99"
  }]
}
```

`eventId` is unique within the organization and must remain unchanged on retry. Exact semantic payload retries return `duplicate: true` and the original state; changed payloads under the same ID return 409. Sign each retry with a fresh timestamp. `orderVersion` starts at 1 and increases by one for each distinct business event on the order. Missing earlier versions remain pending; already-applied versions under a new event ID are rejected. A corrected rejected event needs a new event ID and the still-unconsumed order version.

Use the listing feed's `id`, not SKU/eBay item ID. An external line ID is stable within its order. Later events identify the original line and a **delta** quantity, not a cumulative quantity. Lines are unique per event and capped at 100; quantity is an integer from 1 to 100,000. Purchase lines require `listingId` and `unitPrice`. All monetary inputs are decimal strings with exactly two fractional digits. Currency is an uppercase three-letter code; subsequent events must match the purchase currency. Totals use bigint cents, including shipping/tax. The stored order total must fit `numeric(10,2)`.

### Events and stock effects

| `eventType` | Additional data | Effect |
|---|---|---|
| `order.paid` | Original lines, prices; optional shipping/tax | Creates a scoped order and reserves mapped warehouse stock in the same transaction. Physical on-hand stays unchanged. |
| `order.shipped` | Original line IDs + quantities | Consumes only unshipped reservations; reduces on-hand and reserved together. |
| `order.cancelled` | Original line IDs + quantities | Releases only unshipped/uncancelled reservations. Supports partial cancellations without adding physical stock. |
| `return.requested` | `returnId`, original lines + quantities | Records a return against shipped quantity; no stock increase. |
| `return.received` | `returnId`, lines + `warehouseId`, optional `locationId`; `unitIds` for tracked stock | Requires receive permission and a non-sellable quarantine warehouse. Receives physically returned stock without making it sellable. |
| `return.restocked` | `returnId`, lines + destination warehouse/bin; tracked `unitIds` | Requires restock permission. Moves inspected returned stock into an accessible sellable warehouse/bin. |
| `return.disposed` | `returnId`, original lines + quantities; tracked `unitIds` | Requires restock permission. Writes off physically received quarantine stock. |
| `refund.completed` | `refundId`, positive `amount`; omit `lines` | Records an external financial refund; does not change stock or invoke a payment provider. Cumulative refunds cannot exceed the original total. |

Each partial return receipt must use its return line's original quarantine location. Received/restocked/disposed quantities cannot exceed the corresponding balances. One-off/serial stock must name exactly one existing physical unit per quantity; receipt verifies the original shipment, and restocking preserves identity. A bin label of `returns` alone is insufficient to exclude inventory from channel availability: the receiving warehouse must have `is_sellable=false`.

Stock shortages, missing/ambiguous inventory mappings, missing predecessor events, and transient database failures remain `pending` with a diagnostic. No opening balances are inferred from eBay. Currently the purchase processor requires the full line quantity to be reservable from warehouse stock; supplier/on-demand availability does not manufacture physical stock or automatically create procurement orders. Operators must receive/map actual stock before those pending events can apply. Mirror-only synthetic `SIM-*` listings are rejected by the lifecycle receiver.

### Response and recovery

POST returns `{duplicate,eventId,status,attempts,lastError,result,receivedAt,appliedAt}`. `status` is `received`, `pending`, `applied`, or `rejected`. An `applied` result identifies the internal order, external order, committed version, and quantity lookup path. HTTP 202 confirms durable acceptance, not completion or marketplace synchronization. Business validation may be reported as `rejected` after durable acceptance; read the response status.

The PostgreSQL inbox has an atomic organization/event unique key and canonical payload hash. Processing locks the inbox row and serializes each organization/order. The generic order, line balances, reservation/movement operations, and `applied` state commit together. Retrying after a crash does not repeat stock effects. A 15-second scheduler selects due pending receipts in bounded batches; backoff grows to one hour. Reposting an identical event can trigger another attempt immediately. Pending/rejected states are accessible through the GET route; monitor age/error counts operationally.

Internal generic order status/shipping/refund actions and generic stock ship/release actions reject `channel=motoark` orders. MotoArk facts must use the signed lifecycle contract, maintaining its line balances and version. Generic stock allocation must not be used to replenish already processed external reservations.

## Quantity and delivery

The quantity route returns `mapped`, `inventoryItemId`, `quantityAvailable` (warehouse-policy desired advertised quantity), `warehouseAvailable`, `sourceable`, total `onHand`/`reserved`, `stockRevision`, `marketplaceQuantity`, `listingRevision`, `channelSyncStatus`, `channelSyncError`, and global/store push flags. Unmapped/ambiguous records return `mapped:false` and `quantityAvailable:null`. `stockRevision` is a decimal-string sum of ledger-projection row versions; it describes warehouse changes, not a new marketplace sales counter. Warehouse totals include non-sellable sites; `warehouseAvailable` follows the selling store's active warehouse links and buffer/sourceable policy is reflected in `quantityAvailable`.

Stock writes mark the existing channel outbox dirty transactionally. `ChannelStockSyncService` pushes absolute quantities only when **both** `stock_channel_push` and store `push_enabled` are enabled. Shadow mode records desired/channel differences without changing eBay. After successful eBay acknowledgement, the mirror quantity and active/out-of-stock status are updated, producing listing removal/reactivation events as appropriate. A failed eBay call leaves a retryable channel-sync result; lifecycle `applied` remains distinct from channel `synced`.

The Primemotive snapshot supports **`afterId=<UUID>`** keyset import (start at `00000000-0000-0000-0000-000000000000`). Omit page/sort overrides, retain the same filters, and follow `nextId` until `hasMore:false`. Its `total` is the remaining matching count, not a fixed original snapshot total. UUID ordering avoids offset shifts during concurrent updates/deletions. Legacy page-based imports remain supported.

The change feed supports **`afterSequence=<decimal string>`** and optional **`throughSequence=<decimal string>`**, with `nextSequence`, `throughSequence`, and `hasMore`. Omit timestamp/page pagination when using it. Keep the returned `throughSequence` fixed while draining the batch; then start another batch from the committed `nextSequence`. Sequence numbers are assigned in a serialized promotion transaction only to already-committed outbox rows. A slow source transaction is assigned a later sequence after it commits, preventing cursor loss. Promotion is bounded to 5,000 rows per invocation; old/unpromoted events will appear in subsequent batches, not be skipped. Legacy timestamp polling remains compatible but retains its historical late-commit limitations.

For initial import: obtain a change batch boundary, import the snapshot with the stable UUID keyset, then replay changes after that boundary and continue polling. Every new listing snapshot/change includes decimal-string `revision`; apply only newer revisions per listing, including tombstones. Historical outbox snapshots lacking a revision are revision `0`, so they cannot replace a newer imported snapshot. Continue periodic full reconciliation.

Outbound push now requires `PRIMEMOTIVE_LISTING_WEBHOOK_ORGANIZATION_ID` in addition to URL/secret. It resolves that organization's Primemotive store and claims only matching events. Only the earliest undelivered sequenced event for a listing is claimed, so a failed earlier delivery blocks later ones for that listing. Include `eventId`, `sequence`, and `revision` in receiver deduplication/order handling; consumers must reject stale revisions even under transport duplication. No callback URL was provided or enabled in this session.

## Schema and implementation

- `1791500000000-MotoarkOrderLifecycle`: atomic legacy receipt keys; durable `motoark_order_events`; organization-scoped `motoark_orders`; stable `motoark_order_lines`; quantity-balanced `motoark_returns`; unique/capped `motoark_refunds`; four permissions and scoped role grants. Lifecycle tables use explicit SQL through `EntityManager`, avoiding a second ORM representation of the stock ledger.
- `1791600000000-PrimemotiveOrderedChanges`: listing `revision`, nullable promoted change `sequence`, sequence/cursor/delivery indexes, revision and eligibility-aware change triggers. It preserves the prior trigger function for rollback and does not backfill the 5 GB listing table. Existing outbox rows are promoted incrementally.
- `backend/src/integrations/motoark/`: controller, DTOs, receiver/processor, stock adapter, raw-body signature and decimal helpers, PostgreSQL tests.
- `backend/src/stock/`: existing append-only ledger and reservation primitives; successful channel pushes now reconcile mirror status as well as quantity.

## Production verification and remaining gates

The scoped overlay was deployed on 2026-11-03 after the full pre-migration
archive passed `pg_restore` validation. It restores the Primemotive routes that
were missing from the prior image and preserves production's `PartsSearchModule`
by merging registration into the running app module. Both reviewed migrations
are applied. The prior image and exact Compose chain remain available for
rollback; see the [release record](../operations/MOTOARK_RELEASE_2026-11-02.md)
for IDs, checksum, and production evidence.

Local and public health checks returned 200, and unauthenticated lifecycle and
legacy sale routes returned 401. An existing external-reader account verified
the snapshot and change cursors, quantity lookup, signed synthetic lifecycle
receipt, duplicate/conflict handling, invalid signatures, strict DTO
validation, status lookup, and a fixture-only legacy receipt. The active
Primemotive sample still had **0 mapped inventory items** out of 200 sampled;
this is not a full coverage measurement. `stock_channel_push` remains false,
the existing legacy sale key was preserved, and a distinct lifecycle key is
configured. No opening stock, order, or stock movement was created by the
production verification.

Before real sales can apply, verify actual warehouse counts, map listings to
inventory items, and receive opening stock through the normal warehouse count
workflow. Unmapped/short sales stay pending; do not infer physical stock from
eBay mirror quantities. Marketplace channel push stays off until shadow
comparisons are reviewed and both global/store settings are deliberately
enabled. Outbound listing callbacks remain inactive until the callback URL,
separate key, and organization scope are configured.

Rollback should normally restore the previous backend image and retain the
additive tables/inbox. Migration `down` removes lifecycle data and requires a
separate explicit review; do not use it as the default rollback.

Verification commands and final results are recorded in [Testing](../operations/TESTING.md). The PostgreSQL suite uses `STOCK_IT_DATABASE_URL` for an isolated disposable database; it never targets the production database. Tests cover duplicate concurrency, last-unit races, crash rollback, partial lifecycle balances, tracked-unit identity, authorization/scoping, cursor late commits, outbound ordering/isolation, channel acknowledgement, and migration roundtrips.

Post-purchase notifications alone cannot guarantee zero overselling across independent simultaneous checkouts. Pre-checkout reservations/channel allocations and expiry require an agreed consumer checkout contract. No refund payment is initiated by this API.

# MotoArk sales, cancellations, returns, and quantity gap analysis

> **Historical assessment before implementation.** The 2026-11-02 local
> implementation is documented in [MOTOARK_ORDER_LIFECYCLE.md](../architecture/MOTOARK_ORDER_LIFECYCLE.md).
> The lifecycle implementation and missing Primemotive runtime routes were
> deployed on 2026-11-03. The findings below preserve the original state and
> proposed resolution; current production status and remaining stock/callback
> prerequisites are recorded in
> [the release record](../operations/MOTOARK_RELEASE_2026-11-02.md).

**Reviewed:** 2026-11-02

**Scope:** Current working-tree implementation, deployment configuration, integration guides, and focused existing tests. This is an assessment and implementation plan; proposed endpoints and behavior below are not implemented. Production configuration, current feature flags, authenticated MotoArk requests, and live stock coverage were not verified in this session.

## Outcome

MotoArk can report a sale today, but RealTrack only records the notification. The receiver accepts **only `listing.sold`**. It does not create an order, reserve/decrement stock, revise eBay quantity, or handle cancellations, returns, or refunds. Sharing the signing secret enables receipt testing; it does not provide an order/inventory integration.

Quantity visibility already exists in the listing snapshot and durable listing change feed. The missing path is **MotoArk order event → validated order/line → warehouse stock → channel quantity → consumer update**.

## Requirement coverage

| MotoArk requirement | Current behavior | Gap / resolution |
|---|---|---|
| Test `sales.notify` with a secret | JWT + `published_listings.sales.notify` + timestamped HMAC are required. Missing inbound secret produces 503 after the request reaches the service. | Verify/provision the inbound secret in the deployed backend and share through the approved secret channel. Fix missing Compose wiring before expecting a host `.env` value to work. |
| Report a completed purchase | `POST /api/published-listings/primemotive/webhooks/sales` accepts one listing/quantity per request and writes `channel_webhook_logs`. | Receipt only. Add a scoped order-lifecycle adapter with durable processing and stock effects. |
| Cancel an order / individual line | Unsupported by the sale DTO. Internal order cancellation can release reservations. | Add external order/line identity, cancellation validation, and partial cancellation accounting. Do not add physical stock when releasing an unshipped reservation. |
| Returns | Unsupported by the sale DTO. Stock has receipt/movement primitives and return-related types; no complete order-linked return workflow. | Add return request, receipt, inspection/disposition, and per-line quantity limits. Restock only eligible physically received goods. |
| Refunds | Unsupported by the sale DTO. Internal `processRefund()` updates order financial/status fields without a stock movement or external payment-provider call. | Record external refund identity, amount, currency, cumulative limits, and line association. A refund alone must not restock. |
| See quantity updates | Feed exposes `quantityAvailable` / `quantitySold`; `/primemotive/changes` contains quantity snapshots on `listing.updated`. Optional signed push exists. | No update follows a MotoArk sale receipt. Connect stock processing to channel sync; expose authoritative stock and processing status separately from the eBay mirror. |

## Confirmed findings and fixes

### G1 — Inbound secret configuration is incomplete (P0 for receipt testing)

`PublishedListingsService.recordPrimemotiveSaleEvent()` reads `PRIMEMOTIVE_SALES_WEBHOOK_SECRET`. The root `.env.example` and development environment reference describe it. However, the checked-in `docker-compose.yml` does not pass it into the backend, while setting `IGNORE_ENV_FILE=true`; `docker-compose.prod.yml` does not supply it either. Adding it only to the host `.env` therefore does not configure the standard Compose backend. The backend `.env.example` also omits it. The operations environment table omitted it at the start of this review and is corrected in this documentation update.

Presence-only checks found no configured value in the current process, root `.env`, or `backend/.env`. No secret value was printed, generated, rotated, or retrieved from production. An uninspected production override may supply it; local absence does not establish production absence.

**Fix:** Add explicit backend Compose environment forwarding and backend example documentation; the operations variable reference is now documented. The administrator must verify or provision the value in the actual deployed configuration and deliver it to MotoArk through the approved secret-sharing channel. Keep it separate from `PRIMEMOTIVE_LISTING_WEBHOOK_SECRET`, which signs the opposite direction. Verify runtime presence without logging the value, then test a signed synthetic receipt and retry. A backend recreation/deployment requires the normal explicit approval.

### G2 — Sale receipt has no order or inventory effects (P0 for stock synchronization)

The sale service checks HMAC, organization, Primemotive store, and store access, then writes a log with `processingStatus: 'processed'`. It does not invoke `OrdersService`, `OrderStockService`, `StockLedgerService`, a stock queue, or eBay quantity APIs. `accepted` / `processed` currently mean receipt recorded, not stock synchronized. The response contains no resulting quantity or channel-delivery result.

**Fix:** Add a dedicated lifecycle endpoint and durable inbox/worker. Record receipt separately from processing completion. Use explicit states such as `received`, `applied`, `failed`, and a separate channel-sync status. Keep the existing sale endpoint's receipt-only behavior compatible until MotoArk deliberately adopts the new contract. Do not process the same sale through both paths.

### G3 — Cancellation/return/refund identity and state are missing (P0 for lifecycle support)

`PrimemotiveSaleWebhookDto` restricts `eventType` to `listing.sold`. Other values fail validation; adding return/cancellation fields also conflicts with the strict global whitelist. `externalOrderId` is optional and there is no stable external line ID, return ID, original-event reference, event sequence, or partial-quantity balance. `soldAt` is the only business-event timestamp. Merely widening the event enum would record additional logs without applying business rules.

**Fix:** Require stable external order and line identities, use `occurredAt` plus event-specific DTOs, and persist ordered/shipped/cancelled/returned/refunded balances. Distinguish partial from complete operations and reject over-cancellation/over-return. Store order/line mappings scoped to organization and integration; eBay listing UUIDs must resolve to the correct inventory item, not be passed as internal listing-record IDs.

### G4 — Receipt deduplication is vulnerable to concurrent retries (P0 before stock effects)

The receiver performs `findOne()` then `save()`. The webhook entity and migrations inspected provide no unique constraint for the logical `(channel, event type, organization-prefixed eventId)` key. Simultaneous retries can both return `accepted` and create rows. Reusing an ID with a different quantity/listing is also treated as `duplicate` without comparing the original payload. Thus the existing documentation's idempotency promise covers sequential lookup behavior, not atomic concurrent deduplication.

**Fix:** Introduce an inbox with a database-enforced unique `(organization, integration, eventId)` key and payload hash. Exact retries return the original processing result; changed payloads under the same ID return 409. Scope external order/line uniqueness likewise. Apply each business operation with an idempotent stock operation key. Do not rely on adding an incomplete unique index to the time-partitioned `channel_webhook_logs` table; its partitioning needs explicit consideration.

### G5 — Warehouse services are reusable but are not a complete external adapter (P1)

The current authority for new stock work is `backend/src/stock/`, not the legacy `InventoryService` ledger. `OrderStockService` reserves on `order.new`, releases on `order.cancelled`, and consumes on `order.shipped`; `StockLedgerService.apply()` provides row locking, invariants, idempotent movements, and a transactional channel outbox. However, `OrdersService.importOrder()` saves the order and lines separately and emits an in-process event; async stock listeners catch and log failures. This is not an atomic durable webhook-to-stock transaction.

The generic orders controller/service also does not pass authenticated organization/store scope through its read/status/refund methods. It is not a safe shortcut to grant MotoArk broad internal order permissions. Order uniqueness is currently `(channel, externalOrderId)`, rather than organization + integration + external order.

**Fix:** Reuse stock primitives behind a narrowly permissioned, server-scoped adapter. Refactor the required domain operations to accept one transaction manager or use a durable, retryable processor with explicit reconciliation. Bind orders to a validated organization/store and inventory item mapping. Measure mapping and warehouse coverage for the actual Primemotive feed before stock writes; do not manufacture stock for unmatched listings.

### G6 — Channel propagation depends on configuration and mirror freshness (P1)

`ChannelStockSyncService` already computes absolute sellable quantities, pushes eBay offers/Trading listings, then updates `ebay_published_listings.quantity_available`; the listing trigger can then emit the change. Actual pushes require both `stock_channel_push` and the store's `push_enabled` policy. Otherwise the service records `shadow`. Warehouse/store links, item matching, buffers, sourceable-stock policy, and successful channel API calls also matter. The 2026-10-05 deployment record describes shadow mode; current production flag values were not checked.

The dedicated Primemotive snapshot intentionally reads database `listingStatus=active` and bypasses the generic buyable/fresh-sync gate. The mirror is not a checkout stock guarantee. Trading sync can change zero-stock rows to `out_of_stock`, excluding them from the active snapshot; the change feed must still be applied. `quantitySold` is marketplace mirror data, not an aggregate MotoArk sales counter.

**Fix:** Expose separate authoritative available/reserved stock, marketplace quantity, quantity version, and sync result. Use absolute quantity updates with reconciliation; do not independently subtract a MotoArk sale in the mirror and again in the stock ledger. Enable channel pushes only after matching/shadow results have been reviewed and deployment is authorized. Agree a measurable freshness/propagation target with MotoArk; 15-second webhook dispatch is not a 15-second end-to-end guarantee.

### G7 — Listing change delivery needs ordering and consumer isolation hardening (P1)

Push delivery sends up to 10 events concurrently and retries failures independently, so a later quantity snapshot can arrive before an older one. Events have UUID/time but no per-listing revision. Polling uses offset pages and an inclusive timestamp watermark without a fixed batch boundary; equal timestamps, concurrent inserts/commits, and initial-import updates need explicit regression coverage. Deduplicating event IDs alone does not stop an older snapshot overwriting newer quantity.

The sender uses one global URL/secret and claims pending changes without an organization/store filter. If multiple organizations have a store named Primemotive, their changes can be sent to that same destination. This is a conditional isolation risk identified in source, not evidence that production has leaked data.

**Fix:** Add a monotonic per-listing revision and have MotoArk reject stale revisions. Add cursor-based, bounded change batches with a documented strategy for late commits and periodic snapshot reconciliation. Route deliveries through an integration/organization/store-scoped subscription. Retain retry/error information, add replay/alerting, and test out-of-order delivery and cross-organization exclusion.

### G8 — Synthetic fixtures and current tests do not prove lifecycle behavior (P1)

The simulator changes only marked mirror rows' price/quantity; it does not exercise a purchase, order creation, reservation, return, or eBay call. No direct sale-HMAC/concurrency/change-dispatch tests were found in the inspected specs. Mirror-only `SIM-PRIME-*` identifiers must never be sent to a real marketplace stock adapter when lifecycle testing is added.

**Fix:** Use isolated test orders/inventory with mocked channel adapters, deterministic lifecycle scenarios, and dedicated HMAC/RBAC/tenant/concurrency tests. Keep the existing fixtures for feed-consumer testing only.

## Proposed dedicated contract — not currently available

Use **`POST /api/integrations/motoark/order-events`** for inbound lifecycle facts and **`GET /api/integrations/motoark/order-events/:eventId`** for the stored processing result. The paths are recommendations, not released routes. Register new narrowly scoped notify/read permissions, retain JWT + timestamped raw-body HMAC, and derive the allowed integration/organization/store from server-side authorization.

Example proposed purchase payload:

```json
{
  "schemaVersion": 1,
  "eventId": "motoark-order-9281-paid-v1",
  "eventType": "order.paid",
  "occurredAt": "2026-11-02T09:15:00.000Z",
  "externalOrderId": "9281",
  "orderVersion": 1,
  "currency": "USD",
  "lines": [{
    "externalLineId": "1",
    "listingId": "<RealTrack UUID from the listing feed>",
    "quantity": 1,
    "unitPrice": "154.99"
  }]
}
```

Define totals/tax/shipping and partial-operation payloads before implementation; the example is not a complete commercial-order schema. Validate decimal amounts without floating-point financial arithmetic. A receipt response should identify the accepted event and processing status; expose stock results only after their transaction commits and report channel synchronization separately. Duplicate requests must return the existing result.

Recommended event semantics:

| Event / action | Stock effect |
|---|---|
| `order.paid` | Create/upsert the scoped order and reserve stock. Sellable availability decreases; physical on-hand remains until dispatch. A purchase that already shipped needs a separate explicit shipment fact. |
| `order.shipped` | Consume reserved quantity and physical on-hand once. Do not subtract sellable availability a second time. Support quantities per line/shipment. |
| `order.cancelled` | Release only unshipped, uncancelled quantities. Handle partial cancellations explicitly; shipped quantities follow the return workflow. |
| `return.requested` | Record the request against the original line; no sellable stock increase. |
| `return.received` | Record verified physical receipt against shipped quantity into non-sellable/quarantined stock, retaining one-off/serial identity. Await inspection. |
| Authorized return restock/disposition | Move inspected sellable goods into sellable stock; keep damaged goods unavailable. A `returns` bin name alone is insufficient: channel availability sums by sellable warehouse, so quarantine must be represented in the actual stock policy/ledger. |
| `refund.completed` | Record a refund that occurred in MotoArk/payment processing; no automatic physical restock. Support partial financial refunds and cumulative limits. |

Support out-of-order events through version checks and a pending-dependency/retry state; never silently apply a cancellation/return without its original order line. Use a durable exception state for unmapped or unavailable stock. If zero overselling across simultaneous MotoArk/eBay purchases is a requirement, post-purchase notifications alone cannot guarantee it: evaluate pre-checkout reservations, expiry, and channel allocation with MotoArk.

## Delivery order and acceptance

1. **Unblock receipt testing:** fix inbound secret wiring/documentation; verify runtime configuration and integration permissions; securely provision the secret; signed synthetic request → `accepted`, sequential retry → `duplicate`, invalid/stale signature → rejection. Confirm quantity remains unchanged under this legacy contract.
2. **Purchase/cancellation integration:** add reviewed migrations for the inbox and scoped order/line identities; implement durable domain processing, atomic stock effects, partial cancellations, status lookup, and inventory-item mapping. Reuse the warehouse ledger rather than adding another quantity writer.
3. **Returns/refunds:** implement linked returns, quarantine/inspection/disposition, financial event records, per-line limits, and permissions for physical receipt/restock. Keep refund and restock independent.
4. **Quantity rollout:** add revisions/cursor/subscription hardening; verify mapped test inventory in shadow mode, then perform an explicitly approved staged channel rollout with replay, failure alerts, and reconciliation.

Release checks must cover: raw-body HMAC and expiry; permission/organization/store isolation; concurrent duplicate requests; changed-payload ID conflicts; same external order IDs in different organizations; last-unit contention; purchase then partial/full cancellation; shipment replay; partial returns and damaged returns; refund without stock change; return before original sale; crash/retry between receipt and stock commit; stale/out-of-order callbacks; unavailable eBay and recovery; and exclusion of synthetic listing IDs from real channel calls.

Example stock invariant: start with on-hand 5/reserved 0/available 5; pay for 2 → 5/2/3; ship 2 → 3/0/3. Cancelling an unshipped reservation restores availability without increasing on-hand. A refund alone leaves stock unchanged. Physically receiving and approving one shipped return restores one sellable unit exactly once.

## Verification performed

- Inspected controller, DTO, receiver, webhook log entity/migrations, listing trigger/outbox/sender, stock ledger/order/channel services, orders controller/state machine, configuration, and integration documentation.
- Ran `npm test -- --runInBand --runTestsByPath src/published-listings/published-listings.spec.ts src/orders/orders.service.spec.ts` from `backend/`: **21 passed, 1 failed**. The existing published-listing offer-resolution test fails because its Trading API mock has no `reviseFixedPriceItem`; the orders suite passes. No application/test code was changed during this assessment. These existing tests do not verify the missing MotoArk lifecycle.
- At the time this assessment ended on 2026-11-02, no production calls, stock mutations, migrations, deployments, secret rotation, or messages to MotoArk had been performed. The 2026-11-03 deployment and its production verification are recorded separately in the [release record](../operations/MOTOARK_RELEASE_2026-11-02.md).

## Implementation references

- [Sale DTO](../../backend/src/published-listings/dto/published-listings.dto.ts): `PrimemotiveSaleWebhookDto`.
- [Routes](../../backend/src/published-listings/published-listings.controller.ts): receipt, sale log, snapshot, changes.
- [Receiver](../../backend/src/published-listings/services/published-listings.service.ts): `recordPrimemotiveSaleEvent()`, `listPrimemotive()`, `listPrimemotiveSalesEvents()`.
- [Webhook log](../../backend/src/channels/entities/channel-webhook-log.entity.ts) and [partitioning migration](../../backend/src/migrations/1709424000000-Phase3Partitioning.ts).
- [Listing trigger migration](../../backend/src/migrations/1791400000000-PrimemotiveListingChangeFeed.ts) and [change sender](../../backend/src/published-listings/services/primemotive-listing-changes.service.ts).
- [Orders](../../backend/src/orders/orders.service.ts), [controller](../../backend/src/orders/orders.controller.ts), [state machine](../../backend/src/orders/order-state-machine.ts).
- [Stock order service](../../backend/src/stock/order-stock.service.ts), [ledger](../../backend/src/stock/stock-ledger.service.ts), [channel sync](../../backend/src/stock/channel-stock-sync.service.ts), and [warehouse architecture](../architecture/WAREHOUSE_INVENTORY.md).
- [Compose configuration](../../docker-compose.yml) and [current MotoArk contract](motoark-primemotive-api.md).

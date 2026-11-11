# MotoArk Production Integration Guide: Primemotive Listings

**Reviewed:** 2026-11-05 (US source reconciled; authenticated reader/API checks passed)
**Audience:** MotoArk integration and operations teams  
**Production API origin:** `https://app.omnicoreholding.com`  
**API prefix:** `/api`

**US listing reconciliation (2026-11-05):** The supplied 90,535 US listings
were reconciled on production against a completed current eBay inventory report,
with zero mismatches in an independent database check. Of that source population,
50,935 are active, 37,940 out of stock, and 1,660 ended. Standard listing
revision/change triggers were retained. This did not initialize warehouse stock,
enable channel pushes, or prove that MotoArk consumed the changes. Unknown
mirror-only IDs remain outside this source reconciliation, and the first
server's configured integration login returned 401. After historical reader
credentials also failed, the user authorized resetting that reader password.
Authenticated active/out-of-stock/ended listing checks and the dedicated
PrimeMotive feed now return HTTP 200 with expected values. The rotated secret
is stored only in protected server configuration; consumers must be provisioned
with it before their own authentication or ingestion is considered verified. See the
[reconciliation record](../operations/PRIMEMOTIVE_US_RECONCILIATION_2026-11-05.md).

**Production status (2026-11-03):** The scoped backend overlay and both
lifecycle/change-feed migrations are deployed. Snapshot and change-feed routes,
quantity lookup, signed synthetic order-event behavior, and the legacy receipt
route were verified in production. Marketplace stock pushing remains disabled;
the checked 200-row Primemotive sample had no inventory mappings. See the
[lifecycle contract](../architecture/MOTOARK_ORDER_LIFECYCLE.md) and
[release record](../operations/MOTOARK_RELEASE_2026-11-02.md).

This guide documents the production contract MotoArk can use to import listings,
keep its copy current, and report order lifecycle events. It is specific to the
production integration; the [external API contract](external-published-listings-api.md)
contains the broader response and catalog-field reference.

**Legacy versus lifecycle events:** `POST /api/published-listings/primemotive/webhooks/sales`
still accepts only `listing.sold` and records a receipt; it does not alter
orders or stock. Use the deployed MotoArk order-events endpoint below for
purchases, shipments, cancellations, returns, refunds, and stock processing.
The 2026-11-02 gap assessment is retained
[here](motoark-order-lifecycle-gap-analysis.md).

## Production contract

| Need | Endpoint | Contract |
|---|---|---|
| Initial listing import and current snapshot | `GET /api/published-listings/primemotive` | Active Primemotive rows with non-empty eBay IDs; stable `afterId` UUID cursor; page size up to 200; each row has a revision |
| Listing changes, including removals | `GET /api/published-listings/primemotive/changes` | Durable commit-safe `afterSequence` / `throughSequence` cursors; page size up to 200 |
| Push listing changes to MotoArk | Configured MotoArk HTTPS callback | HMAC-signed JSON with retry; production delivery is awaiting MotoArk's callback URL and the outbound signing secret |
| Legacy sale receipt only | `POST /api/published-listings/primemotive/webhooks/sales` | Accepts `listing.sold` and records a receipt; no order/stock effects |
| Report purchases and order lifecycle | `POST /api/integrations/motoark/order-events` | Signed durable events for paid, shipped, cancelled, return, and refund operations; HTTP 202 is receipt, not completion |
| Check event processing | `GET /api/integrations/motoark/order-events/:eventId` | Returns `received`, `pending`, `applied`, or `rejected` status |
| Read warehouse quantity | `GET /api/integrations/motoark/quantities/:listingId` | Returns mapped warehouse availability, channel mirror/sync state, and stock revision; unmapped quantity is `null` |
| Manual CSV export | `GET /api/published-listings/export` | Up to 10,000 rows per `page`; requires the export permission |

On 2026-10-15, the feed matched **91,496 active listings**, including the 10
synthetic test listings described below. This is a historical point-in-time
total and changes as Primemotive syncs or listings change. The older page-based
response includes `items`, `total`, `page`, and `limit`; the current `afterId`
cursor also returns `nextId` and `hasMore`, with `total` counting the remaining
matches rather than a fixed original snapshot.

The feed reads RealTrackApp's stored listing mirror; it does not call eBay for
each API request. MotoArk is responsible for identifying its target Mercedes
parts from the listing data. The response is an eBay listing record, not a
complete or normalized Partslink24 catalog record.

## Authentication and permissions

All routes use HTTPS and JWT bearer authentication. There is no API-key route.
Ask the Omni Core administrator to provision a dedicated MotoArk integration
login, verify its organization and Primemotive store access, and deliver its
password through an approved secret-sharing channel. Do not use an administrator
or eBay seller login in MotoArk.

Check the integration user's effective permissions with
`GET /api/auth/me`. Grant only the needed permissions:

| Operation | Permission |
|---|---|
| Read listing feed or change feed | `published_listings.external_feed` (method-level permission overrides the controller's view permission) |
| Read the recorded sale-event log | `published_listings.view` |
| Submit legacy `listing.sold` receipt | `published_listings.sales.notify` |
| Submit order lifecycle events | `motoark.orders.notify` |
| Read order status and warehouse quantity | `motoark.orders.view` |
| Physically receive/restock/dispose a return | `motoark.returns.receive` / `motoark.returns.restock` |
| Download CSV exports | `published_listings.export` |

The external reader role is granted lifecycle notify/view only. It cannot
assert that a return was physically received or inspected. Those actions need
the separate warehouse permissions and a non-sellable quarantine workflow.

The login response contains `accessToken`; send it as
`Authorization: Bearer <token>`. Access tokens expire according to
`JWT_EXPIRY_SECONDS` (default four hours); re-authenticate when a protected
request returns `401`. A `403` indicates a missing permission or store access.

```bash
curl -sS -X POST 'https://app.omnicoreholding.com/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"<motoark-integration-email>","password":"<secret>"}'

curl -sS 'https://app.omnicoreholding.com/api/auth/me' \
  -H "Authorization: Bearer $TOKEN"
```

## Initial MotoArk listing import

Use the dedicated Primemotive route. The server fixes the request to the
authenticated organization's Primemotive eBay store and to active rows with a
non-empty `ebayItemId`. Caller-supplied `storeId`, `storeSlug`, or `status=all`
cannot widen that scope. No make/brand item-specific filter is applied.

```bash
curl -G 'https://app.omnicoreholding.com/api/published-listings/primemotive' \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'page=1' \
  --data-urlencode 'limit=200'
```

The response envelope is:

```json
{
  "items": [{
    "id": "<realtrack-listing-uuid>",
    "organizationId": "<organization-uuid>",
    "storeId": "<primemotive-store-uuid>",
    "ebayItemId": "<ebay-item-id>",
    "sku": "<seller-sku>",
    "title": "<listing-title>",
    "price": "154.99",
    "currency": "USD",
    "quantityAvailable": 1,
    "quantitySold": 0,
    "listingStatus": "active",
    "itemSpecifics": {},
    "isTestListing": false,
    "updatedAt": "<ISO-8601 timestamp>"
  }],
  "total": 91496,
  "page": 1,
  "limit": 200
}
```

The JSON is illustrative; nullable fields, item specifics, images, and other
listing attributes vary by row. Prices are decimal strings. Upsert MotoArk rows
by RealTrackApp `id`; retain `ebayItemId` as the eBay-side identifier. Start
with the nil UUID cursor and follow `nextId` until `hasMore` is false:

```bash
curl -G 'https://app.omnicoreholding.com/api/published-listings/primemotive' \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'afterId=00000000-0000-0000-0000-000000000000' \
  --data-urlencode 'limit=200'
```

The response includes `nextId`, `hasMore`, and `total` (the remaining match
count, not a fixed snapshot total). Repeat with `afterId=<nextId>`. Do not mix
this cursor with `page` or sort overrides. Each item contains a decimal-string
`revision`; retain it for stale-update protection.

For an initial load, first call the change feed with `afterSequence=0` and save
its returned `throughSequence` as the import boundary. Import the snapshot with
the stable UUID cursor, then begin change polling after that boundary. This
captures changes committed during the snapshot without replaying the entire
historical outbox. Existing history before migration
`1791400000000-PrimemotiveListingChangeFeed` is not available; the snapshot
supplies that initial state.

## Keep MotoArk current

Use the committed sequence cursor for ongoing synchronization. A first request
with `afterSequence=0` returns a `throughSequence` boundary; each event carries
`sequence` and `revision`. Keep the same `throughSequence` while draining a
batch, save each page's `nextSequence` only after applying all its events, then
start the next batch after the saved cursor:

```bash
curl -G 'https://app.omnicoreholding.com/api/published-listings/primemotive/changes' \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'afterSequence=<last-committed-sequence>' \
  --data-urlencode 'throughSequence=<fixed-batch-boundary>' \
  --data-urlencode 'limit=200'
```

Each response contains `items`, `total`, `limit`, `nextSequence`,
`throughSequence`, and `hasMore`. Each item has this shape:

```json
{
  "eventId": "<stable-event-uuid>",
  "eventType": "listing.updated",
  "occurredAt": "<ISO-8601 timestamp>",
  "sequence": "<commit-safe-sequence>",
  "revision": "<listing-revision>",
  "listingId": "<realtrack-listing-uuid>",
  "listing": { "id": "<realtrack-listing-uuid>", "listingStatus": "active" }
}
```

`eventType` is `listing.added`, `listing.updated`, or `listing.removed`.
Apply events idempotently using `eventId`; upsert the included `listing` for
add/update events and remove or archive the MotoArk copy for `listing.removed`.
Use `listingId` as the RealTrackApp key and apply an event only when its
revision is newer than the saved revision. A removal includes the last available
listing snapshot; treat the event type as authoritative even when the snapshot
status is `ended`. Deduplicate by `eventId`; continue periodic snapshot
reconciliation. Legacy `updatedAfter` polling remains available but has weaker
late-commit guarantees.

## Optional push delivery to MotoArk

Production has the durable outbox and sender code deployed, but no outbound
callback is active yet. To enable it, MotoArk must provide an HTTPS receiver URL
and Omni Core must configure `PRIMEMOTIVE_LISTING_WEBHOOK_URL` and
`PRIMEMOTIVE_LISTING_WEBHOOK_SECRET` in the backend's production environment.
Do not send the secret in a URL or request body. Until configured, MotoArk should
poll the change endpoint above.

When enabled, the sender attempts due events about every 15 seconds. It sends
the JSON event shown above with these headers:

```http
Content-Type: application/json
X-Primemotive-Timestamp: <Unix seconds>
X-Primemotive-Signature: sha256=<hex HMAC-SHA256>
X-Primemotive-Event-Id: <event UUID>
```

The signature is HMAC-SHA256 using the shared outbound secret over the exact
UTF-8 bytes of `<timestamp>.<raw JSON body>`. MotoArk should verify the signature
before parsing or reserializing the body, reject stale timestamps, deduplicate
by `eventId`, and return a `2xx` only after the event is durably accepted. Failed
deliveries retry with exponential backoff; duplicate deliveries are expected.

## Legacy sale receipt

For each completed sale line, MotoArk can send an idempotent receipt to:

```http
POST /api/published-listings/primemotive/webhooks/sales
Authorization: Bearer <token>
X-Primemotive-Timestamp: <10-digit Unix seconds>
X-Primemotive-Signature: sha256=<hex HMAC-SHA256>
Content-Type: application/json
```

Example body:

```json
{
  "eventType": "listing.sold",
  "eventId": "motoark-order-9281-line-1",
  "listingId": "<realtrack-listing-uuid-from-the-feed>",
  "soldAt": "2026-10-15T09:15:00.000Z",
  "quantity": 1,
  "externalOrderId": "motoark-order-9281",
  "unitPrice": 154.99,
  "currency": "USD"
}
```

The `listingId` must be the feed's RealTrackApp UUID, not `ebayItemId` or SKU.
Keep `eventId` stable for retries. Sign the exact body bytes using the separate
server-side `PRIMEMOTIVE_SALES_WEBHOOK_SECRET` and the timestamped HMAC format
described in the [external API guide](external-published-listings-api.md#report-a-sale-from-the-external-application).
The server returns HTTP 200 with `accepted` for a new receipt and `duplicate`
for an exact retry. Changed payloads under a reused event ID return 409. This
route remains receipt-only; it does **not** create an order or change inventory
or quantity. Use the event lifecycle endpoint for stock-affecting operations.
The event log can be read with
`GET /api/published-listings/primemotive/sales-events`.

## Purchases, cancellations, returns, refunds, and quantity

Use the deployed order lifecycle API for business events that need order and
warehouse accounting. It uses a distinct `MOTOARK_ORDER_WEBHOOK_SECRET`; do not
reuse `PRIMEMOTIVE_SALES_WEBHOOK_SECRET`. Provision the configured key to
MotoArk through an approved secret-sharing channel. Never send the key in a URL
or request body.

```http
POST /api/integrations/motoark/order-events
Authorization: Bearer <token>
X-Primemotive-Timestamp: <10-digit Unix seconds>
X-Primemotive-Signature: sha256=<hex HMAC-SHA256>
Content-Type: application/json
```

Sign the exact UTF-8 bytes of `<timestamp>.<raw JSON body>` with
`MOTOARK_ORDER_WEBHOOK_SECRET`. The payload uses stable `eventId`, external
order/line IDs, and increasing `orderVersion`. Supported events include
`order.paid`, `order.shipped`, `order.cancelled`, `return.requested`,
`return.received`, `return.restocked`, `return.disposed`, and
`refund.completed`. See the
[lifecycle contract](../architecture/MOTOARK_ORDER_LIFECYCLE.md) for the
complete DTOs, event examples, retry rules, permission requirements, and stock
invariants.

HTTP 202 means the event was durably accepted. Check
`GET /api/integrations/motoark/order-events/:eventId` until its status is
`applied`, `pending`, or `rejected`; an unmapped listing or insufficient
verified warehouse stock remains pending. Synthetic mirror listings are
rejected. Do not infer opening warehouse balances from eBay quantity.

Read the warehouse-derived advertised quantity and marketplace mirror state
with `GET /api/integrations/motoark/quantities/:listingId`. Unmapped/ambiguous
items return `mapped: false` and `quantityAvailable: null`. Production still
has no inventory mapping in the checked 200-row active Primemotive sample, and
global marketplace stock pushing is disabled. After verified warehouse counts
and mappings exist, marketplace pushes still require both the global and
store-level flags; enabling those is a separately reviewed operational step.

## Synthetic test listings and test plan

Production contains 10 marked fixtures with `isTestListing: true`:

| eBay item ID | SKU |
|---|---|
| `SIM-PRIME-01` through `SIM-PRIME-10` | `PM-SIM-01` through `PM-SIM-10` |

These rows exist in the RealTrackApp database mirror only. They are not live
eBay listings and cannot be purchased on eBay. The simulator can change the
price or available quantity of a random fixture without calling eBay; its
scheduled production behavior was not separately verified during the
2026-11-03 rollout. The rows are visible in the Primemotive API feed so MotoArk can validate its
upsert and change-consumer behavior. Keep `isTestListing` visible in MotoArk and
exclude these fixtures from production order fulfillment and reporting.

Recommended MotoArk acceptance sequence:

1. Authenticate with the dedicated integration login and confirm the expected
   permissions using `/api/auth/me`.
2. Import every page from the Primemotive feed. Confirm the response `total`,
   upsert by `id`, and mark `isTestListing` rows as test-only.
3. Identify a `SIM-PRIME-*` fixture, record its current quantity and price, then
   poll `/changes` after a minute. Confirm a `listing.updated` event is applied
   once to the matching MotoArk row. Reprocess the same `eventId` and confirm
   the operation is idempotent.
4. Verify `GET /api/integrations/motoark/quantities/:listingId`; a fixture
   without a warehouse mapping should return a null available quantity.
5. Use a synthetic-only signed event in the sandbox and verify its durable
   event status, duplicate handling, payload conflict, and signature rejection.
   Production verification confirmed synthetic lifecycle events create no
   order or stock movement.
6. If testing the legacy `listing.sold` route, confirm its receipt and exact
   retry only. It does not change inventory.
7. After MotoArk supplies its HTTPS callback URL and the outbound secret is
   configured, return `2xx` from the callback after durable acceptance and
   confirm event deduplication under retries.

The API response count is dynamic. The measured production count, fixture
behavior, and deployment details are recorded in
[`CURRENT_STATE.md`](../context/CURRENT_STATE.md) and the
[deployment record](../architecture/DEPLOYMENT.md).

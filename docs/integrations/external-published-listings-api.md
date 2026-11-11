# External Published Listings API Guide

**Reviewed:** 2026-10-15
**Audience:** External applications that need read-only access to published eBay listings.

> **Runtime correction 2026-11-02:** The current backend image
> `realtrackapp-backend:ebay-revise-00aad7cd` does not contain the dedicated
> Primemotive routes/sender; its October migration and inbound secret remain.
> Production descriptions dated 2026-10-15 below are historical. The local
> [lifecycle candidate](../architecture/MOTOARK_ORDER_LIFECYCLE.md) restores the
> feed/receipt routes and adds the new contract; rollout is pending.

> **Source assessment 2026-11-02:** Sale receipt supports only `listing.sold`,
> with no order or stock effects. Its sequential duplicate lookup has no atomic
> concurrent-event uniqueness guarantee. The standard Compose configuration
> does not forward the inbound sales secret. See the
> [MotoArk lifecycle gap analysis](motoark-order-lifecycle-gap-analysis.md)
> for confirmed gaps and proposed fixes; the proposed routes are not released.

> **Production status:** Backend image
> `realtrackapp-backend:primemotive-feedback-20261015-r5` is live with the
> all-listings Primemotive feed, change endpoint, and paged CSV export. Listing
> webhook delivery is deployed but not configured; polling is available now.
> For MotoArk's rollout count, sync order, test fixtures, and acceptance steps,
> see the [MotoArk Primemotive integration guide](motoark-primemotive-api.md).

## Verification result

The published-listings API reads its data from the RealTrackApp database; it does not query eBay when an external application requests a feed page. The production feed returns database records for listings on the **Primemotive** store that have an eBay item ID (published) and `listingStatus=active` in RealTrackApp, with no make item-specific filter. On 2026-10-15, its measured total was 91,496 active records, including the 10 marked synthetic fixtures. Its payload does **not** contain the complete normalized Partslink24 schema in `schema.sql`. It contains partial listing, part-number, item-specific, and eBay vehicle-compatibility data; several schema tables and fields are not represented by this API.

Use this API as a feed of published marketplace listings. Do not treat it as a complete source for loading the `schema.sql` catalog tables. The field-by-field comparison is below.

## Connection

**Production origin:** `https://app.omnicoreholding.com`
**API prefix:** `/api`

All requests use HTTPS. The EC2 hostname/IP and SSH key are for server administration; API clients should use the HTTPS base URL above. The application API uses JWT bearer authentication. There is no separate API-key endpoint.

1. Ask the Omni Core administrator for a dedicated integration login and deliver the password through an approved secret-sharing channel. The account needs `published_listings.external_feed` to read the Primemotive feed, `published_listings.export` for CSV export, and `published_listings.sales.notify` to submit sale events. Do not put credentials in this guide or source control.
2. Log in:

   ```bash
   curl -sS -X POST 'https://app.omnicoreholding.com/api/auth/login' \
     -H 'Content-Type: application/json' \
     -d '{"email":"<integration-email>","password":"<integration-password>"}'
   ```

   The response includes `accessToken`. Keep it secret and send it as a bearer token on protected requests. The token lifetime follows the server's `JWT_EXPIRY_SECONDS` setting (the code default is 14,400 seconds / 4 hours); log in again when it expires.

3. Confirm the account's authorization:

   ```bash
   curl -sS 'https://app.omnicoreholding.com/api/auth/me' \
     -H "Authorization: Bearer $TOKEN"
   ```

   The account must have the `published_listings.view` permission. A read-only listing account should have no publish or management permissions. The existing documented published-listings reader account also had `channels.publish`, `ebay.publish`, and `listings.publish` in production; do not distribute those existing credentials to an external application. Have an administrator provision or correct a least-privilege integration account first. The CSV endpoint separately requires `published_listings.export`.

## Read listing data

Use the JSON list endpoint for application-to-application access:

```http
GET /api/published-listings?page=1&limit=50
Authorization: Bearer <token>
```

Example:

```bash
curl -sS 'https://app.omnicoreholding.com/api/published-listings?page=1&limit=50' \
  -H "Authorization: Bearer $TOKEN"
```

The response is paginated:

```json
{
  "items": [
    {
      "id": "<listing-uuid>",
      "organizationId": "<organization-uuid>",
      "storeId": "<store-uuid>",
      "ebayAccountId": "<account-uuid>",
      "marketplaceId": "EBAY_MOTORS_US",
      "ebayItemId": "<ebay-item-id>",
      "offerId": null,
      "sku": "<seller-sku>",
      "title": "<listing-title>",
      "description": null,
      "categoryId": "<ebay-category-id>",
      "categoryName": "<ebay-category-name>",
      "price": "154.99",
      "currency": "USD",
      "quantityAvailable": 1,
      "quantitySold": 0,
      "listingStatus": "active",
      "listingFormat": "fixed_price",
      "condition": "Used",
      "listingUrl": "https://www.ebay.com/itm/<item-id>",
      "imageUrls": ["https://i.ebayimg.com/<image>.jpg"],
      "itemSpecifics": {
        "Brand": ["<brand>"],
        "Manufacturer Part Number": ["<part-number>"]
      },
      "shippingDetails": null,
      "listingPolicies": null,
      "compatibility": null,
      "performanceMetrics": {},
      "healthFlags": [],
      "location": null,
      "rawEbayResponse": null,
      "accountDisplayName": "<store-or-account-name>",
      "ebayStartTime": null,
      "ebayEndTime": null,
      "ebayLastModifiedAt": null,
      "lastSyncedAt": "<ISO-8601 timestamp>",
      "catalogProductId": null,
      "ebayListingChannelId": null,
      "createdAt": "<ISO-8601 timestamp>",
      "updatedAt": "<ISO-8601 timestamp>"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

Values above illustrate the response shape; they are not a production record. `price` is returned as a decimal string. IDs and timestamps are strings. Optional fields can be `null`; array/object fields can be empty when the source has no data. `itemSpecifics` maps marketplace-specific labels to arrays of strings.

### Listing detail

```http
GET /api/published-listings/{id}
Authorization: Bearer <token>
```

The detail response includes the listing fields above and adds `descriptionHtml`, `descriptionText`, `storeSlug`, `images`, `brand`, `mpn`, `oeNumbers`, and `salvageDetails`. These are derived from the listing's stored description, image URLs, and item specifics. They can be `null` or empty when the marketplace listing has no corresponding data. `salvageDetails` may include donor vehicle, mileage, stock/bin, VIN, condition grade, and tested status only when those labels exist in item specifics.

### Useful filters and pagination

| Parameter | Meaning |
|---|---|
| `page` | 1-based page number; defaults to `1` |
| `limit` | Rows per page; defaults to `50`, maximum `200` |
| `storeId` | Restrict to one store UUID |
| `storeSlug` | Comma-separated eBay store slugs; `all` or `*` requests all connected stores |
| `ebayAccountId` | Restrict to one eBay account UUID |
| `marketplaceId` | Restrict to a marketplace, e.g. `EBAY_MOTORS_US` |
| `offerId` | Match an eBay Inventory API offer ID |
| `status` | `active` (default), `ended`, `out_of_stock`, `unknown`, or `all` |
| `search` | Search supported listing text/identifiers |
| `categoryId`, `condition`, `format` | Restrict by eBay category, condition, or listing format |
| `priceMin`, `priceMax` | Price range |
| `quantityMin`, `quantityMax`, `soldMin` | Quantity/sales filters |
| `listedFrom`, `listedTo` | Listing start-time range |
| `updatedAfter` or `updateAfter` | Return mirror records whose database `updatedAt` is at or after this ISO-8601 timestamp; `updateAfter` is a compatibility alias |
| `includeCatalogData` | Set to `true` to include the linked RealTrackApp `catalog_products` source fields under `catalogData`; omitted by default to keep the regular feed payload compact |
| `sortBy`, `sortDir` | Sort key and `asc` / `desc` direction |

Without `storeId` or `storeSlug`, the list currently defaults to the SalvageA and Blackline store slugs. Use `storeSlug=all` for all stores, or pass an explicit store filter. The deployment may configure the default slug list.

The default `status=active` is a live, buyable view: results must have quantity above zero, an active eBay connection, and a recent successful sync. Use `status=out_of_stock` for zero-quantity live offers, or `status=all` when ended and other retained rows are needed. Page through results until the requested page is empty; the maximum page size is 200.

## Requested export scope: Primemotive only

Use the dedicated `GET /api/published-listings/primemotive` feed. It reads only RealTrackApp database rows whose publication record points to the exact Primemotive eBay store in the authenticated organization, has a non-empty eBay item ID, and has `listingStatus=active`. The feed does not filter by Make, Vehicle Make, Brand, Manufacturer, or Marque item specifics and does not infer make from title or SKU. MotoArk is responsible for identifying its target Mercedes parts. The route cannot return Blackline, Salvage, Superior, or another store's publications, and caller filters such as `status=all` cannot broaden its active/published scope. This route requires `published_listings.external_feed`.

The API resolves the Primemotive store record by its database store name and eBay channel for the authenticated organization, then applies that record's `storeId` as a mandatory listing constraint. Any caller-provided `storeId` or `storeSlug` is ignored on this route. If no matching store exists, the API returns `404`; if duplicate matching store records exist, it returns `409` so the store configuration can be corrected.

The external integration login must be authorized for the organization and the Primemotive store. Additive migrations grant the feed, CSV export, and sale-notification permissions to the `api_published_listings_reader` custom role when that role exists. Confirm the deployed account's effective permissions with `GET /api/auth/me`. The reader-safe discovery endpoint remains available to inspect store IDs:

```http
GET /api/published-listings/stores
Authorization: Bearer <token>
```

For a paginated JSON export, call the dedicated route:

```bash
curl -G 'https://app.omnicoreholding.com/api/published-listings/primemotive' \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'status=active' \
  --data-urlencode 'page=1' \
  --data-urlencode 'limit=200'
```

The dedicated feed always returns rows marked `active` in the RealTrackApp database and with a non-empty eBay item ID. Query parameters cannot include ended, unpublished, or other-store rows. `updatedAfter` and the compatibility spelling `updateAfter` filter the database mirror's `updatedAt` timestamp. Increment `page` until the requested rows in `total` have been collected. The response envelope and listing attributes are the same as the general list endpoint. Synthetic test rows, when seeded, have `isTestListing: true` and synthetic `SIM-PRIME-*` item IDs.

To include source catalog fields for linked products, add `includeCatalogData=true`:

```http
GET /api/published-listings/primemotive?includeCatalogData=true&page=1&limit=200
Authorization: Bearer <token>
```

When a listing has a linked `catalogProductId`, the response adds a `catalogData` object containing catalog identifiers, descriptive fields, stored attributes, category labels, and explicitly MVL-validated fitment rows. Unvalidated, `needs_review`, and rejected fitment rows are omitted. Only catalog rows owned by the same organization or legacy rows with no organization ID are included; an absent, missing, or other-organization catalog record produces `catalogData: null`. The fields retain their RealTrackApp source meaning; this object is not a claim that their values have been validated against Partslink24 natural keys. This option is also supported on the general listing feed and `GET /api/published-listings/{id}?includeCatalogData=true`.

Example of the additional object (values are illustrative):

```json
{
  "catalogData": {
    "source": "RealTrackApp.catalog_products",
    "identifiers": {
      "sku": "<seller-sku>",
      "mpn": "<stored-mpn>",
      "mpnNormalized": "<normalized-mpn>",
      "upc": null,
      "ean": null,
      "epid": null,
      "oemPartNumber": "<stored-oem-number>"
    },
    "product": {
      "title": "<catalog-title>",
      "brand": "<brand>",
      "partType": "<part-type>",
      "placement": null,
      "material": null,
      "features": null,
      "countryOfOrigin": null
    },
    "attributes": {
      "weight": null,
      "verticalAttributes": {}
    },
    "category": {
      "id": "<catalog-category-id>",
      "name": "<catalog-category-name>",
      "source": "RealTrackApp.catalog_products"
    },
    "fitment": {
      "validation": "none",
      "validatedRows": []
    }
  }
}
```

### Keep listing details current and detect removals

The listing feed's `updatedAfter` filter returns current active listing rows. Use the separate change feed to retrieve additions, edits, and removals, including records that no longer exist in the mirror:

```http
GET /api/published-listings/primemotive/changes?updatedAfter=2026-10-12T00%3A00%3A00.000Z&page=1&limit=200
Authorization: Bearer <token>
```

`updatedAfter` is required and inclusive; `updateAfter` is accepted as a compatibility alias. Continue through all pages in `total` before saving `nextUpdatedAfter` as the next watermark. The response is ordered oldest first and includes stable `eventId`, `eventType` (`listing.added`, `listing.updated`, or `listing.removed`), `occurredAt`, `listingId`, and the listing snapshot. Deduplicate by `eventId`. A removed snapshot has `listingStatus: "removed"`; an eBay full sync that marks a missing item `ended` also emits a removal event.

The server can also push these same events to one configured HTTPS callback URL. Configure `PRIMEMOTIVE_LISTING_WEBHOOK_URL` and `PRIMEMOTIVE_LISTING_WEBHOOK_SECRET` on the backend. Delivery starts within about 15 seconds, signs the exact JSON body as `<timestamp>.<body>` using HMAC-SHA256, and sends `X-Primemotive-Timestamp`, `X-Primemotive-Signature: sha256=<hex>`, and `X-Primemotive-Event-Id`. Failed responses retry with exponential backoff. The callback should respond with a 2xx status and deduplicate by `eventId`. Keep the shared secret in the server and receiver secret stores; never include it in a request.

Example outbound event:

```json
{
  "eventId": "<stable UUID>",
  "eventType": "listing.updated",
  "occurredAt": "2026-10-14T09:30:00.000Z",
  "organizationId": "<organization UUID>",
  "storeId": "<Primemotive store UUID>",
  "listingId": "<published-listing UUID>",
  "listing": {
    "id": "<published-listing UUID>",
    "ebayItemId": "SIM-PRIME-01",
    "sku": "PM-SIM-01",
    "price": "47.50",
    "currency": "USD",
    "quantityAvailable": 4,
    "listingStatus": "active",
    "isTestListing": true
  }
}
```

### Synthetic integration listings

After applying migrations, seed 10 marked test records for the target organization with `npm run seed:primemotive-dummies -- <organization-uuid>`. This inserts database mirror rows only; it makes no eBay API calls. Set `PRIMEMOTIVE_SIMULATION_ENABLED=true` and `PRIMEMOTIVE_SIMULATION_ORGANIZATION_ID=<organization-uuid>` to have the backend change one random test listing's price or quantity each minute. The test records appear in the Primemotive feed with `isTestListing: true`; the change feed and configured outbound webhook receive the generated events. Keep simulation disabled outside the integration test window.

### Report a sale from the external application

When the external source completes a sale, it should POST one event for each sale line to:

```http
POST /api/published-listings/primemotive/webhooks/sales
Authorization: Bearer <token>
X-Primemotive-Timestamp: <10-digit Unix timestamp in seconds>
X-Primemotive-Signature: sha256=<hex HMAC-SHA256>
Content-Type: application/json
```

The integration account needs `published_listings.sales.notify`. The signature is HMAC-SHA256 using `PRIMEMOTIVE_SALES_WEBHOOK_SECRET` over the exact bytes of `<timestamp>.<raw request body>`. Timestamps must be 10-digit Unix seconds within five minutes of server time. Keep the secret in the external application's secret manager and the server environment; never send it in a request. Serialize the JSON body once and sign those exact bytes (do not reformat it between signing and sending).

Example signature generation in Node.js:

```js
const crypto = require('node:crypto');
const timestamp = Math.floor(Date.now() / 1000).toString();
const rawBody = JSON.stringify(event);
const signature = `sha256=${crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex')}`;
```

Example event body:

```json
{
  "eventType": "listing.sold",
  "eventId": "external-order-9281-line-1",
  "listingId": "<id returned by the feed>",
  "soldAt": "2026-10-12T10:15:00.000Z",
  "quantity": 1,
  "externalOrderId": "external-order-9281",
  "unitPrice": 154.99,
  "currency": "USD"
}
```

`eventId` must be stable across retries. The server validates that `listingId` belongs to the authenticated organization and Primemotive store, checks the signature, and records the event. A previously found event ID returns `duplicate`; a new event returns `accepted`. This lookup does not protect against simultaneous duplicate inserts or detect a changed payload under the same ID (source review 2026-11-02). Read recorded events with `GET /api/published-listings/primemotive/sales-events?page=1&limit=50` (`published_listings.view`). The webhook accepts only `listing.sold` and records a sale notification only; it does not decrement inventory or revise an eBay listing quantity. Cancellations, returns, and refunds require the additional lifecycle implementation described in the assessment.

Store discovery and sync health are also available:

```http
GET /api/published-listings/stores
GET /api/published-listings/sync-status
```

### CSV export

`GET /api/published-listings/export` returns CSV, not the JSON contract above. It requires `published_listings.export`, applies the same filters, defaults to `status=all`, and returns up to 10,000 rows per page. `page=1` exports rows 1–10,000 and `page=2` exports rows 10,001–20,000 in the same stable sort order. Continue increasing `page` until the file contains fewer than 10,000 rows. The downloaded filename includes the page number.

## Comparison with `schema.sql`

The attached schema models a Partslink24 Mercedes-Benz catalog with normalized vehicle hierarchy, assemblies, parts, specifications, links, restrictions, and fitment details. The API models live eBay listing records. Similar labels do not make the values interchangeable: a seller SKU, listing title, or eBay compatibility value is not a canonical Partslink24 key.

| `schema.sql` table and fields | API representation | Match |
|---|---|---|
| `vehicle_type(code, name)` | No vehicle-type code/name fields | Missing |
| `make(code, name)` | Feed does not filter by make; optional `catalogData.fitment` may contain raw free-form makes | Partial; the feed does not provide canonical make code `MB` |
| `series(code, make_code, vehicle_type_code, class, class_label, production_from, production_to)` | No series/code or production-range fields | Missing |
| `model(code, series_code, name, production_from, production_to)` | `compatibility` and optional `catalogData.fitment` may contain free-form vehicle application properties | Partial; no Partslink24 model/series codes or model production dates |
| `assembly(code, kind, designation, caption)` | No assembly data | Missing |
| `model_assembly(model_code, assembly_code)` | No model-to-assembly relation | Missing |
| `main_group(code, name, owner)` | No main-group fields | Missing |
| `category(id, main_group_code, sub_code, name, is_optional_equipment)` | `categoryId`/`categoryName` and optional `catalogData.category` expose stored marketplace/catalog category labels | Partial; those IDs/names are not validated Partslink24 category keys |
| `part(partno, display, name, is_colour_family)` | `sku`, `title`, detail `mpn`/`oeNumbers`, and optional `catalogData.identifiers`/`catalogData.product` | Partial; seller SKU/MPN/OE values are not guaranteed to equal canonical part number/display/name; no colour-family flag |
| `attribute(id, name, unit)` and `part_attribute(partno, attribute_id, value)` | `itemSpecifics` plus optional `catalogData.attributes.weight` and `verticalAttributes` | Partial; no stable attribute IDs or units, and the catalog weight field has no unit |
| `part_link(partno, kind, related_partno, seq)` | Detail `oeNumbers` and optional `catalogData.identifiers.oemPartNumber` may expose source cross-references | Partial; no validated link kind (`replaced_by`, `alternative`, `optional`) or sequence |
| `restriction(id, text)` | No structured restrictions table or field | Missing |
| `fitment(partno, model_code, always_fits)` | `compatibility` and optional `catalogData.fitment.validatedRows` contain marketplace/source application records | Partial; no canonical part/model keys or `always_fits` flag |
| `fitment_detail(id, partno, model_code, category_id, qty, remark, restriction_id, assembly_code, market_note)` | Raw compatibility and catalog fitment rows may contain year/make/model/trim/engine or source-specific fields | Partial; category, quantity, remark, restriction, assembly, and market-note semantics are not guaranteed |
| Marketplace commerce fields (`price`, `currency`, `quantityAvailable`, `quantitySold`, `listingStatus`, `listingUrl`) | Present on the listing payload | No target columns; the SQL schema deliberately omits commercial listing fields |

### Can RealTrackApp fill the gaps?

Not from the attached `schema.sql` file alone. It is DDL only: it defines tables, columns, keys, and constraints, but contains no `INSERT` statements or catalog rows. It can guide the target contract, but it cannot provide the missing Mercedes catalog values.

RealTrackApp does have a linked `catalog_products` record for some listings. With `includeCatalogData=true`, the API exposes its persisted SKU/MPN/OEM identifiers, brand and product descriptors, stored attributes, source category, and only explicitly MVL-validated fitment rows under `catalogData`. Review-only, rejected, and untagged fitment rows are excluded. Rows without an accessible linked catalog record return `catalogData: null`. This improves coverage while retaining source provenance; it does not create canonical Partslink24 keys or relations.

| Schema gap | Potential RealTrackApp source | Safe to populate as schema values now? |
|---|---|---|
| `part.partno`, `display`, `name` | `catalogData.identifiers.mpn` / `oemPartNumber`, `catalogData.product.title` / `partType` | No. Preserve as source identifiers/labels; validate against the Partslink catalog before assigning canonical `partno` or `display`. |
| `attribute` / `part_attribute` | `catalogData.attributes.weight` and `verticalAttributes` | Partial only. Weight's unit is not recorded on the catalog field, and dimensions/normalized attribute IDs are not guaranteed. |
| `part_link` | Listing OE numbers and `catalogData.identifiers.oemPartNumber` | Partial only. Link kind and sequence are not reliably represented. |
| `fitment` / `fitment_detail` | `catalogData.fitment.validatedRows` and eBay `compatibility` | Only explicitly MVL-validated application rows are exposed; they still do not guarantee Partslink model codes, category IDs, quantities, restrictions, assemblies, or `always_fits`. |
| `model`, `series`, `assembly`, `category`, `restriction` | No equivalent canonical reference entities identified in the RealTrackApp catalog model | No. These require the corresponding reference/catalog dataset and validated mappings. |

**Conclusion:** we can close some payload gaps by adding a provenance-preserving projection of the linked RealTrackApp catalog record. A schema-complete Partslink24 export requires actual catalog data and explicit crosswalks; `schema.sql` alone is not that data. Keep marketplace fields and source catalog values distinct from canonical Partslink24 values, and do not infer keys, dates, restrictions, or relations from listing text.

## Validation notes

The response contract and field comparison above were checked against the controller, DTO, service, entity, and response formatter. The production deployment uses `realtrackapp-backend:primemotive-feedback-20261015-r5`; `/api/health` returned HTTP 200 locally and publicly, unauthenticated protected-route checks returned 401/403, and the database contains 91,496 rows matching the feed's active Primemotive filters at the verification time. MotoArk's dedicated login, successful authenticated requests from its network, and consumer-side processing still need confirmation with the integration team. Outbound listing push remains inactive until MotoArk supplies an HTTPS callback URL and the server signing secret is configured. The number of eligible listings with linked catalog products has not been measured.

Relevant implementation files: `backend/src/published-listings/published-listings.controller.ts`, `backend/src/published-listings/services/published-listings.service.ts`, `backend/src/published-listings/entities/ebay-published-listing.entity.ts`, `backend/src/published-listings/published-listings-response.util.ts`, and `backend/src/published-listings/dto/published-listings.dto.ts`.

> ⚠️ LEGACY REFERENCE — Superseded by /docs/architecture/INTEGRATIONS.md. Preserved for reference.

# eBay multi-store architecture

## Overview

RealTrackApp treats the **internal catalog** as the source of truth for SKU, quantity, price, images, fitment, and descriptions. Each connected eBay seller account is a **sales channel**. Published rows are tracked in `ebay_listing_channels` (per organization, catalog product, eBay account, and marketplace).

OAuth connects accounts via the official authorization code flow. Access and refresh tokens are stored **encrypted** in `ebay_oauth_tokens` and mirrored into legacy `channel_connections.encrypted_tokens` so existing `EbayAuthService` / `EbayPublishService` paths keep working during migration.

## OAuth flow

1. **POST** `/api/integrations/ebay/oauth/start` — validates org membership, creates Redis-backed OAuth `state`, returns `{ authUrl }`. Frontend redirects the browser to eBay.
2. User consents on eBay; eBay redirects to **GET** `/api/integrations/ebay/oauth/callback?code=&state=`.
3. Backend validates `state`, exchanges `code` for tokens, creates/updates `ChannelConnection`, `Store`, `ConnectedEbayAccount`, `EbayOAuthToken`, default `EbayAccountMarketplace`, writes `listing_action_logs`, redirects to `FRONTEND_BASE_URL` with query params (success or error). **Tokens are never returned in JSON to the client.**

## Database schema (multi-account)

Core tables (TypeORM migration `1775200000000-EbayMultiAccountIntegration`):

| Table | Role |
|-------|------|
| `internal_stores` | Optional logical store linked to a connection |
| `connected_ebay_accounts` | One row per connected seller; FK to `channel_connections` and `stores` |
| `ebay_oauth_tokens` | Encrypted tokens + scopes + expiry |
| `ebay_account_marketplaces` | Per-marketplace defaults (policies, location key) |
| `ebay_business_policies` | Cached payment / return / fulfillment policies |
| `listing_store_overrides` | Per-product per-account overrides |
| `ebay_listing_channels` | Channel copy: offer/listing ids, status, price/qty on channel |
| `ebay_listing_jobs` / `ebay_listing_job_targets` | Batch publish tracking |
| `ebay_api_errors` | Structured API failures |
| `listing_action_logs` | Audit trail |
| `inventory_movements` | Quantity changes (manual, sale, sync, etc.) |

Indexes exist on `organization_id`, `ebay_account_id`, `marketplace_id`, `catalog_product_id`, `listing_id`, `offer_id`, `ebay_inventory_sku`, `connection_status`, `listing_status` where applicable.

## Token security

- **Encryption:** `TokenEncryptionService` uses `TOKEN_ENCRYPTION_KEY` (preferred) or `CHANNEL_ENCRYPTION_KEY`.
- **Runtime:** `EbayAccountTokenService.getValidAccessToken()` decrypts only in-process, refreshes when near expiry, uses Redis lock `ebay-token-refresh:{ebayAccountId}` to avoid parallel refresh storms.
- **Failure:** Permanent refresh failure sets `reconnect_required` / connection status as appropriate.
- **Logging:** Never log access tokens, refresh tokens, authorization codes, or client secrets.

## Listing publish flow

1. Client calls **POST** `/api/ebay/listings/validate` or publish after validation.
2. **POST** `/api/ebay/listings/publish` validates each target; **eligible** targets get an `ebay_listing_job` row and one `ebay_listing_job_target` each, then BullMQ jobs on `ebay-listing-publish`. Targets that fail validation are returned as `skippedTargets` and are not enqueued.
3. Worker (`EbayListingPublishProcessor`) re-validates server-side, aligns store marketplace config, calls `ListingBuilderService` → `EbayPublishService`, upserts `ebay_listing_channels`, aggregates job status.
4. Targets succeed or fail **independently**.

Durable targets keep the submitted listing row ID in
`result_payload.sourceListingId`; the worker uses that row as the publish source
even when the target FK points at a canonical catalog product. Stored titles are
published as reviewed (with only eBay-length truncation). Row shipping, payment,
and return profile names resolve independently against each target account; an
unresolved or incompatible explicit profile fails that target instead of using
an unrelated default.

## Queue architecture

Registered queues include `ebay-listing-publish` and reserved names for validation, revision, ending, policy sync, order sync, and inventory sync. Workers should be extended to match the full matrix in the product spec.

## Marketplace validation

`EbayListingValidationService` and `EbayMarketplaceConfigService` centralize marketplace rules (currency, locale, Motors fitment flags, DE localized description requirement). **Do not** reuse US category IDs or policies on DE/AU/GB.

## Business policies and publish guard

- **POST** `/api/integrations/ebay/accounts/:id/sync-policies?organizationId=` — uses Sell Account API (`/sell/account/v1/*_policy`) plus Inventory locations (`/sell/inventory/v1/location`) with the account’s OAuth token and correct sandbox/production base URL. Deletes prior cached rows for that account+marketplace, inserts `ebay_business_policies`, and fills missing defaults on `ebay_account_marketplaces` when still null (first policy, preferring eBay default labels; first merchant location).
- **GET** `/api/integrations/ebay/accounts/:id/policies?organizationId=` — account metadata plus cached policies for the mapping UI.
- **PATCH** `/api/integrations/ebay/accounts/:id/default-policies?organizationId=` — body includes `marketplaceId` and optional `defaultPaymentPolicyId`, `defaultReturnPolicyId`, `defaultFulfillmentPolicyId`, `defaultInventoryLocationKey`.

Validation treats missing marketplace row, missing fulfillment/payment/return defaults, or missing inventory location key as **blocking errors** (not warnings). `ListingBuilderService` copies those IDs into `PublishRequest` (with optional per-listing `policyOverrides` JSON). `EbayMultiStoreListingService.createPublishJob` validates each target and **only enqueues eligible stores**; blocked combinations are returned as `skippedTargets` (and if none are eligible, the API returns **400** with `failures`).

Named row policies take precedence over configured marketplace defaults and are
resolved per target account. Cache misses are refreshed through eBay before
publishing; explicit names never silently fall back. Request-scoped policy IDs
must not overwrite the marketplace default columns.

## Inventory sync model (intended)

- Catalog `quantity_available` remains authoritative.
- Strategies (shared stock, per-channel caps, end-others-on-sale) should be enforced in inventory services + workers writing `inventory_movements`.
- Full cross-store oversell protection is specified in the product brief; extend workers and order webhooks to complete.

## Error handling

`ebay_api_errors` stores classified failures. UI should show retryable vs non-retryable; only backoff/retry for rate limits, transient 5xx, and similar.

## Audit logs

`listing_action_logs` (and writers in services) record connect, disconnect, publish outcomes, etc., with optional before/after JSON and request IP / user-agent when provided.

## Security rules

- Org-scoped queries on every path; assert eBay account belongs to organization before token use.
- Permission checks via `EbayIntegrationPermissionsService` (maps org roles to connect/publish until a finer RBAC matrix ships).
- Idempotency keys on publish jobs to avoid duplicate channel rows for the same product + account + marketplace.

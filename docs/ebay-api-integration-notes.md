# eBay API integration notes

## APIs used

The codebase integrates with eBay through existing channel services (`EbayAuthService`, `EbayPublishService`, Inventory-related services under `channels/ebay/`) and the new **integrations** layer:

- **OAuth** — authorization code grant; token endpoint for refresh.  
- **Identity** — seller identity after connect (wired through integration OAuth callback flow).  
- **Account API** — business policies (sync service stub; extend for full policy pull).  
- **Inventory API** — create/replace inventory items, offers, publish offer.  
- **Taxonomy / Metadata / Fulfillment** — use existing `ebay-*-api.service` modules where present; add dedicated wrappers as needed instead of calling HTTP from controllers.

## Scopes

Set `EBAY_SCOPES` to a space-separated list matching the eBay developer application. Mismatched scopes cause token exchange or API 403 errors.

## Marketplace headers

Inventory and related calls require `X-EBAY-C-MARKETPLACE-ID` and `Content-Language`
(BCP-47 with hyphens, e.g. `en-US` for `EBAY_MOTORS_US`, `de-DE` for `EBAY_DE`).
The catalog publish path (`EbayInventoryApiService`) resolves both from each store's
`ebay_marketplace_id` / `config.marketplace` via `EbayMarketplaceConfigService`.

**Offer body vs header:** RealTrack stores Motors as `EBAY_MOTORS_US` (headers, DB,
policy sync). The Inventory API `createOffer` / `updateOffer` body must use eBay's
`MarketplaceEnum` value `EBAY_MOTORS`. `toEbayInventoryApiMarketplaceId()` in
`ebay-marketplace-headers.util.ts` performs this mapping before POST/PUT `/offer`.

## SellerPundit-linked stores

Stores imported from SellerPundit (`connection_source = sellerpundit` on
`connected_ebay_accounts`) are published from catalog via
`SellerpunditPolicySyncService.ensurePoliciesFresh()` plus
`SellerpunditListingAdapter.publish()` (`/inventory/bulk-create-using-api`).
When SellerPundit returns the known production bug
(`column tokens.marketplaceId does not exist`), `EbayPublishService` automatically
falls back to direct eBay Inventory API using tokens synced from SellerPundit.
Before bulk-create, `SellerpunditListingAdapter` force-refreshes tokens and sends
both `marketplaceId` and `marketPlaceId` (plus `tokenId`) in the request body.
Platform-class failures are tagged `platformError` and never surface as the final
publish error in `auto` mode. Set `SELLERPUNDIT_PUBLISH_FALLBACK=direct_ebay` to
skip the SP endpoint entirely; `sellerpundit` disables fallback. Native OAuth
stores always use `EbayInventoryApiService`.

**Business policy IDs:** SellerPundit `get-all-policies` returns both internal
ids (`policyId` / `id`, short numeric) and eBay REST ids inside
`policy_details.*PolicyId` (long numeric, required by Inventory API).
`sellerpundit-policy-sync.service.ts` persists REST ids via
`extractEbayRestPolicyId()` in `ebay-business-policy.util.ts`. Marketplace
defaults on `ebay_account_marketplaces` are re-written on each sync when missing
or invalid (short ids). Policy sync also overlays eBay Account API lists when the
linked store token has `sell.account` scope. Direct publish calls Account API
before `createOffer` and retries `publishOffer` after `updateOffer` when eBay
rejects fulfillment/shipping policy ids.

**Parts & Accessories return policy:** Per [eBay Seller Center (June 2025)](https://www.ebay.com/sellercenter/news/2025-june/parts-accessories-return-policy),
seller-paid 30-day returns are **mandatory only for New and New Other** fixed-price
P&A listings (US, over $10). **Used** listings may keep buyer-paid return shipping
when returns are accepted and the window is 30+ days. RealTrack applies mandatory
seller-paid rules only when `listingRequiresPartsAccessoriesReturnPolicy()` is true
(marketplace/category scope **and** condition `NEW` / `NEW_OTHER`). Policy sync and
publish (`pickReturnPolicyIdForListing`) prefer compliant policies for New/New Other;
used Motors listings use the normal default (e.g. buyer-paid 30-day policy).
If none exists, `EbayPaReturnPolicyService.ensureCompliantReturnPolicy` runs at
publish time: pick a compliant policy, **upgrade** the closest match (returns
accepted, 30+ days, buyer-paid shipping → seller-paid via Account API
`updateReturnPolicy`), or **create** `P&A Compliant Return (RealTrack)` via
`createReturnPolicy`. The new id is saved to `ebay_business_policies` and
`ebay_account_marketplaces.default_return_policy_id`. Manual Seller Hub edits
are only needed if the token lacks `sell.account` scope or eBay rejects the
update/create call.

**SellerPundit policy gap (`SellerPundit_API_Reference.docx`):** Documents only
five endpoints (login, `get-all-policies`, `get-all-catalogue`, `get-all-tokens`,
`bulk-create-using-api`) with **no response schemas**, no `policy_details` shape,
no `tokenId` / `marketPlaceId` on bulk-create (required in production), no
single-token fetch (publish refreshes via full `get-all-tokens`), no timeout/504
guidance, and no eBay-proxied error shapes. `GET /master/get-all-policies` is
called per type (`shipping` | `payment` | `return`) with `accountName` only.

**What publish fetches (SellerPundit stores):**

| Step | When | Source | Data |
|------|------|--------|------|
| Policies (if DB empty/invalid) | Once per stale account | SP `get-all-policies` ×3 (parallel) | REST policy ids → `ebay_business_policies` + marketplace defaults |
| Policies (cached) | Most publishes | PostgreSQL | `default_*_policy_id` on `ebay_account_marketplaces` |
| Account API overlay | Only if ids still missing | eBay `list*Policies` | Full return metadata when token has `sell.account` |
| eBay user token | When cache expired | SP `get-all-tokens` | OAuth token for direct eBay fallback (not every publish) |
| List | Always | SP `bulk-create-using-api` | Proxies to eBay Inventory/Trading |

**504 Gateway Timeout:** Full catalog publish stacks SP policy sync + token refresh
+ bulk-create (each up to 60–180s). Individual curl tests hit one endpoint; the UI
hits `/api/channels/ebay/publish` synchronously. Mitigations: skip redundant policy
sync when DB defaults are valid, stop forcing `get-all-tokens` every publish,
parallel policy fetch, 504 retry on bulk-create, nginx 600s timeout on publish
routes, and `auto` fallback to direct eBay Inventory API on SP 504/platform errors.

P&A return-policy errors on **used** listings are not blocked locally; mandatory
seller-paid applies to **New / New Other** only. SP 504 / platform errors fall back
to direct eBay in `auto` mode (`SELLERPUNDIT_PUBLISH_FALLBACK`).

**Item condition:** Legacy File Exchange `3000-Used` maps to Inventory API enum
`USED_EXCELLENT` (`ebay-listing-condition.util.ts`). Many Motors P&A categories
reject `USED_GOOD` at `publishOffer` (error `25021`). Direct publish retries once
with `USED_EXCELLENT` when eBay rejects other used enums, and reuses an existing
unpublished offer when `createOffer` returns `25002`.

## Sandbox vs production

- `EBAY_ENV` or per-request `environment` on OAuth start: `sandbox` | `production`.  
- OAuth and API base URLs must match the environment (`EBAY_OAUTH_BASE_URL`, `EBAY_API_BASE_URL` or derived from env).

## Known limitations (current build)

- Policy sync is implemented against Sell Account + Inventory location list APIs; privilege endpoints and deeper policy metadata are not yet surfaced in UI.  
- Not all Bull queues have fully implemented processors (validation-only queue, order sync, etc.).  
- Trading API fallback is not wired unless an existing service already exposes it.

## Trading API fallback

Use **Trading API** only when REST Inventory / Fulfillment cannot satisfy a requirement (legacy flows, specific site quirks). Prefer Inventory API for multi-marketplace listing lifecycle.

## Redirect URI

`EBAY_REDIRECT_URI` must exactly match the RuName / redirect URL registered in the eBay developer portal and should point to:

`GET /api/integrations/ebay/oauth/callback`

## Rate limits

Respect eBay rate limits; use Bull concurrency limits and exponential backoff for retryable errors (`RATE_LIMIT`, `EBAY_SYSTEM_ERROR`).

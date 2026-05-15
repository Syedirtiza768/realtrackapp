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

Inventory and related calls require the correct `X-EBAY-C-MARKETPLACE-ID` (and related headers per eBay docs). The publish path should set marketplace from `EbayMarketplaceConfigService.require(marketplaceId)`.

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

# eBay client onboarding

## What clients do **not** provide

Clients **must not** share:

- eBay account passwords or 2FA codes  
- Browser cookies or manual OAuth tokens  
- eBay developer keys (client id/secret are **platform** configuration in our deployment)

They connect each seller account only through **“Connect with eBay”** (OAuth).

## How to connect an eBay account

1. Sign in to RealTrackApp.  
2. Open **eBay stores** (`/settings/integrations/ebay`).  
3. Enter your **organization UUID** (from your workspace admin).  
4. Choose **display name**, **marketplace** (e.g. eBay Motors US), and **sandbox vs production**.  
5. Click **Connect with eBay** — you are redirected to eBay’s consent screen.  
6. After approval, you return to the app with a success confirmation; the account appears in **Connected accounts**.  
7. Click **Sync policies**, then **Map defaults** (`/settings/integrations/ebay/{accountId}/policies?organizationId=...`) to confirm fulfillment, payment, return, and merchant location keys per marketplace. Publishing is blocked until these are set.

If the connection shows **reconnect required**, run connect again; refresh tokens can expire or be revoked on the eBay side.

## Permissions requested

Scopes are configured via `EBAY_SCOPES` (environment). Typical Inventory / sell flows require account and inventory-related scopes; exact strings must match your eBay developer app configuration.

## Catalog is maintained inside RealTrackApp

- SKU, title, brand, MPN, condition, quantity, price, images, fitment, and descriptions live in the **internal catalog**.  
- eBay receives **channel copies** as inventory items + offers + published listings.  
- Clients do **not** treat eBay as the inventory master.

## How products get published

1. Prepare the catalog product (images, price, quantity, category where applicable).  
2. Use **Publish to eBay** at `/catalog/products/{catalogProductId}/publish/ebay` (replace `{catalogProductId}` with the product UUID from the catalog) selecting one or more connected stores, **Validate**, then **Publish (queue)**.  
3. The system validates per store, enqueues jobs, and records results in `ebay_listing_channels`.

## How stock sync works (target state)

- Sales on eBay should reduce catalog quantity and emit `inventory_movements`.  
- For quantity **1** / used parts, **shared stock** mode should end or revise listings on other accounts when stock hits zero (configurable strategy).

## What the client still provides

- Accurate **catalog data** (SKU, fitment, condition, identifiers)  
- **Images** meeting eBay requirements  
- **Fitment** data for Motors (confirmed or clearly labeled confidence)  
- **Pricing** and business rules  
- **Shipping / return / payment preferences** (mapped to eBay business policies after policy sync)  
- **Approvals** for any AI-suggested copy before it becomes overrides

OpenAI may suggest titles or localized text; it is **not** the authority for fitment, compliance, or category choice.

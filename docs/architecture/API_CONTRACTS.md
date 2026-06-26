# API Contracts

> **Source**: Consolidated from `docs/API_MAP.md` (557 lines) and `docs/architecture/api-map.md` — 2026-05-29.
> Complete API endpoint reference. All routes under global prefix `/api` (set in `main.ts`).

---

## Base Configuration

- **Global Prefix**: `/api` (set in `main.ts`)
- **Auth**: JWT Bearer token in `Authorization` header
- **Rate Limiting**: 10/s, 100/min, 1000/hr via `ThrottlerGuard`
- **Validation**: Global `ValidationPipe` with `forbidNonWhitelisted: true`
- **CORS**: Configured in `main.ts` from `CORS_ORIGIN` env var
- **Swagger**: Available at `/api/docs` (non-production only)

---

## Authentication

All endpoints require authentication unless marked with `@Public()` decorator.

### Auth Endpoints (Public)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with email/password, returns JWT |
| POST | `/api/auth/register` | Register new user |

### Auth Endpoints (Protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Current user profile + permissions |
| POST | `/api/auth/logout` | Logout (client-side token discard) |
| PATCH | `/api/auth/change-password` | Change current user password (requires currentPassword + newPassword) |
| GET | `/api/auth/organizations` | List user's organizations |

### Auth Response Format

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "uuid", "email": "user@example.com", "name": "User Name", "role": "staff", "permissions": ["listings.view", "listings.create", ...] }
}
```

---

## Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness/readiness check (@Public) |

---

## Listings

**Base**: `/api/listings` | **Permission**: `listings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/listings` | List all listings | listings.view |
| GET | `/api/listings/:id` | Get listing by ID | listings.view |
| POST | `/api/listings` | Create new listing | listings.create |
| PUT | `/api/listings/:id` | Update listing | listings.update |
| DELETE | `/api/listings/:id` | Delete listing | listings.delete |
| GET | `/api/listings/:id/history` | Get revision history | listings.view |
| POST | `/api/listings/:id/generate` | AI-generate listing | listings.generate |

### Listings V2 (Cached)

**Base**: `/api/v2/listings` | `listings.view`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/listings` | Cached listing list |

### Export Rules ⚠️

**Double-prefix**: `/api/api/export-rules`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/api/export-rules` | List export rules | listings.export |
| POST | `/api/api/export-rules` | Create export rule | listings.export |

---

## Catalog Import

### Import

**Base**: `/api/catalog-import` | `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/catalog-import/upload` | Upload CSV file | catalog.import |
| GET | `/api/catalog-import/jobs` | List import jobs | catalog.view |
| GET | `/api/catalog-import/jobs/:id` | Get job status | catalog.view |

### Catalog Products

**Base**: `/api/catalog-products` | `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/catalog-products` | List catalog products | catalog.view |
| GET | `/api/catalog-products/:id` | Get product details | catalog.view |
| PUT | `/api/catalog-products/:id` | Update product | catalog.update |
| DELETE | `/api/catalog-products/:id` | Delete product | catalog.update |

### Compliance

**Base**: `/api/catalog-import/compliance` | `catalog.compliance`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/catalog-import/compliance/check` | Run compliance check |
| GET | `/api/catalog-import/compliance/status` | Get compliance status |

---

## Ingestion & Pipeline

### Ingestion

**Base**: `/api/ingestion` | `ingestion.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/ingestion/upload` | Upload images/files | ingestion.create |
| GET | `/api/ingestion/jobs` | List ingestion jobs | ingestion.view |
| GET | `/api/ingestion/jobs/:id` | Get job status | ingestion.view |

### Pipeline

**Base**: `/api/pipeline` | `pipeline.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/pipeline/run` | Run pipeline job | pipeline.run |
| POST | `/api/pipeline/single-listing/add-part` | Warehouse intake — save OEM, brand, 2+ photos as draft listing | listings.create |
| POST | `/api/pipeline/single` | Submit single listing to enrichment pipeline | pipeline.run |
| GET | `/api/pipeline/single-listing/lookup-pricing` | OpenRouter cost estimates (incl. 15k parts) | listings.create |
| GET | `/api/pipeline/single-listing/next-sku` | Allocate next `BLA-#####` SKU | listings.create |
| GET | `/api/pipeline/single-listing/brands` | Brand/make options (catalog + OEM list); `?q=` filter | listings.create |
| POST | `/api/pipeline/single-listing/part-lookup` | Vision-first when 2+ image URLs provided; OEM text only without photos | inventory.enrich |
| GET | `/api/pipeline/jobs` | List pipeline jobs | pipeline.view |
| GET | `/api/pipeline/jobs/:id` | Get job details | pipeline.view |

### Review Queue

**Base**: `/api/ingestion/review` | `pipeline.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ingestion/review` | List items for review |
| POST | `/api/ingestion/review/:id/approve` | Approve item |
| POST | `/api/ingestion/review/:id/reject` | Reject item |

---

## Motors Intelligence

**Base**: `/api/motors-intelligence` | `motors.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/motors-intelligence` | List motors products | motors.view |
| GET | `/api/motors-intelligence/:id` | Get product details | motors.view |
| POST | `/api/motors-intelligence/upload` | Upload for AI processing | motors.manage |
| POST | `/api/motors-intelligence/:id/extract` | Extract attributes | motors.manage |

### Review Queue

**Base**: `/api/motors-intelligence/review` | `motors.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/motors-intelligence/review` | List review tasks |
| POST | `/api/motors-intelligence/review/:id/approve` | Approve extraction |
| POST | `/api/motors-intelligence/review/:id/correct` | Submit correction |

---

## Fitment

**Base**: `/api/fitment` | `fitment.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/fitment/makes` | List vehicle makes | fitment.view |
| GET | `/api/fitment/models` | List models for make | fitment.view |
| GET | `/api/fitment/years` | List years for model | fitment.view |
| GET | `/api/fitment/submodels` | List submodels | fitment.view |
| POST | `/api/fitment/import` | Import fitment data | fitment.manage |
| GET | `/api/fitment/vin/:vin` | Lookup VIN | fitment.view |

---

## Channels

**Base**: `/api/channels` | `channels.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/channels` | List channel connections | channels.view |
| POST | `/api/channels` | Create channel connection | channels.connect |
| GET | `/api/channels/:id` | Get channel details | channels.view |
| PUT | `/api/channels/:id` | Update channel | channels.manage |
| DELETE | `/api/channels/:id` | Delete channel | channels.manage |

### Stores

**Base**: `/api/stores` | `stores.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/stores` | List stores | stores.view |
| POST | `/api/stores` | Create store | stores.manage |
| GET | `/api/stores/:id` | Get store details | stores.view |
| PUT | `/api/stores/:id` | Update store | stores.manage |

### eBay Publish

**Base**: `/api/channels/ebay` | `ebay.publish`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels/ebay/publish` | Publish listing to one or more stores (full PublishDto) |
| POST | `/api/channels/ebay/publish-batch` | Batch publish multiple payloads |
| POST | `/api/channels/ebay/publish-by-listings` | Publish by listingIds + storeIds; server enriches |
| PATCH | `/api/channels/ebay/offers/price-quantity` | Update price/qty on live offers |
| DELETE | `/api/channels/ebay/offers/:offerId` | End listing (withdraw offer) |

---

## eBay Integrations

**Base**: `/api/integrations/ebay` | `ebay.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/integrations/ebay` | List connected accounts | ebay.view |
| POST | `/api/integrations/ebay` | Connect new account | ebay.connect |
| GET | `/api/integrations/ebay/:id` | Get account details | ebay.view |
| DELETE | `/api/integrations/ebay/:id` | Disconnect account | ebay.manage |
| POST | `/api/integrations/ebay/:id/sync` | Sync account data | ebay.sync |
| GET | `/api/integrations/ebay/:id/policies` | Get business policies | ebay.view |

### Multi-Store

**Base**: `/api/ebay` | `ebay.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/ebay/stores` | List eBay stores | ebay.view |
| POST | `/api/ebay/stores` | Create store | ebay.manage |
| GET | `/api/ebay/stores/:id` | Get store details | ebay.view |
| PUT | `/api/ebay/stores/:id` | Update store | ebay.manage |
| DELETE | `/api/ebay/stores/:id` | Delete store | ebay.manage |

### OAuth Callback (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/ebay/callback` | eBay OAuth callback (@Public) |

### SellerPundit

**Base**: `/api/integrations/ebay/sellerpundit`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/integrations/ebay/sellerpundit/login` | Login to SellerPundit |
| GET | `/api/integrations/ebay/sellerpundit/stores` | List imported stores |
| POST | `/api/integrations/ebay/sellerpundit/sync` | Sync stores/tokens/policies |
| GET | `/api/integrations/ebay/sellerpundit/config` | Get org-level config |
| PUT | `/api/integrations/ebay/sellerpundit/config` | Update org-level config |

---

## Inventory

**Base**: `/api/inventory` | `inventory.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/inventory/listings` | List workbench parts — one row per SKU (`page`, `limit`, `status`, `search`, `missingImages`) | inventory.view |
| GET | `/api/inventory/listings/:listingId/detail` | Full part detail for modal (fitments, US/AU/DE variants, pipeline job) | inventory.view |
| POST | `/api/inventory/send-to-pipeline` | Build pipeline CSV from selected listings; `forceVision` on photos; returns `{ job, warnings }` | inventory.enrich |
| POST | `/api/inventory/enrich` | Alias for `send-to-pipeline` (deprecated) | inventory.enrich |
| POST | `/api/inventory/part-lookup` | Vision-first fetch details for one listing (OEM + brand + 2+ photos → title, category, SEO notes) | inventory.enrich |
| POST | `/api/inventory/part-lookup/bulk` | Vision-first fetch details for multiple listings | inventory.enrich |
| GET | `/api/inventory/:listingId` | Get inventory ledger for a listing | inventory.view |
| POST | `/api/inventory/:listingId/adjust` | Adjust quantity | inventory.adjust |
| POST | `/api/inventory/:listingId/allocations` | Per-store allocation | inventory.allocate |
| POST | `/api/inventory/reconcile` | Reconcile inventory | inventory.reconcile |

---

## Orders

**Base**: `/api/orders` | `orders.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/orders` | List orders | orders.view |
| GET | `/api/orders/:id` | Get order details | orders.view |
| PUT | `/api/orders/:id` | Update order | orders.update |
| POST | `/api/orders/:id/ship` | Mark as shipped | orders.ship |
| POST | `/api/orders/:id/refund` | Process refund | orders.refund |
| POST | `/api/orders/import` | Import orders | orders.import |

---

## Dashboard & Audit

**Base**: `/api/dashboard` | `dashboard.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/dashboard` | Get dashboard KPIs | dashboard.view |
| GET | `/api/dashboard/sales` | Get sales data | dashboard.view |
| GET | `/api/dashboard/inventory` | Get inventory summary | dashboard.view |

### Audit Logs

**Base**: `/api/audit-logs` | `audit.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/audit-logs` | List audit logs | audit.view |
| GET | `/api/audit-logs/:entity/:id` | Get entity audit trail | audit.view |

---

## Settings

**Base**: `/api/settings` | `settings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/settings` | Get settings | settings.view |
| PUT | `/api/settings` | Update settings | settings.manage |
| GET | `/api/settings/pricing-rules` | Get pricing rules | pricing.view |
| POST | `/api/settings/pricing-rules` | Create pricing rule | pricing.manage |

---

## Client Settings (White-Label)

**Base**: `/api/client-settings` | `client_settings.*` (super_admin only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client-settings` | Get client settings |
| PATCH | `/api/client-settings` | Update settings |
| GET | `/api/client-settings/branding/public` | Get public branding (@Public) |

---

## RBAC Admin

**Base**: `/api/rbac` | `users.*`, `roles.*`

### Users

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/users` | List users | users.view |
| POST | `/api/rbac/users` | Create user | users.create |
| PATCH | `/api/rbac/users/:id/role` | Assign primary role | roles.assign |
| PATCH | `/api/rbac/users/:id/deactivate` | Deactivate user | users.deactivate |
| PATCH | `/api/rbac/users/:id/reset-password` | Admin reset user password | users.reset_password |

### Roles

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/roles` | List roles | roles.view |
| POST | `/api/rbac/roles` | Create role | roles.manage |
| PUT | `/api/rbac/roles/:id` | Update role | roles.manage |
| DELETE | `/api/rbac/roles/:id` | Delete role | roles.manage |
| POST | `/api/rbac/roles/:id/permissions` | Assign permissions | roles.assign_permissions |
| POST | `/api/rbac/users/:id/roles` | Assign roles to user | roles.assign |

---

## Other Modules

### Automation

**Base**: `/api/automation-rules` | `automation.*`

CRUD for automation rules (GET, POST, GET/:id, PUT/:id, DELETE/:id).

### Templates

**Base**: `/api/templates` | `templates.*`

CRUD for listing templates (GET, POST, GET/:id, PUT/:id, DELETE/:id).

### Notifications

**Base**: `/api/notifications` | `notifications.*`

GET list, PUT `/:id/read`, PUT `/read-all`, DELETE `/:id`. WebSocket on `notifications` namespace.

### Storage

**Base**: `/api/storage` | `storage.*`

GET list, POST `/upload`, GET `/:id`, GET `/:id/download`, DELETE `/:id`.

### Feature Flags ⚠️

**Double-prefix**: `/api/api/feature-flags` | `feature_flags.*`

CRUD at `/api/api/feature-flags`. Manage restricted to `feature_flags.manage` (super_admin only).

---

## Known Issues

### Double `/api` Prefix

Two controllers have paths that combine with the global prefix:

| Controller | Declared Path | Effective Path |
|------------|---------------|----------------|
| `feature-flag.controller.ts` | `api/feature-flags` | `/api/api/feature-flags` |
| `export-rule.controller.ts` | `api/export-rules` | `/api/api/export-rules` |

**Action Required**: Verify frontend client calls before fixing.

---

## Frontend API Clients

Located in `src/lib/`:

| Client | File | Base Path |
|--------|------|-----------|
| Auth | `authApi.ts` | `/api/auth` |
| Listings | `listingsApi.ts` | `/api/listings` |
| Catalog | `catalogImportApi.ts` | `/api/catalog-import` |
| Motors | `motorsApi.ts` | `/api/motors-intelligence` |
| eBay | `ebayIntegrationsApi.ts` | `/api/integrations/ebay` |
| Multi-Store | `multiStoreApi.ts` | `/api/ebay` |
| Orders | `ordersApi.ts` | `/api/orders` |
| Inventory | `inventoryApi.ts` | `/api/inventory` |
| Fitment | `fitmentApi.ts` | `/api/fitment` |
| Channels | `channelsApi.ts` | `/api/channels` |
| Settings | `settingsApi.ts` | `/api/settings` |
| RBAC | `rbacApi.ts` | `/api/rbac` |
| Templates | `templateApi.ts` | `/api/templates` |
| Pipeline | `pipelineApi.ts` | `/api/pipeline` |

---

*Consolidated & reorganized: 2026-06-06. Updated: 2026-06-11.*

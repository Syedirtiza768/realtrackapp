# API Map

> Complete API endpoint reference for RealTrackApp.
> All routes are under the global prefix `/api`.
> Swagger UI available at `/api/docs` (non-production).

---

## Base Configuration

- **Global Prefix**: `/api` (set in `main.ts`)
- **Auth**: JWT Bearer token in `Authorization` header
- **Rate Limiting**: 10/s, 100/min, 1000/hr via `ThrottlerGuard`
- **Validation**: Global `ValidationPipe` with `forbidNonWhitelisted: true`
- **CORS**: Configured in `main.ts` from `CORS_ORIGIN` env var

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
| GET | `/api/auth/organizations` | List user's organizations |

### Auth Response Format

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "staff",
    "permissions": ["listings.view", "listings.create", ...]
  }
}
```

---

## Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness/readiness check (@Public) |

---

## Listings

**Base**: `/api/listings`  
**Permission**: `listings.*`

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

**Base**: `/api/v2/listings`  
**Permission**: `listings.view`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/listings` | Cached listing list |

### Export Rules

**⚠️ Double-prefix**: `/api/api/export-rules`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/api/export-rules` | List export rules | listings.export |
| POST | `/api/api/export-rules` | Create export rule | listings.export |

---

## Catalog Import

**Base**: `/api/catalog-import`  
**Permission**: `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/catalog-import/upload` | Upload CSV file | catalog.import |
| GET | `/api/catalog-import/jobs` | List import jobs | catalog.view |
| GET | `/api/catalog-import/jobs/:id` | Get import job status | catalog.view |
| POST | `/api/catalog-import/:id/process` | Process import job | catalog.import |

### Catalog Products

**Base**: `/api/catalog-products`  
**Permission**: `catalog.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/catalog-products` | List catalog products | catalog.view |
| GET | `/api/catalog-products/:id` | Get product details | catalog.view |
| PUT | `/api/catalog-products/:id` | Update product | catalog.update |
| DELETE | `/api/catalog-products/:id` | Delete product | catalog.update |

### Compliance

**Base**: `/api/catalog-import/compliance`  
**Permission**: `catalog.compliance`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/catalog-import/compliance/check` | Run compliance check |
| GET | `/api/catalog-import/compliance/status` | Get compliance status |

---

## Ingestion & Pipeline

### Ingestion

**Base**: `/api/ingestion`  
**Permission**: `ingestion.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/ingestion/upload` | Upload images/files | ingestion.create |
| GET | `/api/ingestion/jobs` | List ingestion jobs | ingestion.view |
| GET | `/api/ingestion/jobs/:id` | Get job status | ingestion.view |

### Pipeline

**Base**: `/api/pipeline`  
**Permission**: `pipeline.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/api/pipeline/run` | Run pipeline job | pipeline.run |
| GET | `/api/pipeline/jobs` | List pipeline jobs | pipeline.view |
| GET | `/api/pipeline/jobs/:id` | Get job details | pipeline.view |

### Image Enrichment

**Base**: `/api/pipeline/images`  
**Permission**: `pipeline.run`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pipeline/images/enrich` | Enrich images with AI |

### Review Queue

**Base**: `/api/ingestion/review`  
**Permission**: `pipeline.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ingestion/review` | List items for review |
| POST | `/api/ingestion/review/:id/approve` | Approve item |
| POST | `/api/ingestion/review/:id/reject` | Reject item |

---

## Motors Intelligence

**Base**: `/api/motors-intelligence`  
**Permission**: `motors.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/motors-intelligence` | List motors products | motors.view |
| GET | `/api/motors-intelligence/:id` | Get product details | motors.view |
| POST | `/api/motors-intelligence/upload` | Upload for AI processing | motors.manage |
| POST | `/api/motors-intelligence/:id/extract` | Extract attributes | motors.manage |

### Review Queue

**Base**: `/api/motors-intelligence/review`  
**Permission**: `motors.review`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/motors-intelligence/review` | List review tasks |
| POST | `/api/motors-intelligence/review/:id/approve` | Approve extraction |
| POST | `/api/motors-intelligence/review/:id/correct` | Submit correction |

---

## Fitment

**Base**: `/api/fitment`  
**Permission**: `fitment.*`

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

**Base**: `/api/channels`  
**Permission**: `channels.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/channels` | List channel connections | channels.view |
| POST | `/api/channels` | Create channel connection | channels.connect |
| GET | `/api/channels/:id` | Get channel details | channels.view |
| PUT | `/api/channels/:id` | Update channel | channels.manage |
| DELETE | `/api/channels/:id` | Delete channel | channels.manage |

### Stores

**Base**: `/api/stores`  
**Permission**: `stores.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/stores` | List stores | stores.view |
| POST | `/api/stores` | Create store | stores.manage |
| GET | `/api/stores/:id` | Get store details | stores.view |
| PUT | `/api/stores/:id` | Update store | stores.manage |

### AI Enhancements

**Base**: `/api/ai-enhancements`  
**Permission**: `listings.view`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai-enhancements` | Request AI enhancement |
| GET | `/api/ai-enhancements/:id` | Get enhancement status |

### eBay Publish

**Base**: `/api/channels/ebay`  
**Permission**: `ebay.publish`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels/ebay/publish` | Publish listing to one or more stores (full `PublishDto`) |
| POST | `/api/channels/ebay/publish-batch` | Batch publish multiple fully-built publish payloads |
| POST | `/api/channels/ebay/publish-by-listings` | Publish by `listingIds` + `storeIds`; server enriches SKU, images, condition, policies |
| PATCH | `/api/channels/ebay/offers/price-quantity` | Update price/qty on live offers |
| DELETE | `/api/channels/ebay/offers/:offerId` | End listing (withdraw offer) |

---

## eBay Integrations

**Base**: `/api/integrations/ebay`  
**Permission**: `ebay.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/integrations/ebay` | List connected accounts | ebay.view |
| POST | `/api/integrations/ebay` | Connect new account | ebay.connect |
| GET | `/api/integrations/ebay/:id` | Get account details | ebay.view |
| DELETE | `/api/integrations/ebay/:id` | Disconnect account | ebay.manage |
| POST | `/api/integrations/ebay/:id/sync` | Sync account data | ebay.sync |
| GET | `/api/integrations/ebay/:id/policies` | Get business policies | ebay.view |

### Multi-Store

**Base**: `/api/ebay`  
**Permission**: `ebay.*`

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

---

## Inventory

**Base**: `/api/inventory`  
**Permission**: `inventory.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/inventory` | List inventory | inventory.view |
| GET | `/api/inventory/:id` | Get inventory details | inventory.view |
| POST | `/api/inventory/:id/adjust` | Adjust quantity | inventory.adjust |
| POST | `/api/inventory/:id/allocate` | Allocate inventory | inventory.allocate |
| POST | `/api/inventory/sync` | Sync inventory | inventory.reconcile |

---

## Orders

**Base**: `/api/orders`  
**Permission**: `orders.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/orders` | List orders | orders.view |
| GET | `/api/orders/:id` | Get order details | orders.view |
| PUT | `/api/orders/:id` | Update order | orders.update |
| POST | `/api/orders/:id/ship` | Mark as shipped | orders.ship |
| POST | `/api/orders/:id/refund` | Process refund | orders.refund |
| POST | `/api/orders/import` | Import orders | orders.import |

---

## Dashboard

**Base**: `/api/dashboard`  
**Permission**: `dashboard.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/dashboard` | Get dashboard KPIs | dashboard.view |
| GET | `/api/dashboard/sales` | Get sales data | dashboard.view |
| GET | `/api/dashboard/inventory` | Get inventory summary | dashboard.view |

### Audit Logs

**Base**: `/api/audit-logs`  
**Permission**: `audit.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/audit-logs` | List audit logs | audit.view |
| GET | `/api/audit-logs/:entity/:id` | Get entity audit trail | audit.view |

---

## Settings

**Base**: `/api/settings`  
**Permission**: `settings.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/settings` | Get settings | settings.view |
| PUT | `/api/settings` | Update settings | settings.manage |
| GET | `/api/settings/pricing-rules` | Get pricing rules | pricing.view |
| POST | `/api/settings/pricing-rules` | Create pricing rule | pricing.manage |
| GET | `/api/settings/shipping-profiles` | Get shipping profiles | settings.view |
| POST | `/api/settings/shipping-profiles` | Create shipping profile | settings.manage |

---

## Client Settings (White-Label)

**Base**: `/api/client-settings`  
**Permission**: `client_settings.*` (super_admin only)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/client-settings` | Get client settings | client_settings.view |
| PUT | `/api/client-settings` | Update settings | client_settings.manage |
| POST | `/api/client-settings/branding` | Update branding | client_settings.branding |
| POST | `/api/client-settings/theme` | Update theme | client_settings.theme |

**Public Branding Endpoint**:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client-settings/branding/public` | Get public branding (@Public) |

---

## RBAC Admin

**Base**: `/api/rbac`  
**Permission**: `users.*`, `roles.*`

### Users

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/users` | List users | users.view |
| GET | `/api/rbac/users/:id` | Get user details | users.view |
| POST | `/api/rbac/users` | Create user | users.create |
| PUT | `/api/rbac/users/:id` | Update user | users.update |
| DELETE | `/api/rbac/users/:id` | Deactivate user | users.deactivate |
| POST | `/api/rbac/users/:id/reset-password` | Reset password | users.reset_password |

### Roles

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/rbac/roles` | List roles | roles.view |
| GET | `/api/rbac/roles/:id` | Get role details | roles.view |
| POST | `/api/rbac/roles` | Create role | roles.manage |
| PUT | `/api/rbac/roles/:id` | Update role | roles.manage |
| DELETE | `/api/rbac/roles/:id` | Delete role | roles.manage |
| POST | `/api/rbac/roles/:id/permissions` | Assign permissions | roles.assign_permissions |
| POST | `/api/rbac/users/:id/roles` | Assign roles to user | roles.assign |

---

## Automation

**Base**: `/api/automation-rules`  
**Permission**: `automation.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/automation-rules` | List automation rules | automation.view |
| POST | `/api/automation-rules` | Create rule | automation.manage |
| GET | `/api/automation-rules/:id` | Get rule details | automation.view |
| PUT | `/api/automation-rules/:id` | Update rule | automation.manage |
| DELETE | `/api/automation-rules/:id` | Delete rule | automation.manage |

---

## Templates

**Base**: `/api/templates`  
**Permission**: `templates.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/templates` | List templates | templates.view |
| POST | `/api/templates` | Create template | templates.manage |
| GET | `/api/templates/:id` | Get template | templates.view |
| PUT | `/api/templates/:id` | Update template | templates.manage |
| DELETE | `/api/templates/:id` | Delete template | templates.manage |

---

## Storage

**Base**: `/api/storage`  
**Permission**: `storage.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/storage` | List assets | storage.view |
| POST | `/api/storage/upload` | Upload file | storage.upload |
| GET | `/api/storage/:id` | Get asset details | storage.view |
| GET | `/api/storage/:id/download` | Download file | storage.view |
| DELETE | `/api/storage/:id` | Delete asset | storage.manage |

---

## Notifications

**Base**: `/api/notifications`  
**Permission**: `notifications.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/notifications` | List notifications | notifications.view |
| PUT | `/api/notifications/:id/read` | Mark as read | notifications.manage |
| PUT | `/api/notifications/read-all` | Mark all as read | notifications.manage |
| DELETE | `/api/notifications/:id` | Delete notification | notifications.manage |

### WebSocket

- **Namespace**: `notifications`
- **Events**: `notification`, `notification:read`
- **Auth**: JWT token in connection handshake

---

## Feature Flags

**⚠️ Double-prefix**: `/api/api/feature-flags`

**Base**: `/api/api/feature-flags`  
**Permission**: `feature_flags.*`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/api/feature-flags` | List feature flags | feature_flags.view |
| POST | `/api/api/feature-flags` | Create flag | feature_flags.manage |
| GET | `/api/api/feature-flags/:id` | Get flag | feature_flags.view |
| PUT | `/api/api/feature-flags/:id` | Update flag | feature_flags.manage |
| DELETE | `/api/api/feature-flags/:id` | Delete flag | feature_flags.manage |

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

API clients are organized by domain in `src/lib/`:

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

## Related Documentation

- **Architecture**: `/docs/architecture/overview.md`
- **Database**: `/docs/architecture/database.md`
- **Auth/RBAC**: `/docs/architecture/auth-rbac.md`
- **Codebase Map**: `/docs/CODEMAP.md`

---

*Last updated: 2026-05-29*

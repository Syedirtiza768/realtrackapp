# Routes & Screens

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Extracted from `docs/FRONTEND_MAP.md` route table (2026-05-29).
> For component details and file paths, see [COMPONENT_MAP.md](COMPONENT_MAP.md).
> For API endpoints backing each screen, see [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).

---

## Route Structure

All protected routes wrapped in `<ProtectedRoute>` and `<Shell>`. Public routes render without Shell.

### Public Routes (No Shell)

| Route | Component | Purpose |
|-------|-----------|---------|

| `/` | `LandingPage` | Public Omni Core overview with links to the Auto Parts, Business & Industrial, and Fashion workspaces |

| `/login` | `LoginPage` | General/Auto Parts login; returns to `/auto-parts` after sign-in |
| `/auto-parts/login` | `LoginPage` | Explicit Auto Parts login; returns to `/auto-parts` after sign-in |
| `/register` | `RegisterPage` | User registration |
| `/forgot-password` | `ForgotPasswordPage` | Password reset request |
| `/channels/ebay/callback` | `EbayOAuthCallback` | eBay OAuth callback |

### Protected Routes (With Shell)

| Route | Component | Permission | Purpose |
|-------|-----------|------------|---------|
| `/auto-parts` | `Dashboard` inside `Shell` | `dashboard.view` | Canonical Auto Parts / automotive application landing page |
| `/listings/new` | `SingleListingPipeline` | `listings.create` | **Add Part** — GridConnect-style intake: part type (OEM/Aftermarket/Salvage), condition (New/Used), brand, part #, price, qty → draft inventory (photos optional; add on Inventory) |
| `/listings/:id/edit` | `ListingEditor` | `listings.update` | Edit listing |
| `/listings/:id/history` | `RevisionHistory` | `listings.view` | View revisions |
| `/catalog` | `CatalogManager` | `catalog.view` | Table-first catalog ops: quick filters, team badges, workflow status, bulk publish/policies; row title opens inventory summary modal |
| `/catalog/products/:id` | `CatalogProductDetail` | `catalog.view` | Full product editor: WYSIWYG preview, images, multi-marketplace, publish |
| `/catalog/import` | `CatalogImportDashboard` | `catalog.import` | CSV import with an explicit Automotive, Business & Industrial, or Fashion vertical selector; vertical is sent with the upload |
| `/catalog/motors-filters` | `CatalogMotorsFiltersPage` | `catalog.view` | Motors filters |
| `/catalog/products/:productId/publish/ebay` | `EbayPublishWizardPage` | `ebay.publish` | Publish to eBay |
| `/ingestion` | `IngestionManager` | `ingestion.view` | Ingestion dashboard |
| `/pipeline` | `PipelinePage` | `pipeline.view` | Team-scoped bulk upload (product vertical + condition + team), pipeline queue table (`UPL-*` IDs, status filter), job detail via `?job=` |
| `/fitment` | `FitmentManager` | `fitment.view` | Fitment management |
| `/fitment/vin` | `VinListingsPage` | `fitment.view` | VIN lookup |
| `/inventory` | `InventoryManager` | `inventory.view` | One row per SKU; upload photos on detail modal; **Fetch details** (vision: OEM+brand+photos) + **Send to pipeline** (`inventory.enrich`) |
| `/bulk-actions` | `BulkActionsPage` | `listings.update` | Bulk operations |
| `/orders` | `OrdersPage` | `orders.view` | Order management |
| `/motors` | `MotorsDashboard` | `motors.view` | Motors intelligence |
| `/motors/upload` | `AIUploadWizard` | `motors.manage` | AI upload |
| `/motors/review` | `ReviewQueue` | `motors.review` | Review queue |
| `/motors/:id` | `MotorsProductDetail` | `motors.view` | Product detail |
| `/automation` | `AutomationRulesPage` | `automation.view` | Automation rules |
| `/templates` | `TemplateManagerPage` | `templates.view` | Listing templates |
| `/notifications` | `NotificationsPage` | `notifications.view` | Notifications |
| `/audit` | `AuditTrailPage` | `audit.view` | Audit trail |
| `/settings` | `SettingsPage` | `settings.view` | General settings; tabs include **Store policies** (`ebay.view` / `ebay.manage` for edit) |
| `/settings/client` | `ClientSettingsPage` | (super_admin) | White-label settings |
| `/settings/users` | `UsersAdminPage` | (implicit) | User management |
| `/settings/permissions` | `PermissionsPage` | (implicit) | Permission management |
| `/settings/ai-routing` | `AiRoutingDashboardPage` | `ai.routing.view` | AI routing stats, policy, optimizer |
| `/settings/integrations/ebay` | `EbayStoresSettingsPage` | `ebay.view` | eBay + SellerPundit import/sync plus per-store vertical pilot configuration |
| `/settings/integrations/ebay/:accountId` | `EbayStoreDetailPage` | `ebay.view` | Store detail |
| `/settings/integrations/ebay/:accountId/policies` | `EbayPolicyMappingPage` | `ebay.manage` | Policy mapping |
| `/sku/:id` | `SkuDetailPage` | `catalog.view` | SKU detail |
| `/preview` | `EbayPreviewPage` | `listings.view` | Listing preview |
| `/image-drive` | `ImageDrivePage` | `image_drive.view` | Google Drive-style file manager; flat folder browser with recursive drag/drop folder upload, automatic part-number subfolder linking, nested-path preservation, pipeline auto-attach, search, sort, bulk select/delete, file preview lightbox, copy URL, download, pagination |

---

## Authentication Flow

## Vertical catalog routes (2026-09-12)

The canonical parity surfaces are `/auto-parts/catalog`, `/business-industrial/catalog`, and `/fashion/catalog`. The B&I and Fashion `/listings` collection routes remain aliases to the shared workspace; their `/listings/editor` and `/fashion/listings/:id[/edit]` routes remain full vertical editors. Both shared surfaces use `CatalogWorkspace` with loading-safe checkbox facets, searchable/collapsible filters, server-side pagination, URL/session persistence, quick view, drag-reorder image management, bulk actions, export, and publish-job progress with per-target errors. Category selections use the facet's stable category ID and imported-to dates are inclusive.

The B&I catalog reuses the Auto Parts catalog's table-first header and action
hierarchy (summary, refresh, export, policy edit, add item, selection bar,
filtered-result feedback, dense results, and created date). Its filter panel is
deliberately vertical-scoped: eBay category, review status, stock, and only
populated B&I attributes. It does not render automotive make/model/fitment
controls or empty legacy import/location/condition facets.

### Automotive modal image mutations

The Auto Parts `CatalogInventoryDetailModal` receives a `listing_records` ID. Reorder/remove uses `PATCH /api/inventory/listings/:listingId/images/reorder`, while newly uploaded images use `PATCH /api/inventory/listings/:listingId/images` with uploaded asset IDs.

### Backend contract

- Fashion: `/api/fashion/catalog/search`, `/search/suggest`, `/search/facets`, `/products/:id`, `/bulk/*`, and `/export`.
- Business & Industrial: `/api/business-industrial/catalog/search`, `/search/suggest`, `/search/facets`, `/summary`, `/products/:id`, `/bulk/*`, `/categories`, and `/export`.
- Both verticals’ catalog responses include only organization/vertical/team-authorized records and publication summaries from accessible stores.

### Login
```
Submit credentials → POST /api/auth/login → Store JWT (localStorage, mk_auth_token) → Store user (mk_auth_user) → Redirect to /
```

### Authenticated Requests
```
fetchWithAuth adds Authorization: Bearer <token> → On 401: clear localStorage, redirect to /login
```

### Logout
```
POST /api/auth/logout (Redis token revocation + audit) → Clear localStorage → Redirect to the vertical login
```

---

## Permission System

### Route-level Protection
```tsx
<ProtectedRoute permissions={['listings.create']}>
  <ListingEditor />
</ProtectedRoute>
```

### Component-level Protection
```tsx
<Can permission="listings.delete">
  <DeleteButton />
</Can>
```

### Hook Usage
```tsx
const { can } = usePermissions();
if (can('listings.delete')) { /* show delete */ }
```

---

*Created: 2026-06-06.*

## Fashion workspace routes (2026-09-09)

Fashion has a separate shell and login boundary rather than reusing the automotive navigation.

| Route | Component | Permission | Purpose |
|-------|-----------|------------|---------|
| /fashion/login | FashionLoginPage | public | Fashion-specific login request |
| /fashion | FashionDashboardPage | fashion.dashboard.view | Fashion metrics and stores |
| /fashion/catalog | FashionCatalogPage | fashion.listings.view | Shared catalog workspace with searchable/collapsible facets, quick view, drag-reorder images, bulk actions, export, and publish progress |
| /fashion/listings | FashionListingsPage | fashion.listings.view | Fashion draft creation/list |
| /fashion/import | FashionImportPage | fashion.import | CSV/XLSX Fashion import |
| /fashion/review | FashionReviewPage | fashion.review | Explicit authenticity approval |
| /fashion/stores | FashionStoresPage | fashion.stores.view | Fashion seller connections and store enablement |
| /fashion/users | FashionUsersPage | fashion.users.manage | Fashion-admin workspace members and roles |

A 401 from a Fashion page preserves the Fashion login route. A Fashion-authenticated user is not given access to automotive routes by this route tree.

## Business & Industrial workspace routes (2026-09-09)

| Route | Component | Permission | Purpose |
|-------|-----------|------------|---------|
| /business-industrial/login | BusinessIndustrialLoginPage | public | Dedicated B&I login surface |
| /business-industrial | BusinessIndustrialDashboardPage | business_industrial.dashboard.view | Metrics and dedicated stores |
| /business-industrial/catalog | BusinessIndustrialCatalogWorkspacePage | business_industrial.listings.view | Shared Auto Parts-style catalog workspace with brand/category/condition/review/stock and populated B&I facets, canonical detail hydration, complete image viewer/lightbox, drag-reorder images, account-aware single validation/publish with connected-store policies/location, bulk store publishing, export, and publish progress |
| /business-industrial/listings | BusinessIndustrialCatalogWorkspacePage | business_industrial.listings.view | Legacy alias to the shared B&I catalog workspace |
| /business-industrial/listings/editor | BusinessIndustrialListingsPage | business_industrial.listings.view | Full technical/certification/inventory/freight editor, seller selection, live eBay leaf-category search, supported conditions, required item specifics, per-target validation, publish-job tracking, and publication end; accepts the edit query parameter from the catalogue |
| /business-industrial/image-intake | BusinessIndustrialImageIntakeWorkspacePage | business_industrial.import | Production image intake workspace for public Google Drive or local folders, organization-scoped background processing, WebP storage, progress/cost visibility, group evidence review, retry, Excel export, and catalog draft creation |
| /business-industrial/import | BusinessIndustrialImportPage | business_industrial.import | B&I CSV/XLSX upload, progress, preview, retry, cancel, and client error report |
| /business-industrial/review | BusinessIndustrialReviewPage | business_industrial.review | Provenance/specification/testing/restricted-category approval and private unit actions |
| /business-industrial/stores | BusinessIndustrialStoresPage | business_industrial.stores.view | Dedicated eBay seller connections, policies, and marketplace configuration |
| /business-industrial/incidents | BusinessIndustrialIncidentsPage | business_industrial.incidents.view | Verified enforcement, remote takedown status/retry, and gated release |
| /business-industrial/users | BusinessIndustrialUsersPage | business_industrial.users.manage | Temporary-password account creation, B&I roles, store assignments, and deactivation |
| /business-industrial/change-password | FashionPasswordPage | authenticated B&I account | Required first-login password change with B&I branding and return path |

The B&I route tree uses a separate shell with an Outlet-based child route tree
and preserves its login path on a 401. It never grants access to automotive or
Fashion permissions.

Business Industrial image intake accepts a public Google Drive folder or a local
directory/drop, previews source images, uploads in API-sized batches, queues
server-side processing, polls AI progress, displays image evidence and warnings
per grouped part, creates a B&I catalog draft, and downloads the Excel export.
The screen clearly labels AI output as reviewable suggestions and
hands drafts into the existing listing/compliance/eBay publish flow.

The screen also accepts a public Google Drive folder URL for the bounded pilot.
It queues the server-side worker, polls the job, shows Luna model/tokens/cost,
and exposes the resulting drafts in B&I Catalog and the shared Inventory
workbench. The Drive importer is capped at 20 item folders and requires the
server-side GOOGLE_DRIVE_API_KEY; it never auto-publishes.

## Unified vertical routing and account switching (2026-09-11)

- `/` is always the public Omni Core landing page.
- Every Auto Parts screen is canonical under `/auto-parts/*`. Historical global
  paths such as `/catalog`, `/inventory`, and `/settings/*` redirect to the
  equivalent prefixed route so saved links remain usable.
- Fashion and B&I remain under `/fashion/*` and `/business-industrial/*`.
- All three authenticated shells expose the same workspace switcher. A user
  with multiple vertical permissions switches without signing in again; every
  shell and access-denied page also offers **Sign out and use another account**.
- Dedicated login screens preserve an authorized deep-link destination. Required
  password setup returns to the current vertical, including Auto Parts at
  `/auto-parts/change-password`.
- Auto Parts settings child routes use the permission keys from
  `SIDEBAR_PERMISSION_MAP`; inventory edit requires both `inventory.view` and
  `listings.update`.

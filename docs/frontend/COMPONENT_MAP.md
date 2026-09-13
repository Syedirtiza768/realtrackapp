# Component Map

> Fashion completion candidate (2026-09-09): see docs/architecture/FASHION_WORKSPACE_COMPLETION.md for route/API changes, scoped services, password_change_required migration and seed variable names, test evidence, deployment procedure, and explicitly unimplemented requirements. This candidate is not yet deployed.

> **Source**: Moved from `docs/FRONTEND_MAP.md` (405 lines, 2026-05-29).
> Complete reference for the React frontend structure.
> For API clients, see [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).
> For routes and screens, see [ROUTES_AND_SCREENS.md](ROUTES_AND_SCREENS.md).

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | ~5.6.2 | Type safety |
| Vite | 6.0.5 | Build tool, dev server |
| Tailwind CSS | 3.4.17 | Styling |
| React Router | 7.1.3 | Routing |
| TanStack Query | 5.90.21 | Server state management |
| Lucide React | 0.474.0 | Icons |
| Axios | 1.14.0 | HTTP client (legacy) |

---

## Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | React entry point, renders `<App />` |
| `App.tsx` | Route table, provider wrapping |
| `index.css` | Global styles, Tailwind directives |

---

## Provider Hierarchy

```
QueryProvider (TanStack Query)
└── AuthProvider (authentication state)
    └── BrandingProvider (white-label theming)
        └── Router (React Router)
            └── Routes
                ├── Public Routes (no Shell)
                │   ├── /login
                │   ├── /register
                │   ├── /forgot-password
                │   └── /channels/ebay/callback
                └── Protected Routes (with Shell)
                    └── ProtectedRoute (auth + permission check)
                        └── Shell (main layout)
                            └── Feature Routes
```

---

## Component Organization

```
src/components/
├── auth/               # Authentication
│   ├── AuthContext.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   └── ProtectedRoute.tsx
├── layout/             # Layout components
│   ├── Shell.tsx       # Auto Parts app shell
│   ├── VerticalWorkspaceShell.tsx  # Presentation-only vertical sidebar/drawer
│   ├── WorkspacePageHeader.tsx
│   └── ResponsiveContainer.tsx
├── ui/                 # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── Table.tsx
│   ├── RichTextDescriptionEditor.tsx  # Visual (WYSIWYG) + HTML description editor
│   └── (other primitives)
├── dashboard/          # Dashboard
│   └── Dashboard.tsx
├── listings/           # Listings
│   ├── ListingEditor.tsx
│   └── RevisionHistory.tsx
├── catalog/            # Catalog
│   ├── CatalogManager.tsx      # Table-first search + bulk ops
│   ├── CatalogInventoryDetailModal.tsx  # Row quick-view summary; links to product editor
│   ├── CatalogTable.tsx
│   ├── CatalogFilterBar.tsx
│   ├── CatalogBulkBar.tsx
│   ├── TeamBadge.tsx
│   ├── ListingStatusCell.tsx
│   ├── BulkActionsPage.tsx
│   ├── EbayPublishWizardPage.tsx
│   └── PublishProgressPanel.tsx  # Inline publish progress + results (replaces modal publishing steps)
├── catalog-import/     # Catalog import
│   ├── CatalogImportDashboard.tsx
│   └── CatalogMotorsFiltersPage.tsx
├── ingestion/          # Ingestion
│   └── IngestionManager.tsx
├── pipeline/           # Pipeline
│   ├── PipelinePage.tsx      # Bulk upload + team assignment + queue table
│   ├── PipelineQueue.tsx     # Upload history table (status filter, pagination)
│   └── PipelineWizard.tsx    # Job detail / processing step
├── motors/             # Motors intelligence
│   ├── MotorsDashboard.tsx
│   ├── MotorsProductDetail.tsx
│   ├── ReviewQueue.tsx
│   └── AIUploadWizard.tsx
├── fitment/            # Fitment
│   ├── FitmentManager.tsx
│   └── VinListingsPage.tsx
├── inventory/          # Inventory
│   └── InventoryManager.tsx
├── orders/             # Orders
│   └── OrdersPage.tsx
├── settings/           # Settings
│   ├── SettingsPage.tsx
│   ├── ClientSettingsPage.tsx
│   ├── UsersAdminPage.tsx
│   ├── PermissionsPage.tsx
│   ├── EbayStoresSettingsPage.tsx
│   ├── EbayStoreDetailPage.tsx
│   ├── EbayPolicyMappingPage.tsx
│   ├── StoreDefaultPoliciesTab.tsx
│   ├── EbayAccountPolicyEditor.tsx
│   └── ebayPolicyEditor.types.ts
├── templates/          # Templates
│   └── TemplateManagerPage.tsx
├── automation/         # Automation
│   └── AutomationRulesPage.tsx
├── notifications/      # Notifications
│   └── NotificationsPage.tsx
├── audit/              # Audit
│   └── AuditTrailPage.tsx
├── sku/                # SKU
│   └── SkuDetailPage.tsx
├── preview/            # Preview
│   ├── EbayPreviewPage.tsx   # eBay listing preview; edit mode uses RichTextDescriptionEditor for seller description
│   └── EditListingPanel.tsx
├── image-drive/        # Image Drive folder browser and recursive image upload
└── channels/           # Channels
    ├── PublishModal.tsx        # eBay multi-store publish — store selection only, hands off to PublishProgressPanel
    └── EbayOAuthCallback.tsx
```

---

## Library (`src/lib/`)

### API Clients

| File | Purpose | Base Endpoint |
|------|---------|---------------|
| `authApi.ts` | Auth wrapper, JWT handling | `/api/auth` |
| `listingsApi.ts` | Listings API | `/api/listings` |
| `catalogImportApi.ts` | Catalog import | `/api/catalog-import` |
| `catalogProductsApi.ts` | Catalog products | `/api/catalog-products` |
| `motorsApi.ts` | Motors intelligence | `/api/motors-intelligence` |
| `ebayIntegrationsApi.ts` | eBay integrations | `/api/integrations/ebay` |
| `multiStoreApi.ts` | Multi-store | `/api/ebay` |
| `ordersApi.ts` | Orders | `/api/orders` |
| `inventoryApi.ts` | Inventory | `/api/inventory` |
| `fitmentApi.ts` | Fitment | `/api/fitment` |
| `fitmentVinListingsApi.ts` | VIN listings | `/api/fitment/vin` |
| `channelsApi.ts` | Channels | `/api/channels` |
| `publishApi.ts` | Publishing | `/api/channels/ebay` |
| `pricingApi.ts` | Pricing | `/api/pricing` |
| `templateApi.ts` | Templates | `/api/templates` |
| `pipelineApi.ts` | Pipeline | `/api/pipeline` |
| `imageDriveApi.ts` | Image Drive folder/file CRUD, flat uploads, and chunked folder-tree uploads | `/api/image-drive` |
| `listingGenerationApi.ts` | AI generation | `/api/listings` |
| `rbacApi.ts` | RBAC admin | `/api/rbac` |
| `clientBrandingApi.ts` | Client branding | `/api/client-settings` |
| `searchApi.ts` | Search | `/api/listings` |

| `imageDriveUpload.ts` | Browser folder traversal and relative-path/image filtering helpers | — |

### Core Utilities

| File | Purpose |
|------|---------|
| `authApi.ts` | `fetchWithAuth`, JWT handling, 401 redirect |
| `queryProvider.tsx` | TanStack Query configuration |
| `permissions.ts` | Permission checking utilities |
| `persistence.ts` | LocalStorage helpers |
| `sanitize.ts` | Input sanitization |
| `ingestionAdapters.ts` | Ingestion data adapters |
| `ingestionPipeline.ts` | Pipeline helpers |
| `listingsQueryHooks.ts` | React Query hooks for listings |
| `catalogDestructiveUi.ts` | Deprecated; use RBAC for delete UI |
| `ebayFileExchangeParser.ts` | eBay file parsing |

---

## Contexts & Hooks

| File | Purpose |
|------|---------|
| `contexts/BrandingContext.tsx` | White-label branding state |
| `hooks/usePermissions.ts` | Check user permissions |
| `hooks/usePublicBranding.ts` | Fetch public branding |

---

## Build Configuration

### Vite Config (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3911,
    proxy: {
      '/api': {
        target: 'http://localhost:4191',
        changeOrigin: true,
      },
    },
  },
});
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_INGESTION_PROVIDER` | `mock` or `api` |
| `VITE_INGESTION_API_BASE_URL` | API base when provider is `api` |
| `VITE_INGESTION_HEALTH_PATH` | Health check path |

---

## Styling

### Tailwind Configuration

- Config: `tailwind.config.js`
- Global styles: `src/index.css`
- Component styles: Inline Tailwind classes

### Common Patterns

```tsx
// Card
<div className="bg-white rounded-lg shadow p-6">

// Button
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">

// Form input
<input className="border border-gray-300 rounded px-3 py-2 w-full">

// Table
<table className="min-w-full divide-y divide-gray-200">
```

---

*Reorganized: 2026-06-06.*

## Fashion workspace components (2026-09-09)

src/components/fashion contains FashionLoginPage, FashionShell, FashionDashboardPage, FashionListingsPage, FashionImportPage, FashionReviewPage, FashionStoresPage, and FashionUsersPage. These components use the existing authenticated fetch wrapper but never render inside the automotive Shell.

## Business & Industrial workspace components (2026-09-09)

## Shared vertical catalog components (2026-09-12)

`src/components/catalog/shared/CatalogWorkspace.tsx` is the shared parity surface for Fashion and Business & Industrial. `CatalogFilterControls`, `CatalogActiveFilterTags`, `CatalogMobileFilterDrawer`, and `CatalogResultsTable` provide loading-safe checkbox facets, facet search/collapse, a mobile filter drawer, empty-catalog versus no-match states, compact mobile product cards, mixed selection checkboxes, readable removable filters, pagination, selection, pending export/bulk states, and record-level bulk failure details. `CatalogPublishJobPanel` distinguishes submitted, processing, published, partially failed, and failed jobs and states that closing the panel does not cancel the job. `CatalogProductQuickView` provides scoped inline edits, vertical attributes, full-editor handoff, and image upload/reorder/remove/zoom. `CatalogImageGallery` owns the accessible pointer/keyboard drag ordering and marks the first image as primary. Configuration and API serialization live in `catalogConfig.ts` and `catalogApi.ts`; URL state is mirrored into a vertical-namespaced session key.

Reusable presentation primitives used by B&I (and available to other verticals) live in `src/components/ui/FeedbackPanel.tsx`, `Field.tsx`, `ConfirmDialog.tsx`, and `StatusBlock.tsx`. `src/components/layout/VerticalWorkspaceShell.tsx` is presentation-only: vertical routes, authorization, and organization selection remain in each vertical shell.

`src/components/business-industrial/` contains the dedicated login, shell,
dashboard, listings editor, import, image intake, compliance-review, stores, incidents, and users
surfaces. They use the existing authenticated API wrapper and render only in
the B&I route tree in `src/App.tsx`. The shell matches Auto Parts sidebar/drawer
behavior without importing Auto Parts search, notification, or status controls.

The B&I component set also includes `BusinessIndustrialImageIntakePage`, which
handles directory/drop selection, upload progress, AI group review, Excel
export, failed-group retry, condition confirmation, and handoff to the B&I
listing editor. API calls live in
`src/lib/businessIndustrialImageIntakeApi.ts`.

`BusinessIndustrialListingsPage` preserves all top-level product fields on edit,
captures the full validated B&I schema and image URLs, searches seller-specific
eBay categories, renders required item specifics and supported conditions, and
tracks publish jobs through a terminal result.

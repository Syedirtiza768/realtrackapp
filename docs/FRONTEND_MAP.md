> ⚠️ MOVED → [/docs/frontend/COMPONENT_MAP.md](frontend/COMPONENT_MAP.md) (2026-06-06)

# Frontend Map

> Complete reference for the React frontend structure.
> For API clients, see `/docs/API_MAP.md`.
> For component hierarchy, see route table in `src/App.tsx`.

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

## Route Structure

### Public Routes (No Shell)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `LoginPage` | User login |
| `/register` | `RegisterPage` | User registration |
| `/forgot-password` | `ForgotPasswordPage` | Password reset request |
| `/channels/ebay/callback` | `EbayOAuthCallback` | eBay OAuth callback |

### Protected Routes (With Shell)

All protected routes are wrapped in `<ProtectedRoute>` and `<Shell>`.

| Route | Component | Permission | Purpose |
|-------|-----------|------------|---------|
| `/` | `Dashboard` | `dashboard.view` | Main dashboard |
| `/listings/new` | `ListingEditor` | `listings.create` | Create listing |
| `/listings/:id/edit` | `ListingEditor` | `listings.update` | Edit listing |
| `/listings/:id/history` | `RevisionHistory` | `listings.view` | View revisions |
| `/catalog` | `CatalogManager` | `catalog.view` | Catalog browser |
| `/catalog/import` | `CatalogImportDashboard` | `catalog.import` | CSV import |
| `/catalog/motors-filters` | `CatalogMotorsFiltersPage` | `catalog.view` | Motors filters |
| `/catalog/products/:productId/publish/ebay` | `EbayPublishWizardPage` | `ebay.publish` | Publish to eBay |
| `/ingestion` | `IngestionManager` | `ingestion.view` | Ingestion dashboard |
| `/pipeline` | `PipelineWizard` | `pipeline.view` | Pipeline wizard |
| `/fitment` | `FitmentManager` | `fitment.view` | Fitment management |
| `/fitment/vin` | `VinListingsPage` | `fitment.view` | VIN lookup |
| `/inventory` | `InventoryManager` | `inventory.view` | Inventory management; bulk eBay publish via `publishListingIdsToEbay()` → `POST /channels/ebay/publish-by-listings` |
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
| `/settings` | `SettingsPage` | `settings.view` | General settings |
| `/settings/client` | `ClientSettingsPage` | (super_admin) | White-label settings |
| `/settings/users` | `UsersAdminPage` | (implicit) | User management |
| `/settings/permissions` | `PermissionsPage` | (implicit) | Permission management |
| `/settings/integrations/ebay` | `EbayStoresSettingsPage` | `ebay.view` | eBay + SellerPundit import/sync (`sellerpunditIntegrationsApi`) |
| `/settings/integrations/ebay/:accountId` | `EbayStoreDetailPage` | `ebay.view` | Store detail |
| `/settings/integrations/ebay/:accountId/policies` | `EbayPolicyMappingPage` | `ebay.manage` | Policy mapping |
| `/sku/:id` | `SkuDetailPage` | `catalog.view` | SKU detail |
| `/preview` | `EbayPreviewPage` | `listings.view` | Listing preview |

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
│   ├── Shell.tsx       # Main app shell
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── Navigation.tsx
├── ui/                 # Reusable UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── Table.tsx
│   └── (other primitives)
├── dashboard/          # Dashboard
│   └── Dashboard.tsx
├── listings/           # Listings
│   ├── ListingEditor.tsx
│   └── RevisionHistory.tsx
├── catalog/            # Catalog
│   ├── CatalogManager.tsx
│   ├── BulkActionsPage.tsx
│   └── EbayPublishWizardPage.tsx
├── catalog-import/     # Catalog import
│   ├── CatalogImportDashboard.tsx
│   └── CatalogMotorsFiltersPage.tsx
├── ingestion/          # Ingestion
│   └── IngestionManager.tsx
├── pipeline/           # Pipeline
│   └── PipelineWizard.tsx
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
│   └── EbayPolicyMappingPage.tsx
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
│   └── EbayPreviewPage.tsx
└── channels/           # Channels
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
| `listingGenerationApi.ts` | AI generation | `/api/listings` |
| `rbacApi.ts` | RBAC admin | `/api/rbac` |
| `clientBrandingApi.ts` | Client branding | `/api/client-settings` |
| `searchApi.ts` | Search | `/api/listings` |

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
| `catalogDestructiveUi.ts` | Catalog UI helpers |
| `ebayFileExchangeParser.ts` | eBay file parsing |

---

## Contexts (`src/contexts/`)

| File | Purpose |
|------|---------|
| `BrandingContext.tsx` | White-label branding state |

---

## Hooks (`src/hooks/`)

| File | Purpose |
|------|---------|
| `usePermissions.ts` | Check user permissions |
| `usePublicBranding.ts` | Fetch public branding |

---

## Types (`src/types/`)

| File | Purpose |
|------|---------|
| `catalog.ts` | Catalog-related types |
| `platform.ts` | Platform types |

---

## Authentication Flow

### Login

```
1. User submits credentials
2. POST /api/auth/login
3. Store JWT in localStorage (key: mk_auth_token)
4. Store user data in localStorage (key: mk_auth_user)
5. Redirect to /
```

### Authenticated Requests

```
1. fetchWithAuth adds Authorization: Bearer <token> header
2. On 401 response:
   - Clear localStorage tokens
   - Redirect to /login
   - Throw error
```

### Logout

```
1. POST /api/auth/logout (audit only)
2. Clear localStorage tokens
3. Redirect to /login
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
if (can('listings.delete')) {
  // Show delete option
}
```

---

## State Management

### Server State (TanStack Query)

```tsx
// Query
const { data, isLoading } = useQuery({
  queryKey: ['listings'],
  queryFn: () => listingsApi.getAll()
});

// Mutation
const mutation = useMutation({
  mutationFn: listingsApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  }
});
```

### Client State (React Context)

- `AuthContext`: Authentication state
- `BrandingContext`: White-label branding

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

## Related Documentation

- **API Map**: `/docs/API_MAP.md`
- **Auth/RBAC**: `/docs/architecture/auth-rbac.md`
- **Codebase Map**: `/docs/CODEMAP.md`

---

*Last updated: 2026-05-29*

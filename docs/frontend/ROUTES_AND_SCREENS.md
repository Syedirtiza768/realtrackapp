# Routes & Screens

> **Source**: Extracted from `docs/FRONTEND_MAP.md` route table (2026-05-29).
> For component details and file paths, see [COMPONENT_MAP.md](COMPONENT_MAP.md).
> For API endpoints backing each screen, see [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md).

---

## Route Structure

All protected routes wrapped in `<ProtectedRoute>` and `<Shell>`. Public routes render without Shell.

### Public Routes (No Shell)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `LoginPage` | User login |
| `/register` | `RegisterPage` | User registration |
| `/forgot-password` | `ForgotPasswordPage` | Password reset request |
| `/channels/ebay/callback` | `EbayOAuthCallback` | eBay OAuth callback |

### Protected Routes (With Shell)

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
| `/inventory` | `InventoryManager` | `inventory.view` | Inventory; bulk eBay publish |
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
| `/settings/integrations/ebay` | `EbayStoresSettingsPage` | `ebay.view` | eBay + SellerPundit import/sync |
| `/settings/integrations/ebay/:accountId` | `EbayStoreDetailPage` | `ebay.view` | Store detail |
| `/settings/integrations/ebay/:accountId/policies` | `EbayPolicyMappingPage` | `ebay.manage` | Policy mapping |
| `/sku/:id` | `SkuDetailPage` | `catalog.view` | SKU detail |
| `/preview` | `EbayPreviewPage` | `listings.view` | Listing preview |

---

## Authentication Flow

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
POST /api/auth/logout (audit only) → Clear localStorage → Redirect to /login
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

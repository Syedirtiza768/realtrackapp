# Frontend Codebase Audit Report

**Application:** ListingPro (package name: `realtrackapp`)  
**Audit Date:** 2025  
**Scope:** `d:\apps\listingpro\src\` — every file read in full  
**Stack:** React 18.3 · TypeScript 5.6 · Vite 6 · Tailwind CSS 3.4 · React Router 7.1

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Components by Directory](#3-components-by-directory)
4. [API Calls & Backend Coupling](#4-api-calls--backend-coupling)
5. [State Management](#5-state-management)
6. [Hardcoded / Mock Data](#6-hardcoded--mock-data)
7. [Type Definitions](#7-type-definitions)
8. [UI Library & Design System](#8-ui-library--design-system)
9. [Routing](#9-routing)
10. [Error Handling Gaps](#10-error-handling-gaps)
11. [Security Concerns](#11-security-concerns)
12. [Dead / Legacy Code](#12-dead--legacy-code)
13. [Bundle Size Concerns](#13-bundle-size-concerns)
14. [Feature Completeness](#14-feature-completeness)
15. [Recommendations](#15-recommendations)

---

## 1. Executive Summary

The frontend is a single-page React application for automotive parts inventory management. It covers catalog search, multi-channel publishing (eBay/Shopify), order management, AI-powered listing enhancements, inventory tracking, image ingestion, notifications, and settings.

**Strengths:**
- Comprehensive feature breadth — 12 routed pages covering the full listing lifecycle
- Clean API layer with custom hooks (`useSearch`, `useListings`, `useStores`, etc.)
- Abort-aware fetches with `AbortController` in search hooks
- Responsive design with mobile-first approach (drawer menus, breakpoint-aware grids)
- Server-Side search with dynamic facets, suggestions, and pagination

**Critical Issues:**
- No authentication or authorization — hardcoded `userId: 'system'` throughout
- 72,834-line generated data file (`generatedInventory.ts`) in the bundle — never imported
- FitmentManager uses 100% hardcoded mock data with no API integration
- 4 instances of `dangerouslySetInnerHTML` without sanitization (XSS risk)
- Shell header search bar is a non-functional placeholder
- Multiple legacy client-side modules are dead code (`catalogSearch.ts`, `fitmentSearch.ts`, `channelAdapters.ts`, `inventorySync.ts`, `data/inventory.ts`, `data/generatedInventory.ts`)

---

## 2. Architecture Overview

```
                        ┌─────────────────────┐
                        │     main.tsx         │
                        │  ErrorBoundary       │
                        │  StrictMode          │
                        └─────────┬───────────┘
                                  │
                        ┌─────────▼───────────┐
                        │     App.tsx          │
                        │  BrowserRouter       │
                        │  12 Routes           │
                        └─────────┬───────────┘
                                  │
                        ┌─────────▼───────────┐
                        │     Shell.tsx        │
                        │  Layout wrapper      │
                        │  Sidebar + Header    │
                        └─────────┬───────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
    ┌──────▼──────┐      ┌───────▼───────┐      ┌──────▼──────┐
    │  Page        │      │  Page          │      │  Page        │
    │  Components  │      │  Components    │      │  Components  │
    └──────┬──────┘      └───────┬───────┘      └──────┬──────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
                        ┌─────────▼───────────┐
                        │  lib/ API Hooks     │
                        │  Custom fetch()     │
                        └─────────┬───────────┘
                                  │
                        ┌─────────▼───────────┐
                        │  Vite Proxy          │
                        │  /api → :4191        │
                        └─────────────────────┘
```

**Key dependencies (from `package.json`):**

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 18.3.1 | UI framework |
| `react-router-dom` | 7.1.3 | Client-side routing |
| `lucide-react` | 0.474.0 | Icon library |
| `clsx` | 2.1.1 | Conditional className utility |
| `tailwind-merge` | 2.6.0 | Tailwind class deduplication |
| `xlsx` | 0.18.5 | Spreadsheet parsing (ingestion export) |

---

## 3. Components by Directory

### `layout/` (2 files)

| File | Lines | Description |
|------|-------|-------------|
| `Shell.tsx` | ~200 | Main app shell. Responsive sidebar (persistent desktop, overlay mobile). Header with placeholder search input, bell icon, "Systems Operational" badge, **"Demo User" hardcoded**. |
| `ResponsiveContainer.tsx` | ~50 | Reusable page wrapper with `PageHeader` sub-component for responsive padding/max-width. |

### `dashboard/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `Dashboard.tsx` | ~450 | Landing page. Fetches 5 API endpoints: `/api/dashboard/summary`, `/activity`, `/channel-health`, `/inventory-alerts`, `/multi-store`. KPI cards, activity timeline, channel sync health bars, multi-store overview, AI enhancement stats, inventory alerts table. Uses `safeFetch` pattern (empty-catch fallback). |

### `catalog/` (7 files)

| File | Lines | Description |
|------|-------|-------------|
| `CatalogManager.tsx` | ~400 | Orchestrator for search page. Manages `useSearch`, `useSummary`, `useDynamicFacets`. Features: pagination + infinite scroll toggle, sort modes (relevance/price/date/title), breadcrumbs, bulk selection, delete, single/bulk publish, localStorage for recent searches. |
| `SearchBar.tsx` | ~200 | Text input with real-time suggestions via `useSuggest` (200ms debounce). Keyboard nav (arrow keys + Enter). Type-specific icons (SKU/brand/category/MPN/title). Recent search chips. |
| `FilterSidebar.tsx` | 646 | 12 filter sections: Availability, Price Range, Make, Model, Brand, Category, Condition, Type, Format, Location, MPN, Source File. Each: collapsible, searchable, multi-select with counts from dynamic facets API. `MobileFilterDrawer` wrapper. |
| `ResultsGrid.tsx` | 359 | Grid/List toggle. IntersectionObserver infinite scroll. Loading skeletons. Pagination with page-number generator. Empty state. Responsive column counts (1→2→3→4 cols). |
| `ListingCard.tsx` | ~200 | Product card with lazy-loaded image, condition badge, relevance score indicator, quick-view hover overlay, title highlight rendering, Edit/Channels/Delete action buttons. Links to `/sku/:id` and `/listings/:id/edit`. |
| `DetailModal.tsx` | ~350 | Full detail modal with image gallery (keyboard nav via ArrowLeft/ArrowRight, thumbnails), 13-field spec table, description, embedded `ChannelListingPanel`. |
| `ActiveFilterTags.tsx` | 206 | Active filter chip strip with individual clear and "Clear all" button. Maps all filter types to display labels. |

### `channels/` (2 files)

| File | Lines | Description |
|------|-------|-------------|
| `ChannelListingPanel.tsx` | ~400 | Per-SKU channel status tiles (eBay/Shopify). Shows status, last sync, errors, external links, action buttons (Publish/Update/End/Retry). Uses `channelsApi` functions. |
| `PublishModal.tsx` | 442 | Multi-step publish modal (select → publishing → results). Channel checkboxes with per-channel overrides (price/title/qty). Validation warnings via `validateListingForPublish()`. Single and bulk modes. |

### `listings/` (2 files)

| File | Lines | Description |
|------|-------|-------------|
| `ListingEditor.tsx` | ~500 | Create/Edit form. Uses `useListingDetail` for edit mode. Fields: title, MPN, brand, condition (dropdown), price, description, image gallery. Live eBay preview panel. Handles 409 version conflicts. Supports ingestion seed from route state or localStorage. Has **hardcoded Toyota Camry alternator default description**. |
| `RevisionHistory.tsx` | ~200 | Timeline of listing revisions via `useRevisions`. Expandable JSON snapshot per version. |

### `fitment/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `FitmentManager.tsx` | ~350 | **ENTIRELY HARDCODED MOCK DATA** — 7 Toyota Camry fitment records. Table with checkboxes, confidence bars, verify/reject actions. Bulk action bar. Search input exists but **has no handler**. No API calls whatsoever. |

### `ingestion/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `IngestionManager.tsx` | 599 | Image-to-listing pipeline. Camera capture + file upload. Three modes: single/bulk/bundle. Job queue with status filtering, selection, export (CSV via `xlsx`), deletion. Health check polling (30s). Mock + API recognition providers selectable via `VITE_INGESTION_PROVIDER`. "Create Listing Draft" flows to `ListingEditor` with seed data via route state + localStorage. |

### `orders/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `OrdersPage.tsx` | ~450 | Order management with stats cards (total/pending/shipped/revenue), filterable/searchable table, pagination, detail modal. Fetches `/api/orders`, `/api/orders/stats`, `/api/orders/:id`. Full detail view: buyer info, shipping address, tracking URL link, line items, order amounts. |

### `notifications/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `NotificationsPage.tsx` | ~250 | Notification list with severity/type filters, read/unread state, mark-all-read, dismiss. Pagination (offset-based). Relative time display. Endpoints: `/api/notifications`, `/api/notifications/unread-count`, PATCH/POST/DELETE per notification. |

### `settings/` (1 file)

| File | Lines | Description |
|------|-------|-------------|
| `SettingsPage.tsx` | ~330 | Three-tab layout: General (key-value setting editor with auto-type parsing), Shipping Profiles (cards with delete), Pricing Rules (table with delete). Endpoints: `/api/settings`, `/api/settings/shipping-profiles/*`, `/api/settings/pricing-rules/*`. **Add Profile/Add Rule buttons are non-functional** (no onClick handler, no create form). Inline `SettingValueEditor` sub-component for text/boolean/JSON values. |

### `sku/` (4 files)

| File | Lines | Description |
|------|-------|-------------|
| `SkuDetailPage.tsx` | ~300 | Full SKU detail page with 5 tabs: Overview, Channels, Inventory, AI, Activity. Fetches `/api/listings/:id`. Overview tab: image, identifiers (with copy-to-clipboard), product details grid, features, description (rendered as **raw HTML**), metadata. Activity tab: fetches `/api/audit-logs?entityId=`. Uses **light theme colors** (white backgrounds, slate-900 text). |
| `ChannelStorePanel.tsx` | ~280 | Multi-store channel publishing. Tree view: Channel → Store → Instance. Publish per-store or publish-all. End listing, simulate order (demo). Uses `useStores`, `useListingChannelOverview`, `publishToMultipleStores`. |
| `InventoryPanel.tsx` | ~230 | Inventory management for single SKU. Stock cards (total/available/reserved/threshold), low-stock + out-of-stock alerts, quantity adjust form (±buttons, reason), event history timeline. Uses `getInventoryLedger`, `adjustInventory` from `multiStoreApi`. |
| `AiEnhancementsPanel.tsx` | ~310 | AI enhancement management per SKU. 5 enhancement types: title optimization, description generation, item specifics, fitment detection, image enhancement. Workflow: Generate → Approve/Reject → Apply. Shows confidence score, tokens used, latency, provider/model info. Diff/changes view. Structured data rendering for item specifics and fitments. |

### `ui/` (2 files)

| File | Lines | Description |
|------|-------|-------------|
| `card.tsx` | 44 | Custom `Card`, `CardHeader`, `CardTitle`, `CardContent` primitives. Uses `clsx` + `tailwind-merge` for className composition. Dark theme: `bg-slate-800`, `border-slate-700`. |
| `badge.tsx` | 35 | Custom `Badge` with 6 variants (default/secondary/outline/destructive/success/warning). Dark theme color tokens. |

---

## 4. API Calls & Backend Coupling

All API calls go through the Vite dev proxy (`/api` → `http://localhost:4191`). No direct backend URL references exist in the frontend code.

### Complete API Endpoint Map

| Endpoint | Method(s) | Used By | Purpose |
|----------|-----------|---------|---------|
| `/api/listings/search` | GET | `searchApi.useSearch` | Full-text search with filters, pagination, sort |
| `/api/listings/search/suggest` | GET | `searchApi.useSuggest` | Typeahead suggestions |
| `/api/listings/search/facets` | GET | `searchApi.useDynamicFacets` | Dynamic filter counts |
| `/api/listings/summary` | GET | `searchApi.useSummary` | Catalog KPI summary |
| `/api/listings` | GET | `listingsApi.useListings` | Paginated listing list (CRUD) |
| `/api/listings/:id` | GET | `listingsApi.useListingDetail`, `SkuDetailPage` | Single listing detail |
| `/api/listings` | POST | `listingsApi.createListing` | Create new listing |
| `/api/listings/:id` | PUT | `listingsApi.updateListing` | Full update (with version check) |
| `/api/listings/:id/status` | PATCH | `listingsApi.patchListingStatus` | Status change only |
| `/api/listings/:id` | DELETE | `listingsApi.deleteListing` | Soft delete |
| `/api/listings/:id/restore` | POST | `listingsApi.restoreListing` | Undo delete |
| `/api/listings/bulk` | POST | `listingsApi.bulkUpdateListings` | Batch status/update |
| `/api/listings/:id/revisions` | GET | `listingsApi.fetchRevisions` | Revision history |
| `/api/listings/facets` | GET | `listingsApi.useFacets` | CRUD facets |
| `/api/channels/connections` | GET | `channelsApi.getConnections` | Channel connection list |
| `/api/channels/connections/:key/auth-url` | GET | `channelsApi.getAuthUrl` | OAuth redirect URL |
| `/api/channels/connections/:key/test` | POST | `channelsApi.testConnection` | Test connectivity |
| `/api/channels/connections/:key` | DELETE | `channelsApi.disconnectChannel` | Disconnect |
| `/api/channels/listings/:id` | GET | `channelsApi.getListingChannels` | Per-SKU channel statuses |
| `/api/channels/listings/:id/publish` | POST | `channelsApi.publishToChannels` | Publish to channels |
| `/api/channels/listings/:id/instances/:iid` | PUT | `channelsApi.updateOnChannel` | Update channel listing |
| `/api/channels/listings/:id/instances/:iid/end` | POST | `channelsApi.endOnChannel` | End channel listing |
| `/api/channels/listings/:id/instances/:iid/retry` | POST | `channelsApi.retryOnChannel` | Retry failed publish |
| `/api/channels/bulk-publish` | POST | `channelsApi.bulkPublish` | Batch publish |
| `/api/stores` | GET/POST | `multiStoreApi.getStores/createStore` | Store CRUD |
| `/api/stores/:id` | PUT | `multiStoreApi.updateStore` | Update store |
| `/api/stores/:id/instances` | GET | `multiStoreApi.getInstances` | Store instances |
| `/api/stores/:id/instances` | POST | `multiStoreApi.createInstance` | Create instance |
| `/api/stores/instances/:id/publish` | POST | `multiStoreApi.publishInstance` | Publish instance |
| `/api/stores/instances/bulk-publish` | POST | `multiStoreApi.bulkPublishInstances` | Batch publish instances |
| `/api/stores/instances/:id/end` | POST | `multiStoreApi.endInstance` | End instance |
| `/api/stores/publish-multiple` | POST | `multiStoreApi.publishToMultipleStores` | Multi-store publish |
| `/api/stores/listing-channel-overview/:id` | GET | `multiStoreApi.getListingChannelOverview` | Overview |
| `/api/stores/demo-logs` | GET | `multiStoreApi.getDemoLogs` | Demo activity |
| `/api/stores/simulate-order` | POST | `multiStoreApi.simulateOrder` | Demo orders |
| `/api/ai-enhancements/listing/:id` | GET | `multiStoreApi.getAiEnhancements` | Get enhancements |
| `/api/ai-enhancements/request` | POST | `multiStoreApi.requestEnhancement` | Request new |
| `/api/ai-enhancements/bulk-request` | POST | `multiStoreApi.bulkRequestEnhancements` | Batch request |
| `/api/ai-enhancements/:id/approve` | POST | `multiStoreApi.approveEnhancement` | Approve |
| `/api/ai-enhancements/:id/apply` | POST | `multiStoreApi.applyEnhancement` | Apply to listing |
| `/api/ai-enhancements/:id/reject` | POST | `multiStoreApi.rejectEnhancement` | Reject |
| `/api/ai-enhancements/stats` | GET | `multiStoreApi.getAiStats` | Stats dashboard |
| `/api/inventory/:id/ledger` | GET | `multiStoreApi.getInventoryLedger` | Inventory ledger |
| `/api/inventory/:id/adjust` | POST | `multiStoreApi.adjustInventory` | Adjust stock |
| `/api/dashboard/summary` | GET | `Dashboard` | KPI summary |
| `/api/dashboard/activity` | GET | `Dashboard` | Recent activity |
| `/api/dashboard/channel-health` | GET | `Dashboard` | Channel sync health |
| `/api/dashboard/inventory-alerts` | GET | `Dashboard` | Low stock alerts |
| `/api/dashboard/multi-store` | GET | `Dashboard` | Multi-store metrics |
| `/api/orders` | GET | `OrdersPage` | Order list |
| `/api/orders/stats` | GET | `OrdersPage` | Order stats |
| `/api/orders/:id` | GET | `OrdersPage` | Order detail |
| `/api/notifications` | GET | `NotificationsPage` | Notification list |
| `/api/notifications/unread-count` | GET | `NotificationsPage` | Badge count |
| `/api/notifications/:id/read` | PATCH | `NotificationsPage` | Mark read |
| `/api/notifications/mark-all-read` | POST | `NotificationsPage` | Mark all read |
| `/api/notifications/:id` | DELETE | `NotificationsPage` | Dismiss |
| `/api/settings` | GET | `SettingsPage` | All settings |
| `/api/settings/:cat/:key` | PUT | `SettingsPage` | Update setting |
| `/api/settings/shipping-profiles/list` | GET | `SettingsPage` | Shipping profiles |
| `/api/settings/shipping-profiles/:id` | DELETE | `SettingsPage` | Delete profile |
| `/api/settings/pricing-rules/list` | GET | `SettingsPage` | Pricing rules |
| `/api/settings/pricing-rules/:id` | DELETE | `SettingsPage` | Delete rule |
| `/api/audit-logs` | GET | `SkuDetailPage.ActivityTab` | Audit log |
| `/api/ingestion/health` | GET | `IngestionManager` | Provider health |
| `/api/ingestion/recognize` | POST | `ingestionAdapters` | Vision recognition |
| `/api/ingestion/enrich` | POST | `ingestionAdapters` | Product enrichment |

**Coupling observation:** The frontend has **zero hardcoded backend URLs** — all routing goes through `/api` prefix handled by Vite proxy in dev and (presumably) nginx in production. This is clean architecture. However, there's no API client abstraction layer — every module uses raw `fetch()` independently.

---

## 5. State Management

**Pattern:** Pure React hooks — `useState`, `useEffect`, `useCallback`. No external state management library (no Redux, Zustand, Jotai, etc.).

| Pattern | Where Used |
|---------|------------|
| Local `useState` | Every component |
| Custom fetch hooks | `useSearch`, `useSuggest`, `useDynamicFacets`, `useListingDetail`, `useSummary`, `useListings`, `useFacets`, `useRevisions`, `useConnections`, `useSkuChannels`, `useStores`, `useListingChannelOverview`, `useListingEnhancements` |
| `AbortController` | `useSearch` (cancels inflight searches on re-render) |
| Debouncing | `useSuggest` (200ms), `useDynamicFacets` (300ms) |
| `localStorage` | Ingestion queue persistence (`STORAGE_KEYS`), listing seed data, recent searches in CatalogManager |

**Observations:**
- No shared global state — each page fetches its own data independently
- No cache invalidation strategy — navigating away and back re-fetches everything
- Dashboard fetches 5 endpoints in parallel on every mount (no caching)
- No optimistic updates — mutations wait for server response before updating UI (except notification read state)

---

## 6. Hardcoded / Mock Data

| Location | What | Impact |
|----------|------|--------|
| `FitmentManager.tsx` | **7 hardcoded Toyota Camry fitment records** (`FITMENT_DATA` array) | Entire page is non-functional mock. No API integration. |
| `Shell.tsx` | `"Demo User"` display name | No auth — always shows "Demo User" |
| `channelsApi.ts` | `userId: 'system'` in every channel publish call | No user context |
| `ListingEditor.tsx` | Default description for "Toyota Camry 2.5L OEM Alternator" | Minor — only used as placeholder |
| `data/generatedInventory.ts` | **72,834 lines** of static `CatalogItem[]` data | In the bundle but **never imported** by any component |
| `data/inventory.ts` | 414 lines: 8 manual `CatalogItem` + helpers | In the bundle but **never imported** by any component |
| `ingestionAdapters.ts` | Mock recognition/enrichment provider with random data | Active — toggled via `VITE_INGESTION_PROVIDER` env var |

---

## 7. Type Definitions

Six type definition files in `src/types/`:

| File | Key Types | Notes |
|------|-----------|-------|
| `catalog.ts` | `CatalogItem`, `VehicleFitment`, `CatalogFilterState`, `SearchCompatibilityInput`, `SearchResultItem` | Used by legacy client-side search (dead code) |
| `channels.ts` | `ChannelKey` (`'ebay' \| 'shopify'`), `CHANNEL_META`, `ChannelConnection`, `ChannelListingInfo`, `SkuChannelStatus`, `PublishRequest/Response`, `ChannelOverrides`, validate + status helpers | **`ChannelKey` only supports ebay/shopify** but UI shows amazon/walmart too |
| `listings.ts` | `ListingRecord` (mirrors DB entity), `ListingRecordFull` (76 columns), `ListingStatus`, `ListingsResponse`, `ListingsFacets`, `ListingRevision` | Well-structured, matches NestJS backend entity |
| `multiStore.ts` | `Store`, `ListingChannelInstance`, `AiEnhancement` with 5 enhancement types, `DemoSimulationLog`, `ENHANCEMENT_TYPE_META`, `CHANNEL_COLORS` | Comprehensive multi-store + AI types |
| `platform.ts` | `ProductCatalogItem`, `FitmentRecord`, `IngestionJob`, `ListingState`, `ChannelAdapter` interface, `SearchQuery/Result` generics | Mostly unused — appears to be early design artifacts |
| `search.ts` | `SearchQuery`, `SearchResponse`, `SearchItem`, `SuggestResponse`, `DynamicFacets`, `ListingDetail` (76 columns), `ActiveFilters`, `EMPTY_FILTERS`, `filtersToQuery()`, `countActiveFilters()`, `CONDITION_MAP` | Core search types, actively used |

**Gap:** `ChannelKey` in `channels.ts` is limited to `'ebay' | 'shopify'`, but `ChannelStorePanel.tsx` renders Amazon and Walmart channels too. This type mismatch could cause issues with TypeScript strict checking.

---

## 8. UI Library & Design System

**No component library used.** This is a custom design system with:

- **2 shared primitives:** `Card` (4 sub-components) and `Badge` (6 variants) in `src/components/ui/`
- **Styling:** Tailwind CSS with custom config:
  - Dark theme: `slate-900` background, `slate-800` surfaces, `blue-500/600` primary
  - Custom breakpoint: `3xl: 1920px`
  - Custom animations: `slide-in-left`, `fade-in`
  - Responsive fluid font-size: `clamp(14px, 1.5vw, 16px)`
- **Icons:** `lucide-react` exclusively — 100+ unique icon imports across the codebase
- **Class utility:** `cn()` = `twMerge(clsx(...))` — defined redundantly in both `card.tsx` and `badge.tsx` instead of a shared `utils.ts`

**Theme inconsistency:** Most components use the dark theme (slate-800/900 backgrounds), but `SkuDetailPage.tsx` and its sub-panels (`InventoryPanel`, `ChannelStorePanel`, `AiEnhancementsPanel`) use **light theme** colors (`bg-white`, `border-slate-200`, `text-slate-800`). This creates a jarring visual contrast when navigating between pages.

---

## 9. Routing

Defined in `App.tsx` using React Router 7 `<BrowserRouter>`:

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `Dashboard` | Default landing page |
| `/listings/new` | `ListingEditor` | Create mode |
| `/listings/:id/edit` | `ListingEditor` | Edit mode |
| `/listings/:id/history` | `RevisionHistory` | Version timeline |
| `/ingestion` | `IngestionManager` | Image pipeline |
| `/fitment` | `FitmentManager` | **Mock only** |
| `/catalog` | `CatalogManager` | Main search/browse |
| `/orders` | `OrdersPage` | Order management |
| `/settings` | `SettingsPage` | App configuration |
| `/notifications` | `NotificationsPage` | Notification center |
| `/sku/:id` | `SkuDetailPage` | Full SKU detail (tabbed) |
| `*` | 404 page | Inline "Page not found" with back link |

**Notes:**
- No lazy loading (`React.lazy`) — all routes eagerly loaded
- No route guards or protected routes (no auth)
- All routes wrapped in `<Shell>` layout
- No nested route structure — flat route list

---

## 10. Error Handling Gaps

### Critical

| Issue | Location | Risk |
|-------|----------|------|
| **No global error handling for API failures** | All lib files | User sees no feedback if API is unreachable |
| **Silent catch blocks** | `Dashboard.tsx` (5 safeFetch calls), `useSuggest`, `useDynamicFacets`, `SkuDetailPage.ActivityTab` | Errors swallowed silently — user sees empty state with no error message |
| **No retry logic** | All fetch hooks except channel retry button | Transient network failures require manual page refresh |
| **No loading timeout** | All fetch hooks | Spinner could display indefinitely if server hangs |
| **Notification API calls fire-and-forget** | `NotificationsPage` markAsRead/dismiss | No error handling — `await fetch(...)` with no catch |

### Moderate

| Issue | Location | Risk |
|-------|----------|------|
| Inline `confirm()` dialogs | `SettingsPage` (delete profile/rule), `CatalogManager` (delete listing) | Browser-native confirm is not customizable and blocks the thread |
| No form validation beyond required fields | `ListingEditor`, `SettingsPage` | Missing price format validation, field length limits, etc. |
| `fetch` response status not always checked | Several locations use `.json()` without checking `res.ok` | Could throw on 4xx/5xx |

---

## 11. Security Concerns

| Issue | Severity | Location | Detail |
|-------|----------|----------|--------|
| **`dangerouslySetInnerHTML` without sanitization** | HIGH | `SkuDetailPage.tsx` (description), `AiEnhancementsPanel.tsx` (enhanced description), `ListingCard.tsx` (title highlight), `ResultsGrid.tsx` (title highlight) | Server-returned HTML rendered without DOMPurify or similar. If listing description contains `<script>` or event handlers, XSS is possible. |
| **No authentication** | HIGH | Entire app | No login flow, no token management, no session handling. `userId: 'system'` hardcoded. |
| **No CSRF protection** | MEDIUM | All mutating fetch calls | POST/PUT/DELETE calls have no CSRF token |
| **`navigator.clipboard.writeText`** | LOW | `SkuDetailPage.tsx` | Requires HTTPS; will fail silently on HTTP |

---

## 12. Dead / Legacy Code

These files are imported by nothing or contain entirely unused code:

| File | Lines | Evidence |
|------|-------|----------|
| `data/generatedInventory.ts` | **72,834** | No component or lib imports from `data/` at all |
| `data/inventory.ts` | 414 | Same — only imports `generatedInventory.ts` internally |
| `lib/catalogSearch.ts` | ~150 | Client-side search engine — replaced by `/api/listings/search` server-side search |
| `lib/fitmentSearch.ts` | ~80 | Client-side fitment search — no component imports it |
| `lib/channelAdapters.ts` | ~150 | `ConnectorRegistry` + `MultiChannelListingService` — no component uses these classes |
| `lib/inventorySync.ts` | ~120 | `InventoryOrchestrator` class — no component imports it |
| `lib/ingestionPipeline.ts` | ~100 | `IntelligentIngestionService` — only `ingestionAdapters.ts` could use it, but components use `ingestionAdapters` directly |
| `types/catalog.ts` | ~70 | Only consumed by dead `data/` and `lib/catalogSearch.ts` |
| `types/platform.ts` | ~100 | Generic platform types — largely superseded by `search.ts`, `listings.ts`, `channels.ts` |

**Estimated dead code: ~73,918 lines** (primarily the generated inventory data file).

---

## 13. Bundle Size Concerns

| Concern | Impact | Recommendation |
|---------|--------|----------------|
| `generatedInventory.ts` (72,834 lines) included in build | Massive JS bundle | Delete or exclude via build config (it's never imported, but may still be tree-shaken — verify with build analysis) |
| No route-level code splitting | Entire app loaded upfront | Add `React.lazy()` + `Suspense` for each route |
| `xlsx` library (0.18.5) | Large dependency for spreadsheet export | Only needed in IngestionManager — should be dynamically imported |
| `lucide-react` | Only imports used icons (tree-shakeable) | OK — no action needed |
| All 12 pages in a single chunk | Slow initial load | Split into per-route chunks |

---

## 14. Feature Completeness

| Feature | Status | Notes |
|---------|--------|-------|
| Catalog Search & Browse | ✅ Complete | Full-text search, faceted filters, pagination, infinite scroll, suggestions |
| Listing CRUD | ✅ Complete | Create, edit, delete, restore, version history, bulk operations |
| Multi-Channel Publishing | ✅ Complete | eBay/Shopify publish, update, end, retry, bulk publish, per-channel overrides |
| Multi-Store Management | ✅ Complete | Store→Channel→Instance hierarchy, publish-all, simulate order |
| AI Enhancements | ✅ Complete | 5 types, full workflow (request→generate→approve→apply), structured data view |
| Inventory Management | ✅ Complete | Stock levels, adjustments, event history, alerts |
| Order Management | ✅ Complete | List, filter, search, detail view with tracking |
| Notifications | ✅ Complete | List, filter, read/dismiss, mark-all-read, pagination |
| Image Ingestion | ✅ Complete | Camera/upload, AI recognition, listing seed generation |
| Dashboard | ✅ Complete | KPI cards, activity timeline, channel health, inventory alerts |
| Settings — General | ⚠️ Partial | View/edit existing settings works; no create UI |
| Settings — Shipping | ⚠️ Partial | View/delete works; **Add Profile button is a no-op** |
| Settings — Pricing | ⚠️ Partial | View/delete works; **Add Rule button is a no-op** |
| Fitment Management | ❌ Mock | Entirely hardcoded data, no API integration, non-functional search |
| Authentication | ❌ Missing | No login, no session, no role-based access |
| Shell Header Search | ❌ Mock | Input present but non-functional (no handler) |
| User Profile/Account | ❌ Missing | "Demo User" hardcoded |
| Responsive Testing | ⚠️ Partial | Mobile layouts exist but SkuDetail panels lack mobile optimization |

---

## 15. Recommendations

### P0 — Must Fix (Pre-Production)

1. **Add authentication.** Implement login flow, JWT/session management, and replace all `userId: 'system'` hardcodings. Add route guards for protected pages.

2. **Sanitize HTML output.** Install `dompurify` and wrap all 4 `dangerouslySetInnerHTML` usages. Listing descriptions from eBay imports can contain arbitrary HTML including scripts.

3. **Remove dead data files.** Delete `src/data/generatedInventory.ts` (72,834 lines) and `src/data/inventory.ts` (414 lines). Neither is imported by any component or lib file. Verify with `vite build --analyze` that they are truly excluded.

4. **Implement fitment API integration.** Replace `FitmentManager`'s hardcoded `FITMENT_DATA` with real API calls matching the backend fitment module.

### P1 — Should Fix

5. **Add route-level code splitting.** Wrap all route components with `React.lazy()` + `Suspense`. IngestionManager and its `xlsx` dependency are particularly good candidates.

6. **Centralize error handling.** Create a shared `useApi` hook or fetch wrapper that handles 401/403/404/500 responses consistently, shows toast notifications, and supports retry.

7. **Remove dead library files.** Delete `catalogSearch.ts`, `fitmentSearch.ts`, `channelAdapters.ts`, `inventorySync.ts`, `ingestionPipeline.ts`, `types/catalog.ts`, `types/platform.ts`. These are superseded by server-side APIs.

8. **Fix theme inconsistency.** `SkuDetailPage` and sub-panels use light-theme colors while the rest of the app is dark. Standardize to one theme or implement a proper theme toggle.

9. **Complete Settings page.** Wire up "Add Profile" and "Add Rule" buttons with create forms and POST endpoints.

10. **Wire up Shell header search.** Connect the search input in `Shell.tsx` to navigate to `/catalog?q=...`.

### P2 — Nice to Have

11. **Extract `cn()` utility.** Move the `clsx`+`twMerge` helper from `card.tsx`/`badge.tsx` into `src/lib/utils.ts`.

12. **Add API response caching.** Consider SWR or React Query for automatic caching, revalidation, and optimistic updates.

13. **Add form validation library.** Use `zod` + `react-hook-form` for type-safe form validation in `ListingEditor` and `SettingsPage`.

14. **Expand `ChannelKey` type.** Add `'amazon' | 'walmart'` to `ChannelKey` in `types/channels.ts` to match the UI's 4-channel rendering.

15. **Add loading timeouts.** Wrap long-running fetch calls with `AbortController` timeouts (e.g., 30s) to prevent infinite spinners.

---

## File Inventory Summary

| Category | Files | Total Lines (est.) |
|----------|-------|--------------------|
| Entry Points | 4 | ~200 |
| Components | 25 | ~8,500 |
| Lib (API/Logic) | 11 | ~2,200 |
| Types | 6 | ~800 |
| Data (DEAD) | 2 | ~73,250 |
| Config | 4 | ~100 |
| **Total** | **52** | **~85,050** |
| **Active Code** | **46** | **~11,800** |

# RealTrackApp — Product Feature Catalog

**Document type:** Product & business feature inventory  
**Basis:** Code inspection (`src/`, `backend/src/`)  
**Last aligned to repository:** As of authoring from workspace scan  

> **Branding note:** The shell uses “RealTrackApp”; the login screen uses “ListingPro.” Standardize for external materials.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Product overview](#2-product-overview)
3. [Module catalog](#3-module-catalog)
4. [Detailed feature catalog (samples)](#4-detailed-feature-catalog-samples)
5. [Role-based matrix](#5-role-based-matrix)
6. [Workflow summary (user journeys)](#6-workflow-summary-user-journeys)
7. [Reports and dashboards](#7-reports-and-dashboards)
8. [Automation and integrations](#8-automation-and-integrations)
9. [Configuration features](#9-configuration-features)
10. [Product differentiators](#10-product-differentiators)
11. [Gap analysis](#11-gap-analysis)
12. [Roadmap recommendations](#12-roadmap-recommendations)
13. [Sales and marketing summary](#13-sales-and-marketing-summary)
14. [Product brochure summary](#14-product-brochure-summary)
15. [Technical caveats (QA)](#15-technical-caveats-qa)

---

## 1. Executive summary

RealTrackApp is a **multi-channel automotive parts listing and operations platform** combining:

- **Listing & catalog management** with advanced search, facets, and CSV/catalog import  
- **AI-assisted workflows:** image ingestion, listing generation, AI enhancements (approve/apply), Motors Intelligence pipeline, spreadsheet enrichment pipeline  
- **Marketplace connectivity:** channel connections, publish/sync, webhooks (eBay, Shopify, Amazon, Walmart), eBay order import and fulfillment helpers  
- **Operations:** orders, inventory ledger/reservations, dashboards/KPIs, notifications (in-app + WebSocket gateway), automation rules, templates, audit logs  

### Product realities (from code)

| Area | Status |
|------|--------|
| Authentication | Login/register + JWT issuance exist; **no global JWT guards** on API controllers (comments reference future wiring). |
| Authorization | Roles (`admin`, `manager`, `user`, `viewer`) exist on `User` but **are not enforced** in frontend navigation or backend routes. |
| Password reset | UI calls `/api/auth/password-reset`; **no matching backend route** found → **Partial / broken**. |
| Bulk image ops | UI calls `POST /api/listings/bulk-image-ops`; **no backend endpoint** found → **Missing / broken**. |
| Export rules | Full REST API under `/api/export-rules`; **no UI** references → **Backend implemented, UI missing**. |
| Feature flags | API `/api/feature-flags` exists; **no UI** found → **Backend implemented, UI missing**. |

---

## 2. Product overview

### 2.1 Executive product snapshot

| # | Item | Assessment (evidence-based) |
|---|------|------------------------------|
| 1 | Product name | **RealTrackApp** (shell); README “prototype”; login: **ListingPro** — needs alignment. |
| 2 | Product category | B2B/B2C **listing management & catalog ops** for automotive parts; multi-channel publishing. |
| 3 | Industry served | **Automotive aftermarket / motors parts** (fitment, VIN, eBay Motors–oriented APIs). |
| 4 | Target customers | Mid-market and enterprise **marketplace sellers**, catalog ops, listing specialists *(inferred)*. |
| 5 | Problems solved | Listing scale-up, **fitment/compatibility**, **multi-channel publish & inventory sync**, **AI-assisted** quality, **order** handling. |
| 6 | Value proposition | Single workspace for **catalog + AI enrichment + channel ops + orders + analytics**. |
| 7 | User types & roles | DB: `admin`, `manager`, `user`, `viewer` — **not enforced** in app behavior. |
| 8 | Core functional areas | Dashboard, catalog/search, listings, ingestion & pipelines, fitment, Motors Intel, inventory, orders, channels, settings, automation, templates, notifications, audit. |
| 9 | Competitive advantages | **Fitment & eBay MVL** integration; **multi-marketplace** webhooks/sync scaffolding; **AI enhancement** workflow; **pricing intelligence** APIs + scheduled competitor collection. |
| 10 | Maturity | Strong **prototype / engineering build**; UI partially aligned; authz and some UI/API gaps → **mid-stage**, not shrink-wrapped enterprise. |

### 2.2 Core functional areas

- **Merchandising & content:** listings, templates, AI enhancements, Motors products, pipeline outputs  
- **Demand & supply data:** catalog search, import, compliance validation, export (CSV/ZIP)  
- **Commerce ops:** stores, channel publish/sync, orders, refunds/ship, inventory  
- **Intelligence:** dashboard KPIs, pricing snapshots/competitors, AI suggestions  
- **Platform:** settings (tenant, shipping, pricing rules), automation rules, notifications, audit, scheduled jobs (cron + BullMQ)  

---

## 3. Module catalog

### 3.1 Navigation & routes

**Sidebar** (`Shell.tsx`): Dashboard, Ingestion, Motors Intel, Review Queue, New Listing, Fitment, VIN Lookup, Catalog, CSV Import, Inventory, Pipeline, eBay Preview, Bulk Actions, Orders, Automation, Templates, Audit Trail, Notifications, Settings.

**Routes** (`App.tsx`):

| Path | Screen |
|------|--------|
| `/` | Dashboard |
| `/ingestion` | Ingestion manager |
| `/motors`, `/motors/upload`, `/motors/review`, `/motors/:id` | Motors Intelligence |
| `/listings/new`, `/listings/:id/edit`, `/listings/:id/history` | Listing editor & revision history |
| `/fitment`, `/fitment/vin` | Fitment & VIN listings |
| `/catalog`, `/catalog/import` | Catalog & CSV import |
| `/inventory` | Inventory manager |
| `/bulk-actions` | Bulk actions |
| `/orders` | Orders |
| `/settings` | Settings |
| `/automation` | Automation rules |
| `/templates` | Templates |
| `/audit` | Audit trail |
| `/notifications` | Notifications |
| `/sku/:id` | SKU detail |
| `/pipeline` | Pipeline wizard |
| `/preview` | eBay preview |
| `/login`, `/register`, `/forgot-password` | Auth |
| `/channels/ebay/callback` | eBay OAuth callback |

**Needs verification:** No `ProtectedRoute` pattern found — authenticated vs anonymous access to Shell routes may not be enforced in routing.

### 3.2 Module summaries

| Module | Business purpose | Target users | Feature summary | Key workflows | Dependencies | Status |
|--------|------------------|--------------|-----------------|---------------|--------------|--------|
| **Dashboard** | Operational KPIs, health, alerts | Ops, managers | Summary, sales, activity, channel health, KPIs, inventory alerts, multi-store metrics; ingestion + AI stats | Load → refresh metrics | Listings, channels, inventory, ingestion | **Implemented** |
| **Catalog & search** | Find/manage SKUs | Merchandisers | Search, suggest, facets; filters, grid/list, publish modals | Search → filter → SKU → publish | Search service | **Implemented** |
| **Listing editor & revisions** | Create/edit listings | Listing team | CRUD, status, bulk update/delete, export CSV, import from folder (server), revisions | Edit → history | Listings module | **Implemented** |
| **Bulk actions** | Batch ops | Power users | Search listings; bulk image ops | Select → bulk | Listings API | **Partial** (image ops backend missing) |
| **Ingestion (camera UI)** | Image-first onboarding | Field/listing | Mock or external API (`mock` / `api`) | Stage images → queue | Optional vision API | **Implemented** |
| **Pipeline wizard** | Spreadsheet enrichment | Ops | Upload → stages → download US/AU/DE/report | Upload → monitor → download | Pipeline service | **Implemented** |
| **Image enrichment** | Image AI jobs | Ops | enrich, validate, status | Submit → poll | AI/OpenAI | **Implemented** |
| **Motors Intelligence** | Motors SKU lifecycle | Specialists | Products CRUD, pipeline, publish, upload, enrich, review queue, stats, SSE progress | Upload → pipeline → review → publish | Motors + channels | **Implemented** |
| **Fitment** | Compatibility | Catalog | Reference data, listing fitments, VIN decode, eBay MVL | YMM → compatibility JSON | eBay APIs, fitment DB | **Implemented** |
| **VIN listings** | Parts for VIN | Sales/support | Listings-by-VIN API | Enter VIN → listings | Fitment | **Implemented** |
| **CSV catalog import** | Bulk CSV | Data team | Upload, map, start/retry/cancel, rows, backfill | Upload → map → process | catalog-import | **Implemented** |
| **Compliance** | Marketplace readiness | Compliance | Batch/single/import validation; audit logs | Validate | eBay compliance | **Implemented** |
| **Inventory** | Stock truth | Ops | Ledger, adjust, reserve/release, reconcile, events, duplicates, per-store allocation | Adjust vs orders | Orders, listings | **Implemented** *(see §15)* |
| **Channels & stores** | Connection & publish | Integrations | OAuth, legacy eBay token, publish, sync, multi-publish, webhooks, stores CRUD | Connect → publish | Marketplace APIs | **Implemented** |
| **eBay offers** | Listing trading | Power sellers | Publish, batch PATCH, delete offers | Publish | eBay APIs | **Implemented** |
| **Orders** | Order lifecycle | Ops | List, stats, FSM status, shipping, refund, bulk ship/cancel, CSV tracking, eBay import | Import → fulfill | eBay orders | **Implemented** |
| **Pricing intelligence** | Market pricing | Pricing | Snapshots, history, competitors, AI suggestion, reprice, collect | Suggestion → reprice | Competitor data | **Implemented** |
| **AI enhancements** | Human-in-loop AI | Merchandisers | Request, bulk, approve, apply, reject, stats | Request → approve → apply | Listings | **Implemented** |
| **Automation rules** | Hands-off ops | Admins | CRUD, toggle, execute; triggers & actions per entity model | Enable → execute | Channels, listings | **Implemented** |
| **Templates** | Listing structure | Merchandisers | CRUD, preview, generate | Template → generate | Listings | **Implemented** |
| **Notifications** | Awareness | All | List, unread, mark read, dismiss; WebSocket gateway | Events → inbox | EventEmitter | **Implemented** |
| **Audit trail** | Accountability | Compliance | Query audit logs | Filter feed | Dashboard/audit API | **Implemented** |
| **Settings** | Configuration | Admin | Tenant settings, shipping profiles, pricing rules, channels UI | Edit settings | DB | **Implemented** |
| **Authentication** | Identity | All | Login, register, JWT | Register/login | User store | **Partial** |
| **Export rules** | Rule-based offers | Power users | CRUD, execute, preview *(API only)* | Rule → execute | Catalog, channels | **Backend only** |
| **Feature flags** | Rollout | Engineering | GET/PATCH/toggle | Toggle | DB | **Backend only** |
| **Health & docs** | Ops / dev | DevOps | `/api/health`, Swagger `/api/docs` (non-prod) | Monitor | Nest | **Implemented** |

---

## 4. Detailed feature catalog (samples)

Exhaustive per-endpoint listing is consolidated in §8; below are representative **Phase-4-style** entries.

### 4.1 Advanced catalog search & facets

| Field | Description |
|--------|-------------|
| **Feature name** | Advanced listing search & dynamic facets |
| **Short description** | Full-text + fuzzy search with suggestions and facet counts from the same query. |
| **Business problem** | Large catalogs need relevance and progressive narrowing. |
| **Target users** | Merchandising, sales support |
| **Preconditions** | Listings present in DB |
| **Inputs** | Query string, filters, sort, pagination |
| **Outputs** | Search results + facet payloads |
| **User actions** | Query, facets, sort, paginate |
| **Related APIs** | `GET /api/listings/search`, `search/suggest`, `search/facets` |
| **Permissions** | Needs verification (no guard) |
| **Status** | **Implemented** |

### 4.2 Multi-channel publish & sync

| Field | Description |
|--------|-------------|
| **Feature name** | Channel connection & listing publish/sync |
| **Business problem** | Manual per-marketplace updates do not scale. |
| **Target users** | Channel admins, listing ops |
| **Integrations** | eBay (primary in UI), Shopify/Amazon/Walmart webhooks & scaffolding |
| **Limitations** | `userId` often defaulted until JWT wired end-to-end |
| **Status** | **Implemented** |

### 4.3 Forgot password (UI)

| Field | Description |
|--------|-------------|
| **Feature name** | Password reset request |
| **Status** | **Partial / broken** — no backend `auth/password-reset` found. |

### 4.4 Bulk listing image operations (UI)

| Field | Description |
|--------|-------------|
| **Feature name** | Bulk image operations |
| **Status** | **Missing** — server endpoint not found. |

---

## 5. Role-based matrix

| Role (DB) | Accessible modules *(intended)* | Actual access | Restricted *(intended)* | Approval rights | Admin rights |
|-----------|-----------------------------------|---------------|-------------------------|-----------------|--------------|
| `admin` | All | Same as others today *(not enforced)* | None enforced | Not modeled separately | Not enforced |
| `manager` | All | Same | None enforced | Needs verification | Not enforced |
| `user` | Core ops | Same | None enforced | N/A | No |
| `viewer` | Read-only | Same as full access unless UI hides | Edit/publish *should* be denied | No | No |

**Conclusion:** RBAC is **partial / missing** at product level until guards and UI gates ship.

---

## 6. Workflow summary (user journeys)

| Journey | Features & surfaces |
|---------|---------------------|
| Registration / onboarding | `/register` → JWT in storage → redirect *(no guided onboarding in code)* |
| Login | `/login` → JWT |
| Dashboard | `/` → multiple dashboard endpoints |
| Master data | Listings, templates, shipping/pricing settings, stores |
| Catalog discovery | `/catalog` → search/facets → `/sku/:id` |
| Listing creation | `/listings/new`; optional `generate` APIs |
| Image ingestion | `/ingestion` (adapter-based) **or** `/motors/upload` |
| Enterprise pipeline | `/pipeline` → job lifecycle → downloads |
| Fitment | `/fitment`; VIN flows `/fitment/vin` |
| Motors Intel | `/motors` → detail → pipeline/publish; `/motors/review` |
| Approvals | AI enhancement approve/apply; ingestion review; Motors review resolve |
| Publishing | Catalog publish modal; Motors publish; channel APIs |
| Orders | `/orders` |
| Import/export | CSV import; listings CSV export; ZIP template export |
| Notifications | `/notifications`; WebSocket |
| Administration | `/settings` |

---

## 7. Reports and dashboards

| Item | Purpose | Content / metrics | Filters | Export |
|------|---------|-------------------|---------|--------|
| Main dashboard | Ops overview | Listings, revenue, channels, pipeline, AI stats, activity, health, inventory alerts, multi-store | Store on summary | Needs verification |
| Orders page | Order ops | Orders + `/orders/stats` | Query params on list | CSV tracking inbound; dedicated export unclear |
| Audit trail | Compliance | Audit log query | Query params | Needs verification |
| Motors / pricing APIs | Intelligence | Stats, snapshots, competitor history | IDs, limits | JSON |

**Financial accounting reports:** Not evidenced beyond dashboard aggregates → treat as **missing** unless added.

**User-scheduled reports:** Not found → **missing**.

---

## 8. Automation and integrations

### 8.1 Automation

| Type | Examples |
|------|-----------|
| **Cron + BullMQ** | Storage cleanup; low-stock (4h); duplicate scan; order import (15m); auto-complete; dashboard recompute; sales rollup; listing refresh (48h); inventory sync (2h); competitor collection (4h) |
| **Rules engine** | `automation_rules`: triggers `schedule` / `event` / `condition`; actions: `update_price`, `sync_inventory`, `publish`, `end_listing`, `notify`, `apply_template` |
| **AI** | Enhancements, listing generation, ingestion AI, Motors enrichment, OpenAI module |
| **Realtime** | WebSocket notifications gateway; Motors **SSE** progress |

### 8.2 Integrations

| Integration | Purpose |
|-------------|---------|
| eBay | OAuth, publish, offers, orders, fitment MVL |
| Shopify / Amazon / Walmart | Webhook paths + inventory sync handlers |
| AWS S3 | Presigned uploads, assets |
| NHTSA | VIN decode |
| OpenAI | AI features |
| PostgreSQL | Primary data store |
| Redis | BullMQ |

**Payment gateways (Stripe/PayPal checkout):** Not surfaced for merchant checkout → **not evidenced** as in-scope.

---

## 9. Configuration features

- **Tenant:** `GET/PUT /api/settings/...`
- **Shipping profiles:** CRUD under settings
- **Pricing rules:** CRUD under settings
- **Channels:** connections + demo seed + legacy token connect
- **Automation rules:** full CRUD + execute
- **Templates:** full CRUD + preview/generate
- **Feature flags:** API only
- **Localization:** template ZIP formats US/AU/DE where applicable

Environment: DB, Redis, S3, CORS, JWT, ingestion provider, pipeline paths.

---

## 10. Product differentiators

- Automotive depth: fitment data, VIN, eBay compatibility builder, ACES-oriented bulk import  
- AI + human loop: approvals before apply  
- Multi-channel architecture: webhooks across major marketplaces *(depth: verify in ops)*  
- Pricing intelligence + scheduled competitor collection  
- Scale-oriented: queues, cron, multi-store dashboard metrics  

---

## 11. Gap analysis

| Gap | Importance | Business impact | Enhancement | Effort |
|-----|------------|-----------------|--------------|--------|
| No enforced RBAC | Critical | Wrong users could mutate data | JWT guard + roles + UI gates | Large |
| Password reset incomplete | High | Support burden | Backend flow + email | Medium |
| Bulk image ops missing | Medium | Broken bulk UX | Implement API + align UI | Medium |
| Export rules UI missing | Medium | Power users blocked | Admin UI | Medium |
| Feature flag UI missing | Low–Medium | Slower rollout | Small admin UI | Small |
| Global API auth | Critical | Exposure risk | Global guard + public exceptions | Medium–Large |
| Route ordering (inventory / AI enhancements) | Medium | 404/conflicts | Reorder Nest routes | Small |

---

## 12. Roadmap recommendations

1. **Critical:** Authenticate APIs, enforce RBAC, fix/forgot-password, close open-by-default risks.  
2. **High value:** Role-aware UI; wire user identity through audit/events; align bulk image ops.  
3. **Competitive:** Marketplace-specific UX completeness (Amazon/Walmart beyond webhooks).  
4. **UX:** Single product name; notification bell unread count; optional route guards on SPA.  
5. **Automation:** Safer dry-runs / validation surfaced in UI.  
6. **Strategic:** Search scaling / dual-read if catalog grows (per README hints).  

---

## 13. Sales and marketing summary

**Top 10 selling features (evidence-based)**

1. Multi-channel publish & sync  
2. Advanced catalog search & facets  
3. AI listing enhancements with approval  
4. Motors Intelligence lifecycle + review queue  
5. Spreadsheet enrichment pipeline + multi-region outputs  
6. Fitment + VIN-assisted compatibility  
7. Order ops with eBay fulfillment hooks  
8. Pricing intelligence + scheduled competitor monitoring  
9. Automation rules  
10. Dashboard KPIs + channel health + inventory alerts  

**Elevator pitch (draft):** RealTrackApp helps automotive marketplace teams build accurate listings faster, keep inventory and channels in sync, and run AI-assisted workflows with optional human approval—supported by dashboards, automation, and multi-marketplace integrations.

**ROI drivers:** listing throughput, fewer listing/compatibility errors, faster sync, reduced manual repricing.

---

## 14. Product brochure summary

**Overview:** Centralizes listing creation, catalog intelligence, multi-channel distribution, and post-sale operations for motors parts sellers.

**Modules:** Dashboard, Catalog, Listings, Ingestion & Pipeline, Motors Intelligence, Fitment & VIN, Imports & Compliance, Inventory, Channels & Stores, Orders, Pricing Intelligence, Automation, Templates, Notifications, Audit, Settings.

**Major features:** AI-assisted content, enrichment pipeline, marketplace publishing, webhooks, structured fitment, pricing analytics.

**Industry fit:** Automotive aftermarket teams selling via online marketplaces.

**Deployment:** React SPA via Vite; API proxied to Nest (`/api`). Production topology **needs verification** for your hosting.

---

## 15. Technical caveats (QA)

- **`InventoryController`:** Routes such as `alerts/low-stock`, `events/log`, `duplicates/scan` appear after `@Get(':listingId')`; static paths may fail to match.Needs fix/verification.in practice.  
- **`AiEnhancementController`:** `@Get('listing/:listingId')` ordering relative to `@Get(':id')` may break nested path matching — **needs verification**.

---

*End of catalog.*

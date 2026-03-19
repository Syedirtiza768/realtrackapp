# RealTrackApp — eBay Multi-Store + OpenAI Upgrade Blueprint

> **Version:** 2.0  
> **Date:** 2025-06-19  
> **Author:** Lead Solutions Architect  
> **System:** RealTrackApp (ListingPro) — NestJS 11 + React 18 + PostgreSQL 16 + Redis/BullMQ + AWS S3  
> **Objective:** Upgrade RealTrackApp to match the combined capabilities of GridxConnect and MergeKart using **exclusively eBay Developer Program APIs** and **OpenAI APIs**  
> **Marketplace Scope:** eBay-only (multiple storefronts linked from a single master inventory)  
> **AI Scope:** OpenAI-only (GPT-4o Vision, Chat Completions, Structured Outputs)

---

## STRICT ARCHITECTURE CONSTRAINTS

| Constraint | Rule |
|-----------|------|
| **API Ecosystem** | Backend powered exclusively by **eBay Developer Program APIs** (Inventory, Fulfillment, Taxonomy, Trading, Browse, Commerce) and **OpenAI APIs** (GPT-4o Vision, Chat Completions) |
| **Marketplace Scope** | eBay-only. No Amazon, Shopify, Walmart, Etsy, or WooCommerce adapters. |
| **Multi-Store Model** | Multiple connected eBay storefronts managed from a single master inventory. Cross-listing = publishing the same master SKU as tailored Offers to different eBay stores. |
| **AI Provider** | OpenAI exclusively. No Google Cloud Vision, no Keepa, no third-party scraping APIs. |
| **Shipping** | eBay-native shipping via Fulfillment API. No EasyPost, ShipStation, or AfterShip. |
| **Billing** | Out of scope. No Stripe/LemonSqueezy integration. |
| **Data Scale** | Database must handle millions of SKUs (auto-parts/complex items). All dropdowns use async fetching, pagination, and debounce. |

---

## TABLE OF CONTENTS

1. [Phase 1 — Current State Assessment](#phase-1--current-state-assessment)
2. [Phase 2 — Reference Platform Feature Extraction](#phase-2--reference-platform-feature-extraction)
3. [Phase 3 — Gap Analysis](#phase-3--gap-analysis)
4. [Phase 4 — Non-Destructive Implementation Plan](#phase-4--non-destructive-implementation-plan)
5. [File Checklist — All Files Requiring Updates](#file-checklist--all-files-requiring-updates)
6. [Appendix A — eBay API Surface Map](#appendix-a--ebay-api-surface-map)
7. [Appendix B — OpenAI API Surface Map](#appendix-b--openai-api-surface-map)
8. [Appendix C — Component Execution Standards](#appendix-c--component-execution-standards)
9. [Appendix D — Feature Flag Manifest](#appendix-d--feature-flag-manifest)
10. [Appendix E — Risk Register](#appendix-e--risk-register)

---

# PHASE 1 — CURRENT STATE ASSESSMENT

## 1.1 Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React 18 + Vite 6)              │
│   12 Routes · ~40 Components · ~11,800 active LOC              │
│   Tailwind CSS · React Router 7 · TanStack Query               │
│   Vite proxy /api → :4191                                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼─────────────────────────────────────┐
│                      BACKEND (NestJS 11)                        │
│   15 Modules · 14 Controllers · 19 Services · ~100+ Endpoints  │
│   TypeORM 0.3 · Swagger/OpenAPI · Passport JWT                  │
│   gzip compression · 3-tier rate limiting                       │
│                                                                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ │
│   │ Auth     │ │ Listings │ │ Channels     │ │ Ingestion    │ │
│   │ (JWT+    │ │ (CRUD+   │ │ (eBay+       │ │ (OpenAI      │ │
│   │  RBAC)   │ │  FTS+    │ │  Stores)     │ │  Vision+     │ │
│   │          │ │  Revisions│ │              │ │  BullMQ)     │ │
│   ├──────────┤ ├──────────┤ ├──────────────┤ ├──────────────┤ │
│   │ Fitment  │ │ Inventory│ │ Orders       │ │ Dashboard    │ │
│   │ (ACES)   │ │ (Ledger) │ │ (FSM)        │ │ (KPIs+Audit) │ │
│   ├──────────┤ ├──────────┤ ├──────────────┤ ├──────────────┤ │
│   │ Storage  │ │ Settings │ │ Notifications│ │ Health       │ │
│   │ (S3+CDN) │ │ (Pricing)│ │ (Socket.IO)  │ │ (Terminus)   │ │
│   ├──────────┤ ├──────────┤ ├──────────────┤ ├──────────────┤ │
│   │Automation│ │Templates │ │Motors Intel  │ │ CatalogImport│ │
│   │ (Rules)  │ │ (Listing)│ │(Vision+Enrich│ │ (Excel)      │ │
│   └──────────┘ └──────────┘ └──────────────┘ └──────────────┘ │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │          BullMQ (8 queues via Redis)                     │  │
│   └─────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │          EventEmitter2 (12 handlers, 1 active emitter)   │  │
│   └─────────────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────┬────────────────────┘
                           │                │
          ┌────────────────┼────────┐       │
          ▼                ▼        ▼       ▼
     PostgreSQL         Redis    AWS S3   eBay APIs + OpenAI
      (26 tables)                CloudFront
      (70+ indexes)
```

## 1.2 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React + Vite | 18.3 / 6.0 |
| UI | Tailwind CSS + shadcn/ui + Recharts + Lucide | 3.4 |
| Routing | React Router | 7.1 |
| Data Fetching | TanStack React Query + custom hooks | 5.x |
| Backend Framework | NestJS | 11.x |
| ORM | TypeORM | 0.3 |
| Database | PostgreSQL | 16 |
| Queue/Cache | Redis + BullMQ | — |
| Auth | Passport JWT + bcrypt + AES-256-GCM | — |
| Storage | AWS S3 + CloudFront CDN | — |
| AI | OpenAI GPT-4o Vision + Chat Completions | — |
| Image Processing | Sharp | 0.34 |
| WebSockets | Socket.IO | 4.8 |
| API Docs | Swagger/OpenAPI | — |
| Process Manager | PM2 (ecosystem.config.cjs) | — |
| Reverse Proxy | Nginx | — |

## 1.3 Core Modules — Current State

### Backend Modules (15)

| # | Module | Status | Key Capabilities |
|---|--------|--------|-----------------|
| 1 | **AuthModule** | ✅ Active | JWT auth, user CRUD, RBAC guards (admin/manager/user/viewer), bcrypt hashing |
| 2 | **ListingsModule** | ✅ Active | 76-column eBay entity, CRUD, FTS (tsvector+trigram), revisions, soft-delete, optimistic locking, bulk ops |
| 3 | **ChannelsModule** | ⚠️ Partial | eBay real adapter, Shopify real adapter (to be deprecated), Amazon + Walmart stubs (to be removed). Multi-store publishing, OAuth token encryption, AI enhancement controller, pricing push service |
| 4 | **IngestionModule** | ✅ Active | OpenAI GPT-4o Vision image→listing pipeline, review workflow, BullMQ processing |
| 5 | **FitmentModule** | ⚠️ Partial | ACES reference tables (make/model/year/engine), bulk import, fitment matching — **frontend is 100% mock data** |
| 6 | **InventoryModule** | ⚠️ Partial | Event-sourced ledger, reservations, reconciliation — **queue producers are dead code** |
| 7 | **OrdersModule** | ⚠️ Partial | FSM-based order management, import capability — **queue producers dead, no auto-import** |
| 8 | **DashboardModule** | ⚠️ Partial | Summary KPIs, audit logs, sales records, metrics cache — **aggregation queue dead** |
| 9 | **SettingsModule** | ⚠️ Partial | Tenant config, shipping profiles, pricing rules — **frontend Add buttons are no-ops** |
| 10 | **StorageModule** | ✅ Active | S3 upload/presigned URLs, CDN, Sharp thumbnails/WebP/blurhash |
| 11 | **NotificationsModule** | ✅ Active | Persistent DB notifications, WebSocket push via Socket.IO |
| 12 | **AutomationModule** | 🆕 Scaffold | Rule entity, controller, service — **early scaffold, not wired** |
| 13 | **TemplateModule** | 🆕 Scaffold | Template entity, controller, service — **early scaffold** |
| 14 | **MotorsIntelligenceModule** | 🆕 Scaffold | Vision extraction, fitment resolver, listing generator, compliance engine — **services exist, not integrated** |
| 15 | **CommonModule** | ✅ Active | Feature flags, scheduler, RBAC guards, cache utilities |

### External Integrations (Current)

| Integration | Status | Disposition Under New Architecture |
|-------------|--------|-----------------------------------|
| eBay Trading/Inventory API | ✅ Real OAuth2 | **KEEP + EXPAND** — primary marketplace API |
| Shopify Admin API | ✅ Real REST | **DEPRECATE** — soft-deprecate adapter, no new development |
| Amazon SP-API | ❌ Stub only | **REMOVE** — delete stub adapter |
| Walmart Marketplace API | ❌ Stub only | **REMOVE** — delete stub adapter |
| OpenAI GPT-4o Vision | ✅ Active | **KEEP + EXPAND** — sole AI provider |
| AWS S3 / CloudFront | ✅ Active | **KEEP** — image storage and CDN |

## 1.4 Known Technical Debt

| Category | Issue |
|----------|-------|
| **Dead Code** | 4 BullMQ queues with processors but no producers (inventory, orders, dashboard, storage-cleanup) |
| **Dead Code** | 11/12 EventEmitter2 handlers have no emitters |
| **Dead Code** | 6 frontend files (~73K lines) never imported |
| **Dead Code** | Amazon adapter stub, Walmart adapter stub (to be removed) |
| **Dead Code** | Shopify adapter (to be soft-deprecated) |
| **Schema** | `startPrice`, `quantity`, cost fields stored as TEXT not NUMERIC |
| **Schema** | Dual channel mapping tables (`channel_listings` + `listing_channel_instances`) |
| **Schema** | 8 missing FK constraints |
| **Security** | Frontend has NO authentication (no login page, no token management) |
| **Security** | 4× `dangerouslySetInnerHTML` without sanitization (XSS) |
| **UX** | FitmentManager entirely mock data |
| **UX** | Settings "Add" buttons non-functional |
| **UX** | Shell header search non-functional |
| **Architecture** | Single-tenant only (no org/team model) |
| **Architecture** | No scheduled tasks despite `@nestjs/schedule` being installed |

---

# PHASE 2 — REFERENCE PLATFORM FEATURE EXTRACTION

## 2.1 GridxConnect Features (Mapped to eBay + OpenAI)

| # | Feature | Implementation Strategy |
|---|---------|------------------------|
| A1 | **75M+ Parts Database** | Build a master SKU database seeded from eBay catalog data (Taxonomy API category items) + supplier CSV imports + OpenAI-assisted data normalization |
| A2 | **1B+ Cross References** | OpenAI pipeline: raw supplier part numbers → standardized OEM/aftermarket cross-references stored in `cross_references` table |
| A3 | **1B+ Fitment Matches** | eBay Taxonomy API → Master Vehicle List (MVL) fetch. Map compatibility arrays (Make, Model, Year, Trim, Engine) into normalized fitment tables |
| A4 | **VIN Decode → Fitment** | NHTSA vPIC API (free, no auth) for VIN decode → YMMET. Map decoded vehicle to eBay compatibility format |
| A5 | **ePID Mapping** | eBay Catalog API ePID lookups. Store ePID→product mappings locally for fast resolution |
| A6 | **Automatic Data Enrichment** | OpenAI: raw part data → enriched listing (title, specifics, description, fitment). Structured JSON output mode |
| A7 | **Part Identification** | OpenAI GPT-4o Vision: image → part identification. Cross-reference against local parts DB |
| A8 | **AI Assistant Bot** | OpenAI Chat Completions with system context loaded from parts DB. WebSocket-based chat UI |

## 2.2 MergeKart Features (Mapped to eBay + OpenAI)

| # | Feature | Implementation Strategy |
|---|---------|------------------------|
| E1 | **Cross-Listing Setup** | Connect multiple eBay seller accounts via OAuth. One master inventory → multiple eBay Offer objects per store |
| E2 | **Auto-Publish on Create** | EventEmitter2: on `listing.status_changed` → auto-create eBay Offers for all connected stores per export rules |
| E3 | **Designer Templates** | Template module + OpenAI: user selects template + context (OEM#, condition) → OpenAI generates optimized HTML description |
| E4 | **Custom Export Rules** | Per-store, per-category rules: price markups, title prefixes, condition overrides, shipping policy selection |
| E5 | **Pricing Rule Automation** | Dynamic pricing rules bound to specific eBay storeIds. Market intelligence via eBay Browse API + OpenAI analysis |
| E6 | **Multi-Store Management** | Single dashboard managing 2–20+ eBay stores. Each store has its own fulfillment policies, locations, pricing |
| E7 | **Smart Inventory Sync** | Master inventory count → eBay Inventory API `updateOffer` pushes available quantity to all stores. Oversell prevention via SERIALIZABLE ledger |
| E8 | **Bulk Operations** | Bulk listing create/edit/publish/delete/reprice across all stores |
| F1 | **Unified Order Dashboard** | eBay Fulfillment API → pull orders from all connected stores into single view |
| F2 | **Bulk Order Actions** | Bulk ship, bulk cancel, bulk update tracking |
| F3 | **Shipping via eBay** | eBay-native shipping (Fulfillment API `createShippingFulfillment`). No third-party carrier APIs |
| F6 | **CSV Tracking Upload** | Bulk upload tracking numbers → `createShippingFulfillment` per order |
| F7 | **Multi-Order Bundling** | Detect same-buyer orders for combined shipment |
| F12 | **Automated Order Workflows** | Automation rules: on order status change → update inventory, send notification, update dashboard |
| G1 | **Competitor Price Tracking** | eBay Browse API `search` for similar items by MPN/keyword → capture competitor prices |
| G3 | **AI Dynamic Pricing** | Feed competitor prices + base costs to OpenAI → suggest optimal price → auto-update eBay Offers |
| G4 | **AI Product Matching** | OpenAI: compare product attributes to identify same products listed with different SKUs/descriptions |

## 2.3 Combined Feature Taxonomy

| Category | ID | Feature | Source | Priority |
|----------|----|---------|--------|----------|
| **Data Intelligence** | DI-1 | Master Parts Database (millions of SKUs) | GridX | P0 |
| | DI-2 | OEM ↔ Aftermarket Cross-References (OpenAI pipeline) | GridX | P0 |
| | DI-3 | Fitment Database (eBay MVL + ACES) | GridX | P0 |
| | DI-4 | VIN Decode → YMMET (NHTSA vPIC) | GridX | P1 |
| | DI-5 | ePID Mapping (eBay Catalog) | GridX | P1 |
| | DI-6 | OpenAI Data Enrichment Pipeline | GridX | P0 |
| | DI-7 | OpenAI Part Identification (Vision) | GridX | P0 |
| | DI-8 | OpenAI Product Matching | MergeKart | P1 |
| | DI-9 | OpenAI Assistant Bot | GridX | P2 |
| **eBay Multi-Store** | MS-1 | Multi-Account OAuth Connection | MergeKart | P0 |
| | MS-2 | Auto-Publish Offers to All Stores | MergeKart | P0 |
| | MS-3 | Per-Store Export Rules (price/title/shipping) | MergeKart | P0 |
| | MS-4 | Designer Templates + OpenAI Generation | MergeKart | P1 |
| | MS-5 | eBay-Ready Listing Generation | GridX | P0 |
| | MS-6 | eBay Category Mapping (Taxonomy API) | Both | P0 |
| | MS-7 | Scheduled Listing Refresh | MergeKart | P2 |
| | MS-8 | Bulk Cross-Store Operations | MergeKart | P0 |
| **Inventory** | INV-1 | Real-Time Cross-Store Inventory Sync | Both | P0 |
| | INV-2 | Oversell Prevention (ledger + reservation) | MergeKart | P0 |
| | INV-3 | SKU Deduplication | MergeKart | P1 |
| **Pricing** | PR-1 | Dynamic Pricing Rules per Store | MergeKart | P0 |
| | PR-2 | Competitor Price Tracking (eBay Browse API) | Both | P1 |
| | PR-3 | OpenAI Pricing Suggestions | Both | P1 |
| | PR-4 | Auto-Reprice eBay Offers | Both | P0 |
| **Order Management** | OM-1 | Unified Multi-Store Order Dashboard | MergeKart | P0 |
| | OM-2 | Auto-Import Orders (eBay Fulfillment API) | MergeKart | P0 |
| | OM-3 | Bulk Order Processing | MergeKart | P1 |
| | OM-4 | eBay Shipping Fulfillment | MergeKart | P1 |
| | OM-5 | CSV Tracking Upload | MergeKart | P1 |
| | OM-6 | Multi-Order Bundling | MergeKart | P2 |
| | OM-7 | Picklist Generation | MergeKart | P2 |
| **Automation** | AU-1 | Rules Engine (trigger → condition → action) | MergeKart | P0 |
| | AU-2 | Auto-Tag/Auto-Status Workflows | MergeKart | P1 |
| | AU-3 | Scheduled/Event/Condition Triggers | MergeKart | P0 |
| **Analytics** | AN-1 | Unified Analytics Dashboard | Both | P0 |
| | AN-2 | Sales Reports (downloadable) | MergeKart | P1 |
| | AN-3 | Per-Store KPIs & Metrics | Both | P1 |
| | AN-4 | Competitive Intelligence Dashboard | Both | P1 |
| **Platform** | PL-1 | Frontend Auth (Login/Register/RBAC) | — | P0 |
| | PL-2 | eBay Store Onboarding Wizard | Both | P1 |
| | PL-3 | Bulk Operations UI | Both | P0 |
| | PL-4 | Intuitive UX / Functional Settings | — | P0 |

---

# PHASE 3 — GAP ANALYSIS

## 3.1 Feature-by-Feature Gap Matrix

| ID | Feature | Current State | Gap | Description |
|----|---------|---------------|-----|-------------|
| **DI-1** | Master Parts DB | ❌ None | 🔴 **FULL** | Listings come only from eBay Excel imports. No master SKU schema designed for millions of records. |
| **DI-2** | Cross-References (OpenAI) | ❌ None | 🔴 **FULL** | No cross-reference tables. `cOeOemPartNumber` is flat text. No OpenAI normalization pipeline. |
| **DI-3** | Fitment DB (eBay MVL) | ⚠️ Partial | 🟡 **PARTIAL** | ACES tables exist. No eBay Taxonomy API MVL fetch. Frontend is 100% mock. |
| **DI-4** | VIN Decode | ⚠️ Scaffold | 🟡 **PARTIAL** | Frontend has sample VIN decode map. No backend NHTSA service. |
| **DI-5** | ePID Mapping | ⚠️ Minimal | 🟡 **PARTIAL** | Frontend has ePID filter UI. No backend ePID lookup or eBay Catalog API integration. |
| **DI-6** | OpenAI Enrichment | ✅ Partial | 🟢 **MINOR** | GPT-4o Vision pipeline exists. Gap: no structured JSON output mode, no parts DB cross-validation. |
| **DI-7** | OpenAI Part ID | ✅ Active | 🟢 **MINOR** | AI image analysis works. Gap: no validation against local parts DB. |
| **DI-8** | OpenAI Product Matching | ❌ None | 🔴 **FULL** | No product matching logic. |
| **DI-9** | OpenAI Assistant Bot | ❌ None | 🟡 **PARTIAL** | OpenAI integration exists but no chat interface. |
| **MS-1** | Multi-Account OAuth | ⚠️ Partial | 🟡 **PARTIAL** | `stores` table + `channel_connections` exist with OAuth token encryption. Gap: no multi-account eBay OAuth flow UI, no per-store token management UX. |
| **MS-2** | Auto-Publish Offers | ❌ Missing | 🔴 **FULL** | Publishing is manual. `listing.published` event handler is dead code. No eBay Inventory API `createOffer` automation. |
| **MS-3** | Per-Store Export Rules | ❌ Missing | 🔴 **FULL** | No export rule system. Automation module is scaffold only. |
| **MS-4** | Templates + OpenAI | ⚠️ Scaffold | 🟡 **PARTIAL** | Template module entity exists. No rendering engine, no OpenAI integration, no designer UI. |
| **MS-5** | eBay-Ready Listing Gen | ✅ Active | 🟢 **MINOR** | Motors Intelligence listing-generator exists. Gap: doesn't use eBay Taxonomy API for category-specific item specifics. |
| **MS-6** | eBay Category Mapping | ❌ Missing | 🔴 **FULL** | No Taxonomy API integration. No category tree storage. |
| **MS-7** | Scheduled Refresh | ❌ Missing | 🟡 **PARTIAL** | Scheduler module exists. No listing refresh job. |
| **MS-8** | Bulk Cross-Store Ops | ⚠️ Partial | 🟡 **PARTIAL** | Backend has bulk status/publish. Missing: bulk reprice, bulk category change across stores. |
| **INV-1** | Cross-Store Inventory Sync | ⚠️ Partial | 🟡 **PARTIAL** | Inventory ledger exists. `inventory` queue processor exists. **No producers, no eBay Inventory API `updateOffer` quantity push.** |
| **INV-2** | Oversell Prevention | ⚠️ Partial | 🟡 **PARTIAL** | SERIALIZABLE transactions + reservations exist. Not connected to eBay order flow. |
| **INV-3** | SKU Deduplication | ❌ Missing | 🔴 **FULL** | Each import creates new records. No dedup logic. |
| **PR-1** | Dynamic Pricing per Store | ⚠️ Partial | 🟡 **PARTIAL** | `pricing_rules` table exists. Gap: rules not bound to specific storeIds. |
| **PR-2** | Competitor Tracking (eBay Browse) | ❌ Missing | 🔴 **FULL** | No eBay Browse API integration. No competitor data collection. |
| **PR-3** | OpenAI Pricing Suggestions | ❌ Missing | 🔴 **FULL** | No pipeline to feed costs + competitor data to OpenAI for price optimization. |
| **PR-4** | Auto-Reprice Offers | ⚠️ Scaffold | 🟡 **PARTIAL** | `pricing-push.service.ts` exists. Not wired to automation triggers or eBay Inventory API. |
| **OM-1** | Multi-Store Order Dashboard | ✅ Active | 🟢 **MINOR** | OrdersPage exists. Gap: orders not tagged by store, no store-level filtering. |
| **OM-2** | Auto-Import Orders (Fulfillment API) | ⚠️ Dead Code | 🟡 **PARTIAL** | `orders` queue + processor exist. Zero producers. No eBay Fulfillment API `getOrders` integration. |
| **OM-3** | Bulk Order Processing | ❌ Missing | 🔴 **FULL** | No bulk order operations. |
| **OM-4** | eBay Shipping Fulfillment | ❌ Missing | 🔴 **FULL** | No `createShippingFulfillment` integration. Shipping profiles are config-only. |
| **OM-5** | CSV Tracking Upload | ❌ Missing | 🔴 **FULL** | No bulk tracking upload. |
| **OM-6** | Multi-Order Bundling | ❌ Missing | 🔴 **FULL** | No bundling logic. |
| **OM-7** | Picklist Generation | ❌ Missing | 🔴 **FULL** | No warehouse fulfillment tools. |
| **AU-1** | Automation Rules Engine | ⚠️ Scaffold | 🟡 **PARTIAL** | Entity + controller + service exist. No rule evaluation or action execution. |
| **AU-2** | Auto-Tag/Status Workflows | ❌ Missing | 🔴 **FULL** | No workflow automation. |
| **AU-3** | Triggers (Schedule/Event/Condition) | ⚠️ Partial | 🟡 **PARTIAL** | Scheduler + EventEmitter2 exist. 11/12 event handlers dead. No trigger→action mapping. |
| **AN-1** | Analytics Dashboard | ⚠️ Partial | 🟡 **PARTIAL** | Dashboard exists. Aggregation queue is dead. Basic counts only. |
| **AN-2** | Downloadable Reports | ❌ Missing | 🔴 **FULL** | No CSV/PDF export. |
| **AN-3** | Per-Store KPIs | ❌ Missing | 🔴 **FULL** | No per-store metrics breakdown. |
| **AN-4** | Competitive Intelligence | ❌ Missing | 🔴 **FULL** | No competitive data visualization. |
| **PL-1** | Frontend Auth | ❌ Missing | 🔴 **FULL** | No login page, no token management, hardcoded "Demo User". |
| **PL-2** | eBay Store Onboarding | ❌ Missing | 🔴 **FULL** | No onboarding wizard. |
| **PL-3** | Bulk Operations UI | ⚠️ Partial | 🟡 **PARTIAL** | Selection UI exists. Missing: bulk reprice, bulk category, bulk across stores. |
| **PL-4** | Functional UX | ⚠️ Partial | 🟡 **PARTIAL** | Settings add-buttons broken, fitment mock, header search dead. |

## 3.2 Gap Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| 🟢 Minor Gap (>80%) | 5 | DI-6, DI-7, MS-5, OM-1, existing CRUD |
| 🟡 Partial (30-80%) | 17 | DI-3, DI-4, DI-5, DI-9, MS-1, MS-4, MS-7, MS-8, INV-1, INV-2, PR-1, PR-4, OM-2, AU-1, AU-3, AN-1, PL-3, PL-4 |
| 🔴 Full Gap (<30%) | 20 | DI-1, DI-2, DI-8, MS-2, MS-3, MS-6, INV-3, PR-2, PR-3, OM-3, OM-4, OM-5, OM-6, OM-7, AU-2, AN-2, AN-3, AN-4, PL-1, PL-2 |

## 3.3 Architectural Bottlenecks

| Bottleneck | Impact | Resolution Phase |
|------------|--------|-----------------|
| **No eBay Inventory API integration** | Cannot create Offers, sync inventory, or manage multi-store publishing | Phase 1 |
| **No eBay Taxonomy API integration** | Cannot fetch categories, item specifics, or MVL for fitment | Phase 1 |
| **No eBay Fulfillment API integration** | Cannot import orders or create shipping fulfillments | Phase 4 |
| **No eBay Browse API integration** | Cannot track competitor pricing | Phase 5 |
| **Dead BullMQ Queues** | Inventory/orders/dashboard processors exist but never execute | Phase 1 |
| **Dead Event System** | 11/12 handlers dead; blocks automation | Phase 1 |
| **No Auth Frontend** | Security hole; blocks user-facing features | Phase 1 |
| **TEXT Price Columns** | Cannot do numeric pricing calculations in SQL | Phase 1 |
| **Shopify/Amazon/Walmart adapters** | Dead code that adds confusion | Phase 1 (cleanup) |
| **All dropdowns sync/static** | Will crash at scale with millions of SKUs | Phase 2 |

---

# PHASE 4 — NON-DESTRUCTIVE IMPLEMENTATION PLAN

## 4.0 Guiding Principles

1. **Zero Breaking Changes** — Every existing API endpoint, database table, and frontend route continues to function identically.
2. **Feature Flags First** — All new capabilities gated behind `feature_flags` table entries, default `OFF`.
3. **Additive Schema Only** — `ADD COLUMN IF NOT EXISTS`, new tables alongside existing. No drops until cleanup phase.
4. **eBay API Exclusivity** — All marketplace interactions go through eBay Developer Program APIs. No third-party marketplace APIs.
5. **OpenAI Exclusivity** — All AI operations (enrichment, generation, analysis, matching, pricing suggestions) use OpenAI APIs exclusively.
6. **Two-Way Data Mapping** — Raw eBay/ERP data primitives ↔ `{ label, value }` objects for UI. Extract primitives on `onChange` for eBay JSON payloads.
7. **Async-First Dropdowns** — All selects handling fitment, parts, categories, or any large dataset use async fetching, server-side pagination, and debounce (300ms).

---

## PHASE 1: Core API & Infrastructure (Weeks 1–4)

**Goal:** Establish the eBay API gateway, OpenAI integration layer, and unified master SKU schema. Fix critical dead infrastructure.

### 1.1 eBay API Gateway

**Establish OAuth flows and secure token management for connecting multiple eBay seller accounts simultaneously.**

#### 1.1.1 Multi-Account eBay OAuth Service

Refactor existing `channels.service.ts` and `token-encryption.service.ts` to support multiple simultaneous eBay OAuth sessions.

```
backend/src/channels/
├── ebay/
│   ├── ebay-auth.service.ts            ← NEW: Multi-account OAuth2 flow manager
│   ├── ebay-inventory-api.service.ts   ← NEW: eBay Inventory API client
│   ├── ebay-taxonomy-api.service.ts    ← NEW: eBay Taxonomy API client  
│   ├── ebay-fulfillment-api.service.ts ← NEW: eBay Fulfillment API client (Phase 4)
│   ├── ebay-browse-api.service.ts      ← NEW: eBay Browse API client (Phase 5)
│   └── ebay-api.types.ts              ← NEW: Shared eBay API type definitions
├── adapters/
│   └── ebay/
│       └── ebay.adapter.ts            ← MODIFY: Use new service layer
```

**Key Design:**

```typescript
// ebay-auth.service.ts — manages per-store OAuth tokens
@Injectable()
export class EbayAuthService {
  // Get valid access token for a specific store (auto-refresh if expired)
  async getAccessToken(storeId: string): Promise<string>;
  
  // Initiate OAuth consent flow for new store connection
  async initiateOAuth(redirectUri: string): Promise<{ authUrl: string; state: string }>;
  
  // Handle OAuth callback, store encrypted tokens
  async handleOAuthCallback(code: string, state: string): Promise<Store>;
  
  // Refresh token for a specific store
  async refreshToken(storeId: string): Promise<void>;
}
```

**Database — extend `stores` table:**

```sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ebay_user_id VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ebay_site_id VARCHAR(10) DEFAULT 'EBAY_US';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS ebay_marketplace_id VARCHAR(20) DEFAULT 'EBAY_US';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS fulfillment_policy_id VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payment_policy_id VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS return_policy_id VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS location_key VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
```

#### 1.1.2 eBay Inventory API Integration

```typescript
// ebay-inventory-api.service.ts
@Injectable()
export class EbayInventoryApiService {
  // Inventory Item operations (master product data)
  async createOrReplaceInventoryItem(storeId: string, sku: string, data: EbayInventoryItem): Promise<void>;
  async getInventoryItem(storeId: string, sku: string): Promise<EbayInventoryItem>;
  async getInventoryItems(storeId: string, limit: number, offset: number): Promise<EbayInventoryItemPage>;
  async deleteInventoryItem(storeId: string, sku: string): Promise<void>;
  
  // Offer operations (per-store listing configuration)
  async createOffer(storeId: string, offer: EbayOffer): Promise<{ offerId: string }>;
  async updateOffer(storeId: string, offerId: string, updates: Partial<EbayOffer>): Promise<void>;
  async publishOffer(storeId: string, offerId: string): Promise<{ listingId: string }>;
  async withdrawOffer(storeId: string, offerId: string): Promise<void>;
  async getOffers(storeId: string, sku: string): Promise<EbayOffer[]>;
  
  // Inventory Location operations
  async createInventoryLocation(storeId: string, location: EbayLocation): Promise<void>;
  async getInventoryLocations(storeId: string): Promise<EbayLocation[]>;
  
  // Bulk operations
  async bulkCreateOrReplaceInventoryItems(storeId: string, items: EbayInventoryItem[]): Promise<BulkResponse>;
  async bulkUpdatePriceQuantity(storeId: string, updates: EbayPriceQuantityUpdate[]): Promise<BulkResponse>;
}
```

#### 1.1.3 eBay Taxonomy API Integration

```typescript
// ebay-taxonomy-api.service.ts
@Injectable()
export class EbayTaxonomyApiService {
  // Category tree
  async getCategoryTree(marketplaceId: string): Promise<EbayCategoryTree>;
  async getCategorySubtree(categoryId: string): Promise<EbayCategorySubtree>;
  async getCategorySuggestions(query: string): Promise<EbayCategorySuggestion[]>;
  
  // Item specifics (aspects) for a category
  async getItemAspectsForCategory(categoryId: string): Promise<EbayAspect[]>;
  
  // Compatibility properties (fitment)
  async getCompatibilityProperties(categoryId: string): Promise<EbayCompatibilityProperty[]>;
  async getCompatibilityPropertyValues(
    categoryId: string, 
    propertyName: string, 
    filter?: { make?: string; model?: string; year?: string }
  ): Promise<EbayCompatibilityValue[]>;
}
```

### 1.2 OpenAI Integration Layer

**Set up middleware to handle prompt queuing, rate-limiting, and structured JSON outputs.**

Extend the existing `backend/src/ingestion/ai/` module into a shared service:

```
backend/src/common/openai/
├── openai.module.ts               ← NEW: Global OpenAI module
├── openai.service.ts              ← NEW: Central OpenAI client with rate limiting
├── openai-queue.service.ts        ← NEW: BullMQ-backed prompt queue for high-volume operations
├── prompts/
│   ├── enrichment.prompt.ts       ← NEW: Part data enrichment prompt templates
│   ├── listing-generation.prompt.ts ← NEW: eBay listing generation prompts
│   ├── cross-reference.prompt.ts  ← NEW: OEM/aftermarket standardization prompts
│   ├── pricing-analysis.prompt.ts ← NEW: Competitive pricing analysis prompts
│   ├── product-matching.prompt.ts ← NEW: Product deduplication/matching prompts
│   └── fitment-extraction.prompt.ts ← NEW: Fitment extraction from unstructured text
└── openai.types.ts                ← NEW: Response types, structured output schemas
```

**Key Design:**

```typescript
// openai.service.ts — central, rate-limited OpenAI client
@Injectable()
export class OpenAiService {
  // Vision: image analysis
  async analyzeImage(imageUrls: string[], systemPrompt: string): Promise<OpenAiStructuredResponse>;
  
  // Chat: structured JSON output
  async generateStructuredJson<T>(
    systemPrompt: string,
    userMessage: string,
    schema: z.ZodSchema<T>,  // Zod schema for response_format
    options?: { temperature?: number; model?: string }
  ): Promise<T>;
  
  // Chat: free-form text
  async generateText(systemPrompt: string, userMessage: string): Promise<string>;
  
  // Batch: queue multiple prompts
  async enqueueBatch(jobs: OpenAiJobPayload[]): Promise<string[]>; // returns job IDs
  
  // Cost tracking
  async getUsageStats(since: Date): Promise<{ tokens: number; cost: number }>;
}
```

**Rate Limiting:**
- Queue concurrency: 5 parallel OpenAI requests
- Rate limit: 60 requests/minute (configurable via `OPENAI_RPM` env var)
- Retry: 3 attempts with exponential backoff (429 → wait → retry)
- Cost cap: configurable daily spend limit via `OPENAI_DAILY_COST_CAP` env var

### 1.3 Unified Master SKU Schema

**Design the central database to hold base product data, linking out to one-to-many eBay offer payloads.**

```sql
-- ═══ Master product (source of truth, marketplace-agnostic) ═══
CREATE TABLE master_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             VARCHAR(100) NOT NULL UNIQUE,
  
  -- Core identity
  title           VARCHAR(200) NOT NULL,
  brand           VARCHAR(100),
  mpn             VARCHAR(100),
  oem_numbers     TEXT[],                     -- array of OEM part numbers
  aftermarket_numbers TEXT[],                 -- array of aftermarket part numbers
  upc             VARCHAR(20),
  ean             VARCHAR(20),
  epid            VARCHAR(30),
  
  -- Classification  
  part_type       VARCHAR(100),
  category_name   VARCHAR(200),
  ebay_category_id VARCHAR(20),
  condition       VARCHAR(30) NOT NULL DEFAULT 'NEW',
  condition_description TEXT,
  
  -- Product data
  description_html TEXT,
  features        TEXT[],
  item_specifics  JSONB DEFAULT '{}',          -- { "Brand": "TRW", "Placement": "Front", ... }
  
  -- Pricing
  base_cost       NUMERIC(12,2),               -- acquisition cost
  msrp            NUMERIC(12,2),
  default_price   NUMERIC(12,2),
  weight_oz       NUMERIC(8,2),
  
  -- Inventory
  total_quantity  INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  warehouse_location VARCHAR(100),
  
  -- Fitment
  compatibility   JSONB DEFAULT '[]',          -- eBay-format compatibility array
  fitment_verified BOOLEAN DEFAULT false,
  
  -- Images
  image_urls      TEXT[],                      -- S3/CDN URLs in display order
  
  -- AI metadata
  ai_enriched     BOOLEAN DEFAULT false,
  ai_enriched_at  TIMESTAMPTZ,
  ai_confidence   REAL,
  
  -- Lifecycle
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','ready','active','paused','archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_mp_sku ON master_products(sku);
CREATE INDEX idx_mp_mpn ON master_products(mpn);
CREATE INDEX idx_mp_brand ON master_products(brand);
CREATE INDEX idx_mp_status ON master_products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_mp_category ON master_products(ebay_category_id);
CREATE INDEX idx_mp_oem ON master_products USING GIN(oem_numbers);
CREATE INDEX idx_mp_aftermarket ON master_products USING GIN(aftermarket_numbers);
CREATE INDEX idx_mp_search ON master_products USING GIN(
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(mpn,''))
);

-- ═══ Per-store eBay offer (one master product → many offers) ═══
CREATE TABLE ebay_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id UUID NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- eBay identifiers
  ebay_offer_id   VARCHAR(50),                 -- from createOffer response
  ebay_listing_id VARCHAR(50),                 -- from publishOffer response  
  ebay_sku        VARCHAR(100),                -- can differ from master SKU
  
  -- Per-store overrides
  title_override  VARCHAR(200),                -- NULL = use master title
  price           NUMERIC(12,2) NOT NULL,      -- store-specific price
  quantity        INTEGER NOT NULL,             -- store-specific available qty
  description_override TEXT,                   -- NULL = use master description
  condition_override VARCHAR(30),              -- NULL = use master condition
  
  -- eBay policies (per-store)
  fulfillment_policy_id VARCHAR(50),
  payment_policy_id     VARCHAR(50),
  return_policy_id      VARCHAR(50),
  listing_format  VARCHAR(20) DEFAULT 'FIXED_PRICE',
  
  -- Sync state
  sync_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending','synced','error','withdrawn')),
  last_synced_at  TIMESTAMPTZ,
  last_error      TEXT,
  
  -- Lifecycle
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(master_product_id, store_id)
);

CREATE INDEX idx_offer_store ON ebay_offers(store_id, sync_status);
CREATE INDEX idx_offer_product ON ebay_offers(master_product_id);
CREATE INDEX idx_offer_ebay_listing ON ebay_offers(ebay_listing_id);

-- ═══ Cross-references (OpenAI-populated) ═══
CREATE TABLE cross_references (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oem_number          VARCHAR(100) NOT NULL,
  aftermarket_number  VARCHAR(100) NOT NULL,
  brand               VARCHAR(100),
  part_type           VARCHAR(100),
  source              VARCHAR(30) NOT NULL DEFAULT 'openai',  -- 'openai' | 'manual' | 'import'
  confidence          REAL DEFAULT 1.0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(oem_number, aftermarket_number)
);

CREATE INDEX idx_xref_oem ON cross_references(oem_number);
CREATE INDEX idx_xref_aftermarket ON cross_references(aftermarket_number);

-- ═══ eBay category cache (Taxonomy API) ═══
CREATE TABLE ebay_categories (
  id              SERIAL PRIMARY KEY,
  category_id     VARCHAR(20) NOT NULL UNIQUE,
  category_name   VARCHAR(300) NOT NULL,
  parent_id       VARCHAR(20),
  tree_level      INTEGER,
  leaf_node       BOOLEAN DEFAULT false,
  marketplace_id  VARCHAR(20) DEFAULT 'EBAY_US',
  aspects         JSONB DEFAULT '[]',           -- cached item specifics
  compatibility_enabled BOOLEAN DEFAULT false,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ecat_parent ON ebay_categories(parent_id);
CREATE INDEX idx_ecat_name ON ebay_categories USING GIN(to_tsvector('english', category_name));

-- ═══ Competitor prices (eBay Browse API) ═══
CREATE TABLE competitor_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id   UUID REFERENCES master_products(id),
  mpn                 VARCHAR(100),
  search_keyword      VARCHAR(300),
  competitor_item_id  VARCHAR(50),
  competitor_seller   VARCHAR(100),
  competitor_price    NUMERIC(12,2) NOT NULL,
  competitor_shipping NUMERIC(12,2) DEFAULT 0,
  competitor_condition VARCHAR(30),
  competitor_url      TEXT,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comp_mpn ON competitor_prices(mpn, captured_at DESC);
CREATE INDEX idx_comp_product ON competitor_prices(master_product_id, captured_at DESC);

-- ═══ Market snapshots (aggregated from competitor data + OpenAI analysis) ═══
CREATE TABLE market_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpn             VARCHAR(100) NOT NULL,
  avg_price       NUMERIC(12,2),
  min_price       NUMERIC(12,2),
  max_price       NUMERIC(12,2),
  seller_count    INTEGER,
  price_trend_pct REAL,
  ai_suggestion   JSONB,                -- OpenAI pricing recommendation
  snapshot_date   DATE NOT NULL,
  UNIQUE(mpn, snapshot_date)
);

-- ═══ Export rules (per-store publishing rules) ═══
CREATE TABLE export_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id),
  name            VARCHAR(200) NOT NULL,
  condition_type  VARCHAR(30) NOT NULL,  -- 'all' | 'category' | 'brand' | 'price_range' | 'part_type'
  condition_value JSONB DEFAULT '{}',
  overrides       JSONB DEFAULT '{}',    -- { price_markup_pct, title_prefix, fulfillment_policy_id }
  enabled         BOOLEAN DEFAULT true,
  priority        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_export_store ON export_rules(store_id, enabled);
```

### 1.4 Wire Dead Infrastructure

#### 1.4.1 Wire Dead BullMQ Queue Producers

| Queue | Producer | Trigger | Feature Flag |
|-------|----------|---------|-------------|
| `inventory` | `InventorySyncScheduler` | Cron every 15m | `inventory_real_time_sync` |
| `orders` | `OrderImportScheduler` | Cron every 15m | `order_auto_import` |
| `dashboard` | `DashboardAggregationScheduler` | Cron every 1h | `dashboard_aggregation` |
| `storage-cleanup` | `StorageCleanupScheduler` | Cron daily 3AM | always ON |

#### 1.4.2 Wire Dead EventEmitter2 Emitters

| Event | Emit Point | File |
|-------|-----------|------|
| `ingestion.completed` | After AI processing success | `ingestion.processor.ts` |
| `ingestion.failed` | In catch block | `ingestion.processor.ts` |
| `channel.connected` | After OAuth callback | `channels.service.ts` |
| `listing.published` | After successful eBay publish | `channels.service.ts` |
| `inventory.low_stock` | After ledger update | `inventory.service.ts` |
| `order.new` | After order import | `orders.service.ts` |

#### 1.4.3 Frontend Auth

| New File | Purpose |
|----------|---------|
| `src/components/auth/LoginPage.tsx` | Login form |
| `src/components/auth/RegisterPage.tsx` | Registration |
| `src/components/auth/AuthProvider.tsx` | Token context |
| `src/lib/authApi.ts` | Auth API calls |
| `src/lib/fetchWithAuth.ts` | Bearer token wrapper |

#### 1.4.4 Security & UX Fixes

- DOMPurify on all `dangerouslySetInnerHTML`
- Remove dead frontend files (6 files, ~73K lines)
- Delete Amazon stub adapter, Walmart stub adapter
- Soft-deprecate Shopify adapter (leave code, remove from UI)
- Wire FitmentManager to backend API
- Wire Settings "Add" buttons
- Wire Shell header search

#### 1.4.5 Schema Consolidation Migration

- Missing FK constraints (NO ACTION)
- Missing indexes on `listing_records`
- Add NUMERIC shadow columns for `startPrice`, `quantity` (dual-write)

---

## PHASE 2: Fitment & Data Enrichment (Weeks 4–8)

**Goal:** GridxConnect parity — eBay compatibility matrix, AI cross-referencing, high-performance async UI.

### 2.1 eBay Compatibility Matrix (MVL)

**Use eBay Taxonomy API to fetch and map Master Vehicle Lists and category-specific item specifics.**

```typescript
// backend/src/fitment/ebay-mvl.service.ts
@Injectable()
export class EbayMvlService {
  // Fetch full compatibility property tree for eBay Motors categories
  async fetchCompatibilityTree(categoryId: string): Promise<CompatibilityTree> {
    const props = await this.taxonomyApi.getCompatibilityProperties(categoryId);
    // Returns: [{ propertyName: 'Make', ... }, { propertyName: 'Model', ... }, ...]
    return this.normalizeToTree(props);
  }
  
  // Cascading fetch: Make → Model → Year → Trim → Engine
  async getPropertyValues(
    categoryId: string,
    propertyName: string,       // e.g. 'Model'
    filters: Record<string, string>  // e.g. { Make: 'Toyota' }
  ): Promise<Array<{ label: string; value: string }>> {
    const raw = await this.taxonomyApi.getCompatibilityPropertyValues(
      categoryId, propertyName, filters
    );
    // Map raw eBay strings to { label, value } for <SearchableSelect />
    return raw.map(v => ({ label: v.displayName, value: v.value }));
  }
  
  // Build eBay-format compatibility array from user selections
  buildCompatibilityArray(selections: FitmentSelection[]): EbayCompatibility[] {
    return selections.map(s => ({
      compatibilityProperties: [
        { name: 'Make', value: s.make },
        { name: 'Model', value: s.model },
        { name: 'Year', value: s.year },
        ...(s.trim ? [{ name: 'Trim', value: s.trim }] : []),
        ...(s.engine ? [{ name: 'Engine', value: s.engine }] : []),
      ]
    }));
  }
}
```

**API Endpoints:**

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/fitment/compatibility-properties/:categoryId` | Get available property names for category |
| `GET` | `/api/fitment/property-values/:categoryId/:propertyName` | Get values with cascading filters (async, paginated) |
| `POST` | `/api/fitment/build-compatibility` | Convert selections → eBay compatibility JSON |
| `GET` | `/api/fitment/makes?q=&limit=50&offset=0` | Paginated make search |
| `GET` | `/api/fitment/models?makeId=&q=&limit=50` | Paginated model search (filtered by make) |

### 2.2 AI-Powered Cross-Referencing (OpenAI)

**Pipeline: raw supplier data → OpenAI → standardized OEM references.**

```typescript
// Prompt: cross-reference.prompt.ts
export const CROSS_REFERENCE_PROMPT = `
You are an automotive parts data specialist. Given the following raw supplier part data,
extract and standardize:

1. OEM part numbers (original manufacturer numbers)
2. Aftermarket equivalent part numbers  
3. Cross-reference mappings (OEM ↔ aftermarket)
4. Brand identification
5. Part type classification

Input format varies: CSV rows, free-text descriptions, part number lists.
Output MUST be valid JSON matching this schema:
{
  "parts": [{
    "oem_numbers": ["string"],
    "aftermarket_numbers": ["string"],
    "brand": "string",
    "mpn": "string",
    "part_type": "string",
    "confidence": 0.0-1.0
  }]
}
`;
```

**Service:**

```typescript
// backend/src/common/openai/pipelines/cross-reference.pipeline.ts
@Injectable()
export class CrossReferencePipeline {
  async processRawSupplierData(rawText: string): Promise<CrossReferenceResult[]> {
    const result = await this.openAi.generateStructuredJson(
      CROSS_REFERENCE_PROMPT,
      rawText,
      crossReferenceSchema
    );
    
    // Upsert cross_references table
    for (const part of result.parts) {
      for (const oem of part.oem_numbers) {
        for (const aftermarket of part.aftermarket_numbers) {
          await this.crossRefRepo.upsert({ oem_number: oem, aftermarket_number: aftermarket, ... });
        }
      }
    }
    return result.parts;
  }
}
```

### 2.3 OpenAI Data Enrichment Pipeline Enhancement

Extend existing ingestion pipeline:

```
Current:  Image → OpenAI Vision → Normalize → Review → listing_records
Enhanced: Image → OpenAI Vision → Normalize → Cross-Ref Lookup → eBay Category Match → Enrich → Review → master_products
                                                    ↑                      ↑
                                          cross_references         ebay_categories (Taxonomy API)
```

### 2.4 VIN Decode Service

```typescript
// backend/src/fitment/vin-decode.service.ts
@Injectable()
export class VinDecodeService {
  // NHTSA vPIC API — free, no auth required
  async decode(vin: string): Promise<VinDecodeResult> {
    const cached = await this.cache.get(`vin:${vin}`);
    if (cached) return cached;
    
    const response = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );
    
    const result = this.normalize(response.data.Results);
    // { year: '2015', make: 'Toyota', model: 'Camry', trim: 'LE', engine: '2.5L L4' }
    
    await this.cache.set(`vin:${vin}`, result, 86400); // 24h TTL
    return result;
  }
  
  // Map decoded VIN to eBay compatibility filter
  async toEbayCompatibilityFilter(vin: string): Promise<Record<string, string>> {
    const decoded = await this.decode(vin);
    return { Make: decoded.make, Model: decoded.model, Year: decoded.year };
  }
}
```

### 2.5 High-Performance Async UI Components

**All fitment/category/parts dropdowns MUST use this pattern:**

```typescript
// src/components/ui/SearchableSelect.tsx — async, paginated, debounced
interface SearchableSelectProps {
  fetchOptions: (query: string, page: number) => Promise<{ 
    options: Array<{ label: string; value: string }>;
    hasMore: boolean;
  }>;
  value: { label: string; value: string } | null;
  onChange: (selected: { label: string; value: string } | null) => void;
  placeholder?: string;
  debounceMs?: number;    // default 300
  pageSize?: number;      // default 50
  dependsOn?: string;     // parent value that triggers refetch
}
```

**Two-way data mapping rules (see Appendix C):**
- **eBay → UI:** Map raw string primitives from eBay API to `{ label: displayName, value: rawValue }`
- **UI → eBay payload:** On `onChange`, extract `.value` to build eBay-format JSON arrays
- **Fitment cascade:** Make → Model → Year → Trim → Engine. Each level's fetch passes parent values as filters.

---

## PHASE 3: Automated Listing & Storefront Management (Weeks 6–12)

**Goal:** MergeKart Product Port parity — AI listing engine, multi-store publishing, designer templates.

### 3.1 AI Product Port (Listing Engine)

**User selects master SKU → OpenAI generates optimized eBay listing.**

```typescript
// backend/src/common/openai/pipelines/listing-generation.pipeline.ts
@Injectable()
export class ListingGenerationPipeline {
  async generateListing(
    product: MasterProduct,
    template: ListingTemplate | null,
    targetStore: Store
  ): Promise<GeneratedListing> {
    
    const systemPrompt = template 
      ? this.buildTemplatePrompt(template)
      : LISTING_GENERATION_PROMPT;
    
    const userMessage = JSON.stringify({
      sku: product.sku,
      brand: product.brand,
      mpn: product.mpn,
      oem_numbers: product.oem_numbers,
      part_type: product.part_type,
      condition: product.condition,
      item_specifics: product.item_specifics,
      compatibility: product.compatibility,
      base_cost: product.base_cost,
      store_name: targetStore.name,
      ebay_category_id: product.ebay_category_id,
    });
    
    return this.openAi.generateStructuredJson(
      systemPrompt,
      userMessage,
      generatedListingSchema
    );
    // Returns: { title, subtitle, description_html, item_specifics, suggested_price }
  }
}
```

**Template Selection — `<SearchableSelect />` for templates passes context to OpenAI:**

```typescript
// Frontend: when user selects template, merge it with product context
const handleTemplateSelect = (template: { label: string; value: string }) => {
  setFormState(prev => ({
    ...prev,
    templateId: template.value,
    // These fields are passed to OpenAI as generation context
    openaiContext: {
      oem_numbers: prev.oem_numbers,
      condition: prev.condition,
      brand: prev.brand,
      mpn: prev.mpn,
    }
  }));
};
```

### 3.2 Multi-Store Publishing

**Single master item → tailored eBay Offers for each connected store.**

```typescript
// backend/src/channels/ebay/ebay-publish.service.ts
@Injectable()
export class EbayPublishService {
  async publishToStores(
    productId: string, 
    storeIds: string[]  // empty = all stores with matching export rules
  ): Promise<PublishResult[]> {
    const product = await this.masterProductRepo.findOneOrFail(productId);
    const stores = storeIds.length 
      ? await this.storeRepo.findByIds(storeIds)
      : await this.getStoresWithMatchingRules(product);
    
    const results: PublishResult[] = [];
    
    for (const store of stores) {
      // 1. Apply export rules (price markup, title prefix, etc.)
      const overrides = await this.exportRulesService.applyRules(product, store);
      
      // 2. Create or update eBay Inventory Item
      await this.inventoryApi.createOrReplaceInventoryItem(store.id, product.sku, {
        product: this.mapToEbayProduct(product),
        condition: overrides.condition || product.condition,
        availability: { shipToLocationAvailability: { quantity: overrides.quantity } },
      });
      
      // 3. Create or update eBay Offer
      const offer = await this.buildOffer(product, store, overrides);
      
      let ebayOffer = await this.ebayOfferRepo.findOne({ 
        where: { master_product_id: productId, store_id: store.id } 
      });
      
      if (ebayOffer?.ebay_offer_id) {
        await this.inventoryApi.updateOffer(store.id, ebayOffer.ebay_offer_id, offer);
      } else {
        const { offerId } = await this.inventoryApi.createOffer(store.id, offer);
        const { listingId } = await this.inventoryApi.publishOffer(store.id, offerId);
        ebayOffer = await this.ebayOfferRepo.save({ 
          master_product_id: productId, store_id: store.id,
          ebay_offer_id: offerId, ebay_listing_id: listingId,
          price: offer.pricingSummary.price.value, quantity: offer.availableQuantity,
          sync_status: 'synced', last_synced_at: new Date()
        });
      }
      
      results.push({ storeId: store.id, storeName: store.name, offerId: ebayOffer.ebay_offer_id, success: true });
    }
    
    return results;
  }
}
```

### 3.3 Export Rules Engine

```typescript
// backend/src/channels/export-rules.service.ts
@Injectable()
export class ExportRulesService {
  async applyRules(product: MasterProduct, store: Store): Promise<OfferOverrides> {
    const rules = await this.rulesRepo.find({ 
      where: { store_id: store.id, enabled: true },
      order: { priority: 'DESC' }
    });
    
    let overrides: OfferOverrides = {
      price: product.default_price,
      quantity: product.total_quantity - product.reserved_quantity,
      title: product.title,
      condition: product.condition,
    };
    
    for (const rule of rules) {
      if (this.matchesCondition(product, rule)) {
        overrides = this.mergeOverrides(overrides, rule.overrides);
        // e.g., { price_markup_pct: 10 } → price * 1.10
        // e.g., { title_prefix: "[Store A] " } → "[Store A] " + title
      }
    }
    
    return overrides;
  }
}
```

### 3.4 Template Designer + OpenAI Integration

**Frontend route `/templates` with visual builder:**

```
src/components/templates/
├── TemplatesPage.tsx           ← Template gallery + CRUD
├── TemplateDesigner.tsx        ← Handlebars editor with live preview
├── TemplatePreview.tsx         ← Rendered preview with sample product data
└── TemplateVariablePanel.tsx   ← Variable picker (SKU, brand, OEM#, fitment, etc.)
```

**Template selection in listing forms uses `<SearchableSelect />`:**
- Dropdown fetches templates async from `/api/templates?q=&limit=20`
- On selection, template ID + current product context (OEM numbers, condition, brand) are merged into OpenAI generation payload
- Two-way binding: `{ label: "eBay Motors Premium", value: "template-uuid" }` → on change, `value` feeds the listing generation API

### 3.5 Scheduled Listing Refresh

```typescript
@Cron('0 0 */2 * *') // Every 48 hours
async refreshListings() {
  if (!await this.featureFlags.isEnabled('listing_auto_refresh')) return;
  const staleOffers = await this.ebayOfferRepo.find({
    where: { sync_status: 'synced', last_synced_at: LessThan(subDays(new Date(), 2)) }
  });
  for (const offer of staleOffers) {
    await this.channelsQueue.add('refresh-offer', { offerId: offer.id });
  }
}
```

---

## PHASE 4: Order Management & Fulfillment (Weeks 10–16)

**Goal:** MergeKart OMS parity — centralized orders, inventory deduction, eBay fulfillment.

### 4.1 Centralized Order Sync (eBay Fulfillment API)

```typescript
// backend/src/channels/ebay/ebay-fulfillment-api.service.ts
@Injectable()
export class EbayFulfillmentApiService {
  // Pull orders from a specific eBay store
  async getOrders(storeId: string, params: {
    filter?: string;      // e.g., "orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}"
    limit?: number;
    offset?: number;
    orderIds?: string[];
  }): Promise<EbayOrderPage>;
  
  // Create shipping fulfillment (mark as shipped with tracking)
  async createShippingFulfillment(
    storeId: string, 
    orderId: string, 
    fulfillment: {
      lineItems: Array<{ lineItemId: string; quantity: number }>;
      shippingCarrierCode: string;
      trackingNumber: string;
    }
  ): Promise<{ fulfillmentId: string }>;
  
  // Get shipping fulfillment details
  async getShippingFulfillments(storeId: string, orderId: string): Promise<EbayFulfillment[]>;
}
```

**Order Import Scheduler (wires dead `orders` queue):**

```typescript
// backend/src/common/scheduler/order-import.scheduler.ts
@Cron('*/15 * * * *') // Every 15 minutes
async importOrders() {
  if (!await this.featureFlags.isEnabled('order_auto_import')) return;
  
  const stores = await this.storeRepo.find({ where: { channel: 'ebay', active: true } });
  for (const store of stores) {
    await this.ordersQueue.add('import-from-ebay', { 
      storeId: store.id,
      since: store.last_order_sync_at || subHours(new Date(), 1)
    });
  }
}
```

### 4.2 Inventory Deduction Logic

**When an order clears on Store A → update master inventory → push revised quantity to Store B.**

```typescript
// backend/src/inventory/inventory-sync.service.ts
@OnEvent('order.new')
async handleNewOrder(payload: { orderId: string; storeId: string }) {
  const order = await this.ordersRepo.findOneOrFail(payload.orderId, { relations: ['items'] });
  
  for (const item of order.items) {
    // 1. Deduct from master inventory (SERIALIZABLE transaction)
    await this.inventoryService.adjustQuantity({
      masterProductId: item.master_product_id,
      delta: -item.quantity,
      reason: 'sale',
      referenceId: order.id,
      referenceType: 'order',
    });
    
    // 2. Get updated available quantity
    const product = await this.masterProductRepo.findOneOrFail(item.master_product_id);
    const available = product.total_quantity - product.reserved_quantity;
    
    // 3. Push updated quantity to ALL OTHER eBay stores
    const otherOffers = await this.ebayOfferRepo.find({
      where: { 
        master_product_id: item.master_product_id,
        store_id: Not(payload.storeId),  // exclude the store that sold it
        sync_status: 'synced'
      }
    });
    
    for (const offer of otherOffers) {
      await this.channelsQueue.add('update-offer-quantity', {
        offerId: offer.id,
        storeId: offer.store_id,
        newQuantity: available,
      });
    }
    
    // 4. Check low stock
    if (available <= product.low_stock_threshold) {
      this.eventEmitter.emit('inventory.low_stock', { 
        productId: product.id, sku: product.sku, available 
      });
    }
  }
}
```

### 4.3 Bulk Order Operations

```typescript
// backend/src/orders/orders.controller.ts — new endpoints
@Post('bulk/ship')
async bulkShip(@Body() dto: BulkShipDto) { ... }

@Post('bulk/cancel')  
async bulkCancel(@Body() dto: BulkCancelDto) { ... }

@Post('bulk/tracking-upload')
@UseInterceptors(FileInterceptor('file'))
async bulkTrackingUpload(@UploadedFile() file: Express.Multer.File) {
  // Parse CSV: orderId, trackingNumber, carrier
  // For each row: call ebayFulfillmentApi.createShippingFulfillment()
}
```

### 4.4 eBay Shipping Fulfillment

```typescript
// On "Mark as Shipped" in UI:
async markOrderShipped(orderId: string, tracking: { carrier: string; trackingNumber: string }) {
  const order = await this.ordersRepo.findOneOrFail(orderId, { relations: ['store'] });
  
  await this.fulfillmentApi.createShippingFulfillment(order.store_id, order.ebay_order_id, {
    lineItems: order.items.map(i => ({ lineItemId: i.ebay_line_item_id, quantity: i.quantity })),
    shippingCarrierCode: tracking.carrier,
    trackingNumber: tracking.trackingNumber,
  });
  
  await this.ordersRepo.update(orderId, { status: 'shipped', trackingNumber: tracking.trackingNumber });
}
```

### 4.5 Multi-Order Bundling & Picklist

```sql
-- View for bundleable orders (same buyer, same day)
CREATE VIEW bundleable_orders AS
SELECT buyer_username, shipping_postal_code, COUNT(*) as order_count,
       array_agg(id) as order_ids
FROM orders
WHERE status IN ('paid', 'processing')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY buyer_username, shipping_postal_code
HAVING COUNT(*) > 1;
```

```typescript
// GET /api/orders/picklist?date=2025-06-19
// Returns: Array of { sku, title, warehouse_location, quantity_needed, order_ids[] }
```

---

## PHASE 5: Market Intelligence & Dynamic Pricing (Weeks 14–20)

**Goal:** GridxConnect + MergeKart Data Lens parity — competitor analysis, AI pricing, automated repricing.

### 5.1 Competitive Analysis (eBay Browse API)

```typescript
// backend/src/channels/ebay/ebay-browse-api.service.ts
@Injectable()
export class EbayBrowseApiService {
  // Search eBay for similar items (competitor pricing)
  async searchItems(params: {
    q?: string;           // keyword search
    gtin?: string;        // UPC/EAN
    epid?: string;        // eBay Product ID
    category_ids?: string;
    filter?: string;      // e.g., "price:[10..100],priceCurrency:USD"
    sort?: string;        // "price", "-price", "newlyListed"
    limit?: number;
    offset?: number;
  }): Promise<EbaySearchResult>;
  
  // Get specific item details
  async getItem(itemId: string): Promise<EbayItem>;
  
  // Get items by item group (variations)
  async getItemsByItemGroup(itemGroupId: string): Promise<EbayItem[]>;
}
```

**Competitor Price Collection (scheduled):**

```typescript
// backend/src/pricing-intelligence/price-monitor.service.ts
@Cron('0 */4 * * *') // Every 4 hours
async collectCompetitorPrices() {
  if (!await this.featureFlags.isEnabled('pricing_intelligence')) return;
  
  const products = await this.masterProductRepo.find({
    where: { status: 'active', mpn: Not(IsNull()) },
    select: ['id', 'mpn', 'brand', 'ebay_category_id']
  });
  
  for (const product of products) {
    await this.pricingQueue.add('collect-prices', { productId: product.id });
  }
}

// Processor:
async processCollectPrices(job: Job<{ productId: string }>) {
  const product = await this.masterProductRepo.findOneOrFail(job.data.productId);
  
  const results = await this.browseApi.searchItems({
    q: `${product.brand} ${product.mpn}`,
    category_ids: product.ebay_category_id,
    filter: 'buyingOptions:{FIXED_PRICE}',
    sort: 'price',
    limit: 20,
  });
  
  for (const item of results.itemSummaries) {
    await this.competitorPriceRepo.save({
      master_product_id: product.id,
      mpn: product.mpn,
      competitor_item_id: item.itemId,
      competitor_seller: item.seller?.username,
      competitor_price: parseFloat(item.price.value),
      competitor_shipping: parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || '0'),
      competitor_condition: item.condition,
      competitor_url: item.itemWebUrl,
    });
  }
}
```

### 5.2 AI Pricing Engine (OpenAI)

```typescript
// backend/src/common/openai/pipelines/pricing-analysis.pipeline.ts
@Injectable()
export class PricingAnalysisPipeline {
  async suggestPrice(productId: string): Promise<PricingSuggestion> {
    const product = await this.masterProductRepo.findOneOrFail(productId);
    const competitors = await this.competitorPriceRepo.find({
      where: { master_product_id: productId, captured_at: MoreThan(subDays(new Date(), 7)) },
      order: { captured_at: 'DESC' },
      take: 20,
    });
    
    const prompt = `
Analyze the competitive pricing landscape for this auto part and suggest optimal pricing.

Product: ${product.brand} ${product.mpn} - ${product.title}
Base Cost: $${product.base_cost}
Current Price: $${product.default_price}
Condition: ${product.condition}

Competitor Prices (last 7 days):
${competitors.map(c => `- ${c.competitor_seller}: $${c.competitor_price} + $${c.competitor_shipping} shipping (${c.competitor_condition})`).join('\n')}

Consider:
1. Target margin above base cost
2. Competitive positioning (undercut lowest, match average, or premium pricing)
3. Condition-adjusted pricing
4. Shipping cost inclusion

Return JSON: { 
  "suggested_price": number,
  "reasoning": "string",
  "market_position": "below_average" | "average" | "above_average",
  "confidence": 0.0-1.0,
  "min_viable_price": number,
  "max_recommended_price": number
}`;

    return this.openAi.generateStructuredJson(
      'You are an expert eBay auto parts pricing analyst.',
      prompt,
      pricingSuggestionSchema
    );
  }
}
```

### 5.3 Automated Repricing

```typescript
// backend/src/pricing-intelligence/auto-reprice.service.ts
@Injectable()
export class AutoRepriceService {
  // Triggered by automation rule or manual action
  async autoRepriceProduct(productId: string, storeIds?: string[]): Promise<RepriceResult[]> {
    const suggestion = await this.pricingPipeline.suggestPrice(productId);
    
    if (suggestion.confidence < 0.7) {
      // Low confidence — queue for human review
      this.eventEmitter.emit('pricing.review_needed', { productId, suggestion });
      return [{ productId, action: 'queued_for_review' }];
    }
    
    const offers = await this.ebayOfferRepo.find({
      where: { 
        master_product_id: productId,
        sync_status: 'synced',
        ...(storeIds ? { store_id: In(storeIds) } : {})
      }
    });
    
    const results: RepriceResult[] = [];
    for (const offer of offers) {
      // Apply per-store export rules to the AI-suggested base price
      const store = await this.storeRepo.findOneOrFail(offer.store_id);
      const rules = await this.exportRulesService.applyRules(
        { ...product, default_price: suggestion.suggested_price } as MasterProduct,
        store
      );
      
      const newPrice = rules.price;
      if (Math.abs(newPrice - offer.price) > 0.01) {
        await this.inventoryApi.updateOffer(store.id, offer.ebay_offer_id, {
          pricingSummary: { price: { value: newPrice.toFixed(2), currency: 'USD' } }
        });
        await this.ebayOfferRepo.update(offer.id, { price: newPrice, last_synced_at: new Date() });
        results.push({ storeId: store.id, oldPrice: offer.price, newPrice, action: 'repriced' });
      }
    }
    
    // Log in audit
    await this.auditService.log('auto_reprice', { productId, suggestion, results });
    return results;
  }
}
```

### 5.4 Frontend Pricing Dashboard

```
src/components/pricing/
├── PricingDashboard.tsx          ← Market overview, price alerts, AI suggestions
├── CompetitorGrid.tsx            ← Per-SKU competitor comparison (eBay Browse data)
├── PriceHistoryChart.tsx         ← Price trend visualization (Recharts)
├── DynamicPricingRules.tsx       ← Per-store pricing rule builder
├── AiPricingSuggestions.tsx      ← OpenAI suggestions with accept/reject/modify
└── MarketPositionMap.tsx         ← Where your price sits vs. market
```

**Pricing Strategy `<SearchableSelect />` — bound to dynamic rules per storeId:**

```typescript
// Two-way mapping for pricing strategy dropdown
const strategyOptions = pricingRules.map(rule => ({
  label: `${rule.name} (${store.name})`,           // UI display
  value: JSON.stringify({ ruleId: rule.id, storeId: store.id })  // payload primitive
}));

const handleStrategyChange = (selected: { label: string; value: string }) => {
  const { ruleId, storeId } = JSON.parse(selected.value);
  // Bind rule to store in the multi-store pricing payload
  setPayload(prev => ({
    ...prev,
    storeRules: { ...prev.storeRules, [storeId]: ruleId }
  }));
};
```

---

## Implementation Timeline Summary

```
Week:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20
       ├───────────────┤
       Phase 1: Core API & Infrastructure
       │ - eBay API Gateway (OAuth, Inventory, Taxonomy)
       │ - OpenAI Integration Layer (prompts, queue, rate limit)
       │ - Master SKU Schema (master_products, ebay_offers)
       │ - Wire dead queues + events
       │ - Frontend auth + security fixes
       │ - Remove Amazon/Walmart stubs
                  ├───────────────┤
                  Phase 2: Fitment & Data Enrichment
                  │ - eBay MVL (Taxonomy API compatibility)
                  │ - OpenAI cross-reference pipeline
                  │ - VIN decode (NHTSA vPIC)
                  │ - Async SearchableSelect components
                  │ - Enrichment pipeline enhancement
                     ├─────────────────────────────┤
                     Phase 3: Listing & Storefront Mgmt
                     │ - AI listing generation (OpenAI)
                     │ - Multi-store publish (eBay Offers)
                     │ - Export rules engine
                     │ - Template designer + OpenAI
                     │ - Bulk cross-store operations
                              ├─────────────────────────────┤
                              Phase 4: OMS & Fulfillment
                              │ - Order sync (eBay Fulfillment API)
                              │ - Inventory deduction + cross-store sync
                              │ - Bulk order operations
                              │ - CSV tracking upload
                              │ - Picklist generation
                                       ├─────────────────────────────┤
                                       Phase 5: Pricing Intelligence
                                       │ - Competitor tracking (eBay Browse API)
                                       │ - OpenAI pricing engine
                                       │ - Automated repricing
                                       │ - Pricing dashboard
```

**Total Estimated Duration:** 20 weeks (5 months)

**Dependency Graph:**

```
Phase 1 (Foundation) ──┬──→ Phase 2 (Fitment/Enrichment) ──→ Phase 3 (Listing/Publishing)
                       │                                              │
                       └──→ Phase 4 (Orders/Fulfillment) ────────────┘
                                                                      │
                                                            Phase 5 (Pricing Intelligence)
```

**Critical Path:** Phase 1 → Phase 3 → Phase 5 (pricing depends on active listings + eBay Browse API)

---

# FILE CHECKLIST — ALL FILES REQUIRING UPDATES

> ⚠️ **AWAITING APPROVAL** — No code changes will be executed until this checklist is approved.

## New Files to Create

### Backend — eBay API Services
- [ ] `backend/src/channels/ebay/ebay-auth.service.ts` — Multi-account OAuth2 flow
- [ ] `backend/src/channels/ebay/ebay-inventory-api.service.ts` — Inventory API client
- [ ] `backend/src/channels/ebay/ebay-taxonomy-api.service.ts` — Taxonomy API client
- [ ] `backend/src/channels/ebay/ebay-fulfillment-api.service.ts` — Fulfillment API client
- [ ] `backend/src/channels/ebay/ebay-browse-api.service.ts` — Browse API client
- [ ] `backend/src/channels/ebay/ebay-publish.service.ts` — Multi-store publish orchestrator
- [ ] `backend/src/channels/ebay/ebay-api.types.ts` — Shared eBay API types
- [ ] `backend/src/channels/export-rules.service.ts` — Per-store export rules engine
- [ ] `backend/src/channels/export-rules.controller.ts` — Export rules CRUD endpoints
- [ ] `backend/src/channels/entities/export-rule.entity.ts` — Export rule TypeORM entity
- [ ] `backend/src/channels/dto/export-rule.dto.ts` — Export rule DTOs

### Backend — OpenAI Shared Service
- [ ] `backend/src/common/openai/openai.module.ts` — Global OpenAI module
- [ ] `backend/src/common/openai/openai.service.ts` — Central client with rate limiting
- [ ] `backend/src/common/openai/openai-queue.service.ts` — BullMQ-backed prompt queue
- [ ] `backend/src/common/openai/openai.types.ts` — Response types
- [ ] `backend/src/common/openai/prompts/enrichment.prompt.ts` — Enrichment prompts
- [ ] `backend/src/common/openai/prompts/listing-generation.prompt.ts` — Listing gen prompts
- [ ] `backend/src/common/openai/prompts/cross-reference.prompt.ts` — Cross-ref prompts
- [ ] `backend/src/common/openai/prompts/pricing-analysis.prompt.ts` — Pricing prompts
- [ ] `backend/src/common/openai/prompts/product-matching.prompt.ts` — Product matching prompts
- [ ] `backend/src/common/openai/prompts/fitment-extraction.prompt.ts` — Fitment prompts
- [ ] `backend/src/common/openai/pipelines/cross-reference.pipeline.ts` — Cross-ref pipeline
- [ ] `backend/src/common/openai/pipelines/listing-generation.pipeline.ts` — Listing gen pipeline
- [ ] `backend/src/common/openai/pipelines/pricing-analysis.pipeline.ts` — Pricing pipeline

### Backend — Master Products & Schema
- [ ] `backend/src/listings/entities/master-product.entity.ts` — Master product entity
- [ ] `backend/src/listings/entities/ebay-offer.entity.ts` — eBay offer entity
- [ ] `backend/src/listings/dto/master-product.dto.ts` — Master product DTOs
- [ ] `backend/src/channels/entities/ebay-category.entity.ts` — eBay category cache entity
- [ ] `backend/src/channels/entities/competitor-price.entity.ts` — Competitor price entity
- [ ] `backend/src/channels/entities/market-snapshot.entity.ts` — Market snapshot entity
- [ ] `backend/src/listings/entities/cross-reference.entity.ts` — Cross-reference entity

### Backend — Pricing Intelligence
- [ ] `backend/src/pricing-intelligence/pricing-intelligence.module.ts` — Module
- [ ] `backend/src/pricing-intelligence/price-monitor.service.ts` — Competitor collection
- [ ] `backend/src/pricing-intelligence/auto-reprice.service.ts` — Automated repricing
- [ ] `backend/src/pricing-intelligence/pricing-intelligence.controller.ts` — API endpoints

### Backend — Schedulers (wire dead queues)
- [ ] `backend/src/common/scheduler/inventory-sync.scheduler.ts` — Inventory queue producer
- [ ] `backend/src/common/scheduler/order-import.scheduler.ts` — Order import producer
- [ ] `backend/src/common/scheduler/dashboard-aggregation.scheduler.ts` — Dashboard producer
- [ ] `backend/src/common/scheduler/storage-cleanup.scheduler.ts` — Storage cleanup producer
- [ ] `backend/src/common/scheduler/listing-refresh.scheduler.ts` — 48h listing refresh

### Backend — Fitment (eBay MVL)
- [ ] `backend/src/fitment/ebay-mvl.service.ts` — eBay Taxonomy MVL integration
- [ ] `backend/src/fitment/vin-decode.service.ts` — NHTSA vPIC VIN decode

### Backend — Migrations
- [ ] `backend/src/migrations/XXXXXX-AddMasterProductSchema.ts` — master_products, ebay_offers, cross_references, etc.
- [ ] `backend/src/migrations/XXXXXX-ExtendStoresForEbay.ts` — stores table eBay columns
- [ ] `backend/src/migrations/XXXXXX-AddExportRules.ts` — export_rules table
- [ ] `backend/src/migrations/XXXXXX-AddCompetitorPricing.ts` — competitor_prices, market_snapshots
- [ ] `backend/src/migrations/XXXXXX-AddEbayCategories.ts` — ebay_categories cache table
- [ ] `backend/src/migrations/XXXXXX-AddNumericPriceColumns.ts` — NUMERIC shadow columns on listing_records
- [ ] `backend/src/migrations/XXXXXX-SchemaConsolidation.ts` — missing FKs + indexes

### Frontend — Auth
- [ ] `src/components/auth/LoginPage.tsx` — Login form
- [ ] `src/components/auth/RegisterPage.tsx` — Registration form
- [ ] `src/components/auth/AuthProvider.tsx` — Auth context + token management
- [ ] `src/lib/authApi.ts` — Auth API calls
- [ ] `src/lib/fetchWithAuth.ts` — Bearer token wrapper for all fetches

### Frontend — Async UI Components
- [ ] `src/components/ui/SearchableSelect.tsx` — Async, paginated, debounced select
- [ ] `src/components/ui/CascadingFitmentSelect.tsx` — Make→Model→Year→Trim→Engine cascade
- [ ] `src/components/ui/CategoryPicker.tsx` — eBay category tree browser

### Frontend — Pricing
- [ ] `src/components/pricing/PricingDashboard.tsx` — Market overview
- [ ] `src/components/pricing/CompetitorGrid.tsx` — Per-SKU competitor comparison
- [ ] `src/components/pricing/PriceHistoryChart.tsx` — Trend visualization
- [ ] `src/components/pricing/DynamicPricingRules.tsx` — Per-store rule builder
- [ ] `src/components/pricing/AiPricingSuggestions.tsx` — OpenAI suggestions UI

### Frontend — Types
- [ ] `src/types/ebayApi.ts` — eBay API response/request types
- [ ] `src/types/masterProduct.ts` — Master product + offer types
- [ ] `src/types/pricing.ts` — Competitor price + market snapshot types

### Frontend — API Hooks
- [ ] `src/lib/ebayStoreApi.ts` — eBay store management API calls
- [ ] `src/lib/masterProductApi.ts` — Master product CRUD
- [ ] `src/lib/pricingApi.ts` — Pricing intelligence API calls
- [ ] `src/lib/fitmentApi.ts` — Fitment/MVL async fetch hooks

## Existing Files to Modify

### Backend — Module Wiring
- [ ] `backend/src/app.module.ts` — Register new modules (OpenAI, PricingIntelligence), remove Shopify-specific imports if any
- [ ] `backend/src/channels/channels.module.ts` — Register eBay API services, export rules, remove Amazon/Walmart references
- [ ] `backend/src/channels/channels.service.ts` — Wire EventEmitter2 emits (`channel.connected`, `listing.published`)
- [ ] `backend/src/channels/channel-adapter.interface.ts` — Simplify to eBay-only interface
- [ ] `backend/src/fitment/fitment.module.ts` — Register ebay-mvl.service, vin-decode.service
- [ ] `backend/src/fitment/fitment.controller.ts` — Add MVL compatibility endpoints
- [ ] `backend/src/ingestion/processors/*.ts` — Wire EventEmitter2 emits (`ingestion.completed`, `ingestion.failed`)
- [ ] `backend/src/ingestion/ai/ai.service.ts` — Delegate to common OpenAI service
- [ ] `backend/src/inventory/inventory.service.ts` — Wire `inventory.low_stock` emit
- [ ] `backend/src/orders/orders.service.ts` — Wire `order.new` emit
- [ ] `backend/src/orders/orders.controller.ts` — Add bulk endpoints (ship, cancel, tracking-upload)
- [ ] `backend/src/common/scheduler/scheduler.module.ts` — Register new schedulers
- [ ] `backend/src/common/scheduler/scheduler.service.ts` — Add new cron methods
- [ ] `backend/src/settings/settings.service.ts` — Ensure pricing rules support storeId binding
- [ ] `backend/src/automation/automation.service.ts` — Wire rule evaluation + action execution
- [ ] `backend/src/templates/template.service.ts` — Add Handlebars rendering + OpenAI integration
- [ ] `backend/src/templates/template.controller.ts` — Add `/render` endpoint
- [ ] `backend/src/dashboard/dashboard.service.ts` — Add per-store KPI breakdown

### Backend — Cleanup (remove dead adapters)
- [ ] `backend/src/channels/adapters/amazon/amazon.adapter.ts` — **DELETE**
- [ ] `backend/src/channels/adapters/walmart/walmart.adapter.ts` — **DELETE**
- [ ] `backend/src/channels/adapters/shopify/shopify.adapter.ts` — **DEPRECATE** (add `@deprecated` JSDoc, keep code)
- [ ] `backend/src/channels/adapters/ebay/ebay.adapter.ts` — Refactor to use new eBay API service layer

### Frontend — Existing Component Updates
- [ ] `src/App.tsx` — Add auth routes, pricing route, wrap with AuthProvider
- [ ] `src/components/layout/Shell.tsx` — Wire header search, add pricing nav item
- [ ] `src/components/catalog/CatalogManager.tsx` — Add master product support
- [ ] `src/components/catalog/FilterSidebar.tsx` — Convert dropdowns to async SearchableSelect
- [ ] `src/components/fitment/FitmentManager.tsx` — Replace mock data with eBay MVL API + CascadingFitmentSelect
- [ ] `src/components/channels/ChannelListingPanel.tsx` — Refocus on multi-store eBay view
- [ ] `src/components/channels/PublishModal.tsx` — Multi-store eBay publish with per-store overrides
- [ ] `src/components/listings/ListingEditor.tsx` — Add OpenAI generation, template select, category picker
- [ ] `src/components/orders/OrdersPage.tsx` — Add store filter, bulk actions, CSV tracking upload
- [ ] `src/components/settings/SettingsPage.tsx` — Wire Add buttons, add per-store pricing rules
- [ ] `src/components/sku/SkuDetailPage.tsx` — Add DOMPurify, show per-store offers
- [ ] `src/components/sku/ChannelStorePanel.tsx` — Refocus on eBay multi-store
- [ ] `src/components/sku/InventoryPanel.tsx` — Show cross-store allocation
- [ ] `src/components/ingestion/IngestionManager.tsx` — Use shared OpenAI service context
- [ ] `src/components/templates/TemplatesPage.tsx` — Wire to backend API + OpenAI preview
- [ ] `src/components/dashboard/Dashboard.tsx` — Add per-store KPIs

### Frontend — Dead Code Removal
- [ ] `src/data/generatedInventory.ts` — **DELETE** (72,834 lines)
- [ ] `src/data/inventory.ts` — **DELETE**
- [ ] `src/lib/catalogSearch.ts` — **DELETE**
- [ ] `src/lib/fitmentSearch.ts` — **DELETE**
- [ ] `src/lib/channelAdapters.ts` — **DELETE**
- [ ] `src/lib/inventorySync.ts` — **DELETE**

### Frontend — API Layer Updates
- [ ] `src/lib/channelsApi.ts` — Refocus on eBay-only store operations
- [ ] `src/lib/multiStoreApi.ts` — Update for eBay multi-store model
- [ ] `src/lib/searchApi.ts` — Support master_products search

### Configuration
- [ ] `backend/.env.example` — Add new env vars (OPENAI_RPM, OPENAI_DAILY_COST_CAP, EBAY_* per-environment)
- [ ] `backend/src/data-source.ts` — Add new entities to entity list

---

### File Count Summary

| Category | New | Modify | Delete | Total |
|----------|-----|--------|--------|-------|
| Backend — eBay API | 11 | 1 | 2 | 14 |
| Backend — OpenAI | 13 | 1 | 0 | 14 |
| Backend — Entities/Schema | 7 | 0 | 0 | 7 |
| Backend — Pricing Intelligence | 4 | 0 | 0 | 4 |
| Backend — Schedulers | 5 | 2 | 0 | 7 |
| Backend — Fitment | 2 | 2 | 0 | 4 |
| Backend — Migrations | 7 | 0 | 0 | 7 |
| Backend — Module Wiring | 0 | 12 | 0 | 12 |
| Backend — Cleanup | 0 | 2 | 2 | 4 |
| Frontend — Auth | 5 | 0 | 0 | 5 |
| Frontend — UI Components | 3 | 0 | 0 | 3 |
| Frontend — Pricing | 5 | 0 | 0 | 5 |
| Frontend — Types | 3 | 0 | 0 | 3 |
| Frontend — API Hooks | 4 | 3 | 0 | 7 |
| Frontend — Component Updates | 0 | 15 | 0 | 15 |
| Frontend — Dead Code Removal | 0 | 0 | 6 | 6 |
| Configuration | 0 | 2 | 0 | 2 |
| **TOTAL** | **~69** | **~40** | **~10** | **~119** |

---

# APPENDIX A — EBAY API SURFACE MAP

All marketplace interactions use these eBay Developer Program APIs exclusively:

| API | Purpose | Phase | Auth Type |
|-----|---------|-------|-----------|
| **Inventory API** | `createOrReplaceInventoryItem`, `createOffer`, `updateOffer`, `publishOffer`, `withdrawOffer`, `bulkUpdatePriceQuantity` | 1, 3, 4, 5 | OAuth2 User Token |
| **Taxonomy API** | `getCategoryTree`, `getCategorySuggestions`, `getItemAspectsForCategory`, `getCompatibilityProperties`, `getCompatibilityPropertyValues` | 1, 2 | OAuth2 Application Token |
| **Trading API** | `GetCategories`, `GetCategorySpecifics`, `GetSessionID` (legacy auth flows) | 1 | Auth Token |
| **Fulfillment API** | `getOrders`, `getOrder`, `createShippingFulfillment`, `getShippingFulfillments` | 4 | OAuth2 User Token |
| **Browse API** | `search`, `getItem`, `getItemsByItemGroup` | 5 | OAuth2 Application Token |
| **Commerce API** | `getIdentity` (seller info), payment/return policies | 1 | OAuth2 User Token |

**Token Management:**
- Each connected eBay store has its own OAuth2 User Token pair (access + refresh)
- Tokens encrypted at rest via AES-256-GCM (existing `token-encryption.service.ts`)
- Auto-refresh before expiry (access token TTL = 2 hours, refresh token TTL = 18 months)
- Application Token used for Taxonomy API and Browse API (not store-specific)

---

# APPENDIX B — OPENAI API SURFACE MAP

All AI operations use OpenAI APIs exclusively:

| Capability | Model | API | Output Mode | Phase |
|-----------|-------|-----|-------------|-------|
| Image → Part ID | GPT-4o Vision | Chat Completions | Structured JSON | 1 (exists) |
| Data Enrichment | GPT-4o | Chat Completions | Structured JSON | 2 |
| Cross-Reference Extraction | GPT-4o | Chat Completions | Structured JSON | 2 |
| Fitment Extraction from Text | GPT-4o | Chat Completions | Structured JSON | 2 |
| eBay Title Optimization | GPT-4o | Chat Completions | Structured JSON | 3 |
| HTML Description Generation | GPT-4o | Chat Completions | Text | 3 |
| Item Specifics Suggestion | GPT-4o | Chat Completions | Structured JSON | 3 |
| Product Matching/Dedup | GPT-4o | Chat Completions | Structured JSON | 3 |
| Competitive Pricing Analysis | GPT-4o | Chat Completions | Structured JSON | 5 |
| AI Assistant Chat | GPT-4o | Chat Completions | Streaming text | Future |

**Rate Limiting & Cost Control:**
- Concurrency: 5 parallel requests (configurable: `OPENAI_CONCURRENCY`)
- RPM limit: 60 requests/minute (configurable: `OPENAI_RPM`)
- Daily cost cap: $50/day default (configurable: `OPENAI_DAILY_COST_CAP`)
- Token tracking: log `prompt_tokens` + `completion_tokens` per request
- Retry: 3 attempts with exponential backoff on 429/500 errors
- Queue: BullMQ `openai` queue for batch operations (bulk enrichment, bulk repricing)

---

# APPENDIX C — COMPONENT EXECUTION STANDARDS

## Two-Way Data Mapping Pattern

All `<SearchableSelect />` and form components handling eBay/ERP data must follow this pattern:

### eBay API → UI Rendering (inbound)

```typescript
// Raw eBay API data (primitives/arrays)
const ebayMakes: string[] = ['Toyota', 'Honda', 'Ford'];

// Map to { label, value } for UI rendering
const makeOptions = ebayMakes.map(make => ({ label: make, value: make }));
// → [{ label: 'Toyota', value: 'Toyota' }, ...]
```

### UI Selection → eBay JSON Payload (outbound)

```typescript
// User selects in <SearchableSelect />
const handleMakeChange = (selected: { label: string; value: string } | null) => {
  if (selected) {
    // Extract primitive for eBay payload
    setCompatibility(prev => ({
      ...prev,
      make: selected.value,  // raw string for JSON payload
      model: null,           // reset dependent fields
      year: null,
    }));
    
    // Trigger cascading fetch for dependent dropdown
    fetchModels(selected.value);
  }
};
```

### Complex Compatibility Array (eBay format)

```typescript
// UI selections → eBay compatibility JSON
const buildEbayCompatibility = (selections: FitmentSelection[]): object[] => {
  return selections.map(s => ({
    compatibilityProperties: [
      { name: 'Make', value: s.make },      // raw primitive from { label, value }.value
      { name: 'Model', value: s.model },
      { name: 'Year', value: s.year },
      ...(s.trim ? [{ name: 'Trim', value: s.trim }] : []),
      ...(s.engine ? [{ name: 'Engine', value: s.engine }] : []),
    ]
  }));
};

// eBay compatibility JSON → UI display objects
const parseEbayCompatibility = (compat: object[]): FitmentSelection[] => {
  return compat.map(c => {
    const props = c.compatibilityProperties;
    return {
      make: props.find(p => p.name === 'Make')?.value || '',
      model: props.find(p => p.name === 'Model')?.value || '',
      year: props.find(p => p.name === 'Year')?.value || '',
      trim: props.find(p => p.name === 'Trim')?.value,
      engine: props.find(p => p.name === 'Engine')?.value,
    };
  });
};
```

### Multi-Store Offer Payload (per-store overrides)

```typescript
// Pricing strategy dropdown → store-specific rule binding
const handlePricingRuleChange = (
  storeId: string,
  selected: { label: string; value: string }
) => {
  // Extract rule ID from value, bind to specific storeId
  setMultiStorePayload(prev => ({
    ...prev,
    stores: prev.stores.map(s => 
      s.storeId === storeId 
        ? { ...s, pricingRuleId: selected.value }
        : s
    )
  }));
};

// Template dropdown → passes context to OpenAI
const handleTemplateChange = (selected: { label: string; value: string }) => {
  setGenerationPayload(prev => ({
    ...prev,
    templateId: selected.value,
    // These are passed as OpenAI context for generation
    aiContext: {
      oem_numbers: product.oem_numbers,
      condition: product.condition,
      brand: product.brand,
      mpn: product.mpn,
    }
  }));
};
```

### Async SearchableSelect Contract

```typescript
interface SearchableSelectProps {
  // Server-side fetch with pagination
  fetchOptions: (query: string, page: number) => Promise<{
    options: Array<{ label: string; value: string }>;
    hasMore: boolean;
    totalCount: number;
  }>;
  value: { label: string; value: string } | null;
  onChange: (selected: { label: string; value: string } | null) => void;
  
  // Performance
  debounceMs?: number;        // default: 300ms
  pageSize?: number;          // default: 50
  minQueryLength?: number;    // default: 0 (load on open)
  
  // Cascading dependencies
  dependsOn?: string | null;  // parent value — refetch when this changes
  
  // Display
  placeholder?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  isClearable?: boolean;
  noOptionsMessage?: string;
}
```

---

# APPENDIX D — FEATURE FLAG MANIFEST

| Flag Key | Phase | Default | Controls |
|----------|-------|---------|----------|
| `inventory_real_time_sync` | 1 | OFF | Inventory queue scheduler + cross-store sync |
| `order_auto_import` | 1 | OFF | eBay Fulfillment API order import cron |
| `dashboard_aggregation` | 1 | OFF | Dashboard metrics aggregation cron |
| `ebay_taxonomy_cache` | 1 | OFF | eBay Taxonomy API category/aspect caching |
| `master_product_schema` | 1 | OFF | Use master_products + ebay_offers instead of listing_records |
| `openai_shared_service` | 1 | OFF | Route all AI through common OpenAI module |
| `ebay_mvl_fitment` | 2 | OFF | eBay Taxonomy API for fitment compatibility |
| `openai_cross_reference` | 2 | OFF | OpenAI cross-reference extraction pipeline |
| `vin_decode` | 2 | OFF | NHTSA vPIC VIN decode endpoint |
| `openai_listing_generation` | 3 | OFF | OpenAI-powered listing title/description generation |
| `auto_publish` | 3 | OFF | Auto-create eBay Offers on listing status change |
| `export_rules` | 3 | OFF | Per-store export rule evaluation |
| `template_system` | 3 | OFF | Template designer + OpenAI rendering |
| `listing_auto_refresh` | 3 | OFF | 48h listing refresh cron |
| `ebay_order_sync` | 4 | OFF | eBay Fulfillment API order pull |
| `cross_store_inventory_sync` | 4 | OFF | On order: deduct master → push qty to other stores |
| `bulk_order_ops` | 4 | OFF | Bulk ship/cancel/tracking-upload |
| `pricing_intelligence` | 5 | OFF | eBay Browse API competitor price collection |
| `openai_pricing_engine` | 5 | OFF | OpenAI competitive pricing suggestions |
| `auto_reprice` | 5 | OFF | Automated eBay Offer repricing |
| `automation_rules` | 3+ | OFF | Full automation rules engine |

---

# APPENDIX E — RISK REGISTER

| Risk | Phase | Likelihood | Impact | Mitigation |
|------|-------|-----------|--------|------------|
| eBay API rate limits hit during bulk operations | 1, 3, 4 | High | Medium | Implement BullMQ rate limiter (5K calls/day per account), queue with backpressure |
| eBay OAuth token refresh failures | 1 | Medium | High | Proactive refresh 30min before expiry; alert on failure; fallback to manual re-auth |
| OpenAI hallucinated cross-references | 2 | High | High | Confidence scoring + mandatory human review for confidence < 0.85 |
| OpenAI rate limit / cost overrun | 2, 3, 5 | Medium | Medium | BullMQ concurrency control, daily cost cap, token budget per operation |
| eBay Browse API changes / deprecation | 5 | Low | High | Abstract behind service layer; monitor eBay developer changelog |
| Master product migration breaks existing listing_records flow | 1 | Medium | High | Feature flag `master_product_schema`; dual-read from both tables during migration |
| Cross-store inventory desync race condition | 4 | Medium | High | SERIALIZABLE transactions + optimistic locking + eventual consistency queue |
| eBay Taxonomy API returns incomplete MVL data | 2 | Medium | Medium | Cache locally, fallback to ACES reference tables, allow manual fitment entry |
| Dropdown performance with millions of SKUs | 2 | High | High | Server-side pagination (50 per page), 300ms debounce, async fetch, no full-list load |
| OpenAI structured output schema mismatch | 2, 3, 5 | Medium | Medium | Zod validation on every response, fallback to manual data entry on parse failure |

---

## CONCLUSION

This blueprint scopes the entire upgrade to **two external API ecosystems only**:

1. **eBay Developer Program APIs** — Inventory, Taxonomy, Fulfillment, Browse, Trading, Commerce — powering multi-store eBay management, fitment, orders, and competitor intelligence.

2. **OpenAI APIs** — GPT-4o Vision + Chat Completions — powering data enrichment, listing generation, cross-referencing, product matching, and competitive pricing analysis.

The **20-week, 5-phase plan** delivers:
- **Phase 1 (Weeks 1–4):** eBay API Gateway + OpenAI Layer + Master SKU Schema + dead code fixes
- **Phase 2 (Weeks 4–8):** eBay MVL fitment + OpenAI cross-references + async UI components
- **Phase 3 (Weeks 6–12):** AI listing generation + multi-store eBay publishing + templates
- **Phase 4 (Weeks 10–16):** eBay order sync + cross-store inventory deduction + bulk ops
- **Phase 5 (Weeks 14–20):** eBay Browse competitor tracking + OpenAI pricing engine + auto-reprice

Every feature is behind a feature flag, every schema change is additive, and every existing endpoint remains untouched. The Shopify adapter is soft-deprecated (code preserved, removed from UI), and Amazon/Walmart stubs are deleted.

**Awaiting approval on the File Checklist before executing code changes.**

---

*End of upgrade blueprint v2.0*

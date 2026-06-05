# System Overview

> High-level summary of RealTrackApp's purpose, architecture, and data flows.
> For deeper technical details, see `/docs/architecture/overview.md`.

---

## What is RealTrackApp?

RealTrackApp (internal name: `listingpro`) is a **multi-channel automotive parts listing & operations platform**. It helps automotive parts sellers manage their entire catalog-to-marketplace workflow.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Catalog Import** | Bulk import product data via CSV with AI-powered enrichment |
| **AI Enrichment** | OpenAI vision/text analysis for product attributes, images, descriptions |
| **Fitment Management** | Vehicle compatibility (Year/Make/Model/Trim) extraction and validation |
| **Listing Management** | Create, edit, version, and optimize marketplace listings |
| **Multi-Store eBay** | Connect and manage multiple eBay accounts/stores |
| **Publish & Sync** | Push listings to eBay, sync inventory, import orders |
| **Inventory Tracking** | Ledger-based inventory with allocation and reconciliation |
| **Order Management** | Import and fulfill orders from connected channels |
| **Team Collaboration** | RBAC-based multi-user access with audit trails |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  Dashboard  │  │   Catalog   │  │  Listings   │  │  Orders  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Ingest    │  │   Motors    │  │   Settings  │  │  Audit   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP / WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (NestJS 11)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │    Auth     │  │   Listings  │  │   Catalog   │  │  Orders  │ │
│  │    RBAC     │  │  Ingestion  │  │   Import    │  │ Inventory│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │    eBay     │  │   Motors    │  │   Storage   │  │  Common  │ │
│  │ Integration │  │Intelligence │  │    (S3)     │  │ (OpenAI) │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL / Redis / S3
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │  PostgreSQL │  │    Redis    │  │    AWS S3   │  │  BullMQ  │ │
│  │  (Primary)  │  │  (Cache/    │  │  (Images/   │  │ (Queues) │ │
│  │             │  │   PubSub)   │  │   Assets)   │  │          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Primary Data Flow

### 1. Catalog Import Flow

```
User uploads CSV
    ↓
POST /api/catalog-import/upload
    ↓
CSV Import Processor (BullMQ queue)
    ↓
Parse → Validate → Transform
    ↓
Create CatalogProduct records
    ↓
AI Enrichment (optional - OpenAI queue)
    ↓
Motors Intelligence (attribute extraction)
    ↓
Review Queue (human approval)
    ↓
Ready for Publishing
```

### 2. Listing Publish Flow

```
User selects product → "Publish to eBay"
    ↓
Load eBay stores (ConnectedEbayAccount)
    ↓
Select store + configure listing
    ↓
POST /api/channels/ebay/publish
    ↓
eBay Publish Processor (BullMQ)
    ↓
Call eBay API (AddItem/ReviseItem)
    ↓
Create ListingRecord + ChannelListing
    ↓
Sync inventory allocation
    ↓
Audit log + Notification (WebSocket)
```

### 3. Order Import Flow

```
Scheduled job (every N minutes)
    ↓
eBay Order Sync Processor
    ↓
Fetch orders from eBay API
    ↓
Create Order + OrderItem records
    ↓
Update inventory ledger
    ↓
Notification to user (WebSocket)
    ↓
Dashboard KPI update (aggregation queue)
```

---

## Key Domain Concepts

### Listing Lifecycle

| Status | Meaning |
|--------|---------|
| `draft` | Initial state, being edited |
| `ready` | Complete, awaiting publish |
| `published` | Live on marketplace(s) |
| `sold` | Item sold, no longer available |
| `delisted` | Removed from marketplace |
| `archived` | Historical record only |

### eBay Integration Concepts

| Entity | Purpose |
|--------|---------|
| `ConnectedEbayAccount` | OAuth-connected eBay developer account |
| `EbayAccountMarketplace` | Marketplace-specific settings (US, UK, etc.) |
| `EbayOauthToken` | Stored tokens (access + refresh) |
| `EbayBusinessPolicy` | Shipping/return/payment policies from eBay |
| `InternalStore` | Logical store within the platform |
| `ListingStoreOverride` | Per-listing store-specific settings |

### Motors Intelligence

| Entity | Purpose |
|--------|---------|
| `MotorsProduct` | Automotive-specific product data |
| `ProductCandidate` | AI-extracted product suggestions |
| `ExtractedAttribute` | Structured attributes from AI analysis |
| `ValidationResult` | Quality/accuracy scoring |
| `ReviewTask` | Human-in-the-loop approval queue |

---

## Integration Points

### External APIs

| Service | Usage |
|---------|-------|
| **eBay API** | Primary marketplace (OAuth, trading, shopping) |
| **OpenAI API** | AI enrichment (GPT-4o-mini, vision, embeddings) |
| **AWS S3** | Image storage, thumbnails, exports |

### Internal Queues (BullMQ)

| Queue | Purpose |
|-------|---------|
| `ingestion` | Image/file ingestion |
| `pipeline` | AI processing pipeline |
| `catalog-import` | CSV import processing |
| `fitment` | Vehicle fitment extraction |
| `inventory` | Inventory sync operations |
| `orders` | Order import/processing |
| `channels` | Channel publish operations |
| `ebay-listing-publish` | eBay-specific publishing |
| `ebay-inventory-sync` | eBay inventory synchronization |
| `ebay-order-sync` | eBay order import |
| `openai` | AI API calls (rate-limited) |
| `motors-pipeline` | Motors intelligence processing |
| `storage-thumbnails` | Image thumbnail generation |
| `storage-cleanup` | Asset cleanup |
| `dashboard` | KPI aggregation |

---

## User Roles & Permissions

### Role Hierarchy

```
super_admin (everything)
    └── admin (all ops, no white-label)
        └── manager (ops management)
            ├── staff (day-to-day)
            ├── catalog_manager (catalog focus)
            ├── listing_manager (listing focus)
            └── ops_user (orders/inventory)
                └── viewer (read-only)
```

### Permission Pattern

Permissions follow `module.action` naming:
- `listings.view`, `listings.create`, `listings.update`, `listings.delete`
- `catalog.import`, `catalog.compliance`
- `ebay.publish`, `ebay.manage`
- `users.create`, `roles.manage`

---

## Deployment Topology

### Docker Compose (Development/Production)

```
┌─────────────────────────────────────────┐
│           Docker Network                │
│  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│  │postgres │  │  redis  │  │backend │ │
│  │  :5432  │  │  :6379  │  │ :4191  │ │
│  └─────────┘  └─────────┘  └────────┘ │
│                             ┌────────┐ │
│                             │frontend│ │
│                             │ :8050  │ │
│                             └────────┘ │
└─────────────────────────────────────────┘
```

### Ports Reference

| Service | Port | Access |
|---------|------|--------|
| Frontend (Docker) | 8050 | External |
| Backend API | 4191 | External |
| PostgreSQL | 5432 | Internal/External |
| Redis | 6379 | Internal/External |
| Frontend (Vite dev) | 3911 | Local dev only |

---

## Technology Choices & Rationale

| Choice | Rationale |
|--------|-----------|
| **NestJS** | Enterprise-grade Node.js framework with DI, modular architecture |
| **TypeORM** | TypeScript-first ORM with migration support, PostgreSQL optimized |
| **React + Vite** | Modern frontend tooling with fast HMR, optimized builds |
| **Tailwind CSS** | Utility-first CSS for rapid UI development |
| **BullMQ** | Redis-backed queues with job scheduling, retries, concurrency control |
| **Socket.IO** | Real-time notifications, bidirectional communication |
| **OpenAI** | Best-in-class AI for vision/text analysis |
| **AWS S3** | Reliable object storage with presigned URL support |

---

## Related Documentation

- **Architecture Deep Dive**: `/docs/architecture/overview.md`
- **API Reference**: `/docs/architecture/api-map.md`
- **Database Schema**: `/docs/architecture/database.md`
- **Auth & RBAC**: `/docs/architecture/auth-rbac.md`
- **Setup Guide**: `/docs/development/setup.md`
- **Known Gaps**: `/docs/product/known-gaps.md`

---

*Last updated: 2026-05-29*

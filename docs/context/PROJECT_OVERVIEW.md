# Project Overview

> **Source**: Moved from `docs/SYSTEM_OVERVIEW.md` (2026-05-29).
> For technical architecture details, see [/docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

## What This Project Is

RealTrackApp (internal name: `listingpro`) is a **multi-channel automotive parts listing & operations platform**. It ingests product data and images, enriches with AI (OpenAI), manages vehicle fitment (YMMT — Year/Make/Model/Trim), and publishes/syncs listings to marketplaces (primarily **eBay**), with orders, inventory, pricing, dashboards, automation, RBAC, and audit.

## Project Type

**Existing Project** — mature, actively developed full-stack platform. ~23 backend modules, ~79 entities, 21 TypeORM migrations, ~16 BullMQ queues.

## Current Status

**Active Development** — eBay multi-store is the primary focus. Architecture is mature; feature maturity varies by module. See [CURRENT_STATE.md](CURRENT_STATE.md) and [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md).

## Business Goal

Help automotive parts sellers manage their entire catalog-to-marketplace workflow: import product data, enrich with AI, publish to eBay (multi-store), sync inventory, import orders, and collaborate with role-based access.

## Target Users

- Automotive parts sellers (mid-market and enterprise)
- Catalog managers and listing specialists
- E-commerce operations teams
- Platform owners (super_admin white-label)

## Core Capabilities

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

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript + Tailwind CSS | React 18, Vite 6 |
| Backend | NestJS + TypeORM | NestJS 11 |
| Database | PostgreSQL | 16 |
| Cache/Queues | Redis + BullMQ | Redis 7 |
| Realtime | Socket.IO | via `@nestjs/websockets` |
| AI | OpenAI | GPT-4o-mini, text-embedding-3-small |
| Storage | AWS S3 | + Sharp for thumbnails |
| Auth | JWT + Passport | bcrypt 12 rounds |
| Infra | Docker Compose | PM2 optional |

## Primary Data Flow

```
Upload/CSV/Image
    → catalog-import or ingestion (BullMQ job)
    → AI enrichment (OpenAI: vision/text) + fitment extraction
    → motors-intelligence (attribute extraction, validation)
    → listing-record / catalog-product persisted (Postgres)
    → review/approve (review queues)
    → channels / integrations.ebay publish (BullMQ)
    → eBay marketplace
    → order import + inventory sync (BullMQ, scheduled)
    → dashboard aggregation + notifications (WebSocket)
```

## User Roles & Permissions

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

Permissions follow `module.action` naming (~90 permissions, 8 roles). Source of truth: `backend/src/rbac/permission-registry.ts`.

## Current Priorities

See [ROADMAP.md](ROADMAP.md) and [NEXT_STEPS.md](NEXT_STEPS.md).

## Main Risks

- Low automated test coverage (9 backend specs, 1 e2e, 0 frontend)
- No JWT revocation (client-side logout only)
- Weak tenant/org row-level isolation
- eBay OAuth token refresh fragility
- Branding inconsistency (RealTrackApp vs ListingPro)

Full risk inventory: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Documentation Map

| Topic | File |
|-------|------|
| System Map | [SYSTEM_MAP.md](SYSTEM_MAP.md) |
| Current State | [CURRENT_STATE.md](CURRENT_STATE.md) |
| Feature Registry | [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md) |
| Product Requirements | [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) |
| Known Issues | [KNOWN_ISSUES.md](KNOWN_ISSUES.md) |
| Next Steps | [NEXT_STEPS.md](NEXT_STEPS.md) |
| Architecture | [/docs/architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) |
| Database Schema | [/docs/architecture/DATABASE_SCHEMA.md](../architecture/DATABASE_SCHEMA.md) |
| API Contracts | [/docs/architecture/API_CONTRACTS.md](../architecture/API_CONTRACTS.md) |
| Auth & RBAC | [/docs/architecture/AUTH_RBAC.md](../architecture/AUTH_RBAC.md) |
| Integrations | [/docs/architecture/INTEGRATIONS.md](../architecture/INTEGRATIONS.md) |
| Security | [/docs/architecture/SECURITY.md](../architecture/SECURITY.md) |
| Frontend Map | [/docs/frontend/COMPONENT_MAP.md](../frontend/COMPONENT_MAP.md) |
| Backend Map | [/docs/backend/MODULE_MAP.md](../backend/MODULE_MAP.md) |
| Setup | [/docs/operations/SETUP.md](../operations/SETUP.md) |
| Environment Variables | [/docs/operations/ENVIRONMENT_VARIABLES.md](../operations/ENVIRONMENT_VARIABLES.md) |
| Master Entry Point | [/docs/AGENT_SYSTEM_MEMORY.md](../AGENT_SYSTEM_MEMORY.md) |

---

*Last updated: 2026-06-11. Reorganized: 2026-06-06.*

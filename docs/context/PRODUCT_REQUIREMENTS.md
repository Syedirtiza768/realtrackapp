# Product Requirements

> **Source**: Consolidated from `docs/product/features.md` and `docs/PRODUCT_FEATURE_CATALOG.md` (2026-05-29).
> For current implementation status, see [FEATURE_REGISTRY.md](FEATURE_REGISTRY.md).

## Problem Statement

Automotive parts sellers need a single platform to manage their catalog, enrich product data with AI, manage vehicle fitment/compatibility, publish to multiple eBay stores, sync inventory, handle orders, and collaborate with team members — all with role-based access control.

## Target Users

- **Mid-market and enterprise marketplace sellers** — selling automotive parts on eBay Motors
- **Catalog managers** — responsible for product data quality and imports
- **Listing specialists** — creating and optimizing marketplace listings
- **Operations teams** — order fulfillment, inventory management
- **Platform owners** — white-label configuration, role management

## User Roles

8 system roles defined in `backend/src/rbac/permission-registry.ts`:

| Role | Typical User | Scope |
|------|-------------|-------|
| `super_admin` | Platform owner | Everything, including white-label/client settings |
| `admin` | Org administrator | Broad operational access, no branding controls |
| `manager` | Team lead | Manage listings, orders, channels, catalog |
| `staff` | Day-to-day operator | Create/update listings & catalog (default role) |
| `catalog_manager` | Catalog specialist | Catalog import + product management |
| `listing_manager` | Listing specialist | Listing create/publish/channel sync |
| `ops_user` | Operations | Orders, inventory, fulfillment |
| `viewer` | Read-only stakeholder | View-only across modules |

Full details: [/docs/planning/USER_ROLES.md](../planning/USER_ROLES.md) and [/docs/architecture/AUTH_RBAC.md](../architecture/AUTH_RBAC.md).

## Core Features

### Catalog & Ingestion
- CSV/bulk catalog import with AI enrichment
- AI image classification and attribute extraction (OpenAI Vision)
- Vehicle fitment data management (Year/Make/Model/Trim)
- Motors Intelligence pipeline (attribute extraction, validation, review)
- Catalog product search with automotive facets

### Listing Management
- Listing CRUD with version history and revisions
- AI-assisted listing generation (OpenAI text)
- Listing templates
- Export rules
- Bulk actions (status transitions, publish)

### Marketplace (eBay)
- Multi-account OAuth connection and management
- Multi-store eBay integration (multiple stores per account)
- Business policy sync, inventory location management
- Listing publish with full validation (title, images, condition, description, policies)
- Inventory sync (price/quantity updates)
- Order import and fulfillment
- SellerPundit integration as alternative eBay connection source

### Operations
- Inventory ledger with allocations and events
- Order management (import, fulfill, ship, refund)
- Dashboard with KPI aggregation
- Notifications (in-app + WebSocket via Socket.IO)
- Audit trail

### Platform
- Role-based access control with ~90 granular permissions
- White-label/client branding (super_admin only)
- Feature flags
- Automation rules
- Pricing intelligence
- Settings (tenant, shipping, pricing rules)

## Non-Core Features (Planned / Partial)

- Shopify/Amazon/Walmart channel integrations (scaffolding only)
- JWT token revocation and refresh rotation
- Comprehensive automated test suite
- Formal acceptance criteria

## Business Rules

1. **Schema changes via migrations only** — never enable `DB_SYNCHRONIZE` in production
2. **Auth by default** — all backend routes protected unless `@Public()` decorator
3. **New routes need permissions** — register in `backend/src/rbac/permission-registry.ts`
4. **Heavy work in queues** — CSV imports, image processing, eBay sync all use BullMQ
5. **eBay is primary channel** — Shopify/Amazon/Walmart are scaffolding only
6. **Secrets in env vars only** — never hardcode or commit values
7. **Client-side logout** — no server token revocation (known gap)
8. **Super-admin only features** — client settings/white-label require `super_admin` role

## Permissions

Permission naming: `module.action` (e.g., `listings.view`, `ebay.publish`). ~90 permissions across ~20 modules. Default role buckets: `READ_ONLY`, `READ_WRITE`, `MANAGER_UP`, `ADMIN_UP`, `SUPER_ADMIN_ONLY`.

Source of truth: `backend/src/rbac/permission-registry.ts`.

## Success Criteria

- Catalog import pipeline handles large CSV files without OOM
- eBay multi-store publish succeeds end-to-end with valid listings
- AI enrichment produces actionable, accurate product attributes
- RBAC correctly enforces permissions across all modules
- Platform handles multiple concurrent users with different roles

## Out of Scope

- Non-eBay marketplace full integrations (Shopify/Amazon/Walmart remain scaffolding)
- Multi-tenant SaaS model (current org model is internal, not SaaS)
- Mobile app
- Customer-facing storefront

---

*Reorganized: 2026-06-06.*

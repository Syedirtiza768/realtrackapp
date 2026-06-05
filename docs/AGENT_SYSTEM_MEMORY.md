# AGENT_SYSTEM_MEMORY.md

> **START HERE** — This is the primary entry point for any AI agent working on RealTrackApp.
> Read this first, then follow the links to deeper documentation.

---

## 1. Application Summary

**RealTrackApp** (internal name: `listingpro`) is a full-stack **automotive parts listing & operations platform**. It enables businesses to:

- Ingest product data via CSV/catalog import
- Enrich products with AI (OpenAI vision + text)
- Manage vehicle fitment (YMMT - Year/Make/Model/Trim)
- Publish/sync listings to marketplaces (primarily **eBay**)
- Manage inventory, orders, and pricing
- Handle multi-store/multi-account eBay integrations
- Provide role-based access control (RBAC) for teams

**Target users**: Automotive parts sellers, catalog managers, e-commerce operators.

---

## 2. Tech Stack

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
| Infra | Docker Compose | + optional PM2 |

---

## 3. Folder Structure

```
F:\apps\realtrackapp/
├── src/                          # React frontend
│   ├── components/               # Feature components by domain
│   ├── lib/                      # API clients, auth, permissions
│   ├── contexts/                 # React contexts (Branding, Auth)
│   ├── hooks/                    # Custom React hooks
│   └── types/                    # Shared TypeScript types
├── backend/
│   └── src/                      # NestJS backend
│       ├── */                    # 23 modules (auth, rbac, listings, etc.)
│       ├── migrations/           # 21 TypeORM migrations
│       └── scripts/              # Seed scripts
├── docs/                         # Documentation (this set)
├── docker/                       # Docker config (nginx, postgres init)
├── scripts/                      # Utility scripts
├── uploads/                      # Runtime uploads (not source)
├── output/                       # Runtime output (not source)
├── dist/                         # Build output (not source)
├── docker-compose.yml            # Full stack orchestration
├── Dockerfile                    # Frontend container
├── backend/Dockerfile            # Backend container
└── listingpro.dump               # Postgres seed dump
```

---

## 4. Main Workflows

### Ingestion → Publish Pipeline

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

### Key User Flows

1. **Catalog Import** → `/catalog/import` → Upload CSV → Process via BullMQ → Review
2. **Listing Creation** → `/listings/new` → AI-assisted editor → Save/Publish
3. **eBay Publish** → `/catalog/products/:id/publish/ebay` → Select store → Publish
4. **Order Management** → `/orders` → Import from eBay → Fulfill
5. **Settings** → `/settings` → Configure stores, policies, users

---

## 5. Auth and RBAC Summary

### Authentication
- **Scheme**: JWT Bearer tokens (Passport JWT)
- **Storage**: `localStorage` key `mk_auth_token`
- **Expiry**: Configured in `auth.module.ts` (verify current setting)
- **Logout**: Client-side only (no server revocation)

### Authorization (RBAC)
- **8 System Roles**: super_admin, admin, manager, staff, viewer, catalog_manager, listing_manager, ops_user
- **~90 Permissions**: Named `module.action` (e.g., `listings.view`, `ebay.publish`)
- **Source of Truth**: `backend/src/rbac/permission-registry.ts`
- **Enforcement**: Global guard stack → `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`

### Role Capabilities
| Role | Scope |
|------|-------|
| super_admin | Everything + client settings/white-label |
| admin | Broad ops, no branding controls |
| manager | Ops management across listings/orders/channels |
| staff | Day-to-day listing/catalog ops (default for new users) |
| viewer | Read-only |

---

## 6. Database Summary

- **Engine**: PostgreSQL 16
- **ORM**: TypeORM 0.3
- **Entities**: ~79 entity files across 23 modules
- **Migrations**: 21 files in `backend/src/migrations/`
- **Key Tables**:
  - `users`, `roles`, `permissions` (auth/RBAC)
  - `listing_records`, `listing_revisions` (listings)
  - `catalog_products`, `catalog_imports` (catalog)
  - `orders`, `order_items` (orders)
  - `connected_ebay_accounts`, `ebay_oauth_tokens` (eBay integration)
  - `inventory_ledger`, `inventory_events` (inventory)

### Multi-tenancy
- Internal: `Organization` / `OrganizationMember` tables
- eBay stores: Separate `ConnectedEbayAccount` / `Store` entities
- **Note**: Row-level tenant isolation enforcement is inconsistent (see Gaps)

---

## 7. API Summary

- **Base URL**: `/api` (global prefix in `main.ts`)
- **Swagger**: `/api/docs` (non-production only)
- **Auth Header**: `Authorization: Bearer <jwt>`
- **Rate Limiting**: 10/s, 100/min, 1000/hr via `ThrottlerGuard`

### Key Controllers (see `/docs/architecture/api-map.md` for full list)
| Path | Purpose |
|------|---------|
| `/api/auth/*` | Login, register, me, logout |
| `/api/listings/*` | Listing CRUD, revisions, generation |
| `/api/catalog-import/*` | CSV import, compliance |
| `/api/integrations/ebay/*` | eBay OAuth, sync, publish |
| `/api/orders/*` | Order management |
| `/api/inventory/*` | Inventory ledger |
| `/api/rbac/*` | User/role management |

### ⚠️ Double-prefix Issue
Two controllers declare paths with `api/` prefix that combines with global prefix:
- `/api/api/feature-flags` (feature-flag.controller.ts)
- `/api/api/export-rules` (export-rule.controller.ts)

Verify client calls before fixing.

---

## 8. Frontend Summary

- **Framework**: React 18 + TypeScript + Vite 6
- **Styling**: Tailwind CSS
- **Routing**: React Router 7
- **State**: TanStack Query 5 (server state), React Context (auth, branding)
- **API Calls**: Custom `fetchWithAuth` in `src/lib/authApi.ts`

### Route Structure (see `src/App.tsx`)
- Public: `/login`, `/register`, `/forgot-password`, `/channels/ebay/callback`
- Protected: All other routes wrapped in `<ProtectedRoute>`
- Permission-gated: Routes check `permissions` prop against RBAC

### Key Components
- `Shell` — Main app layout with navigation
- `ProtectedRoute` — Auth + permission gate
- `BrandingProvider` — White-label theming

---

## 9. Backend Summary

- **Framework**: NestJS 11
- **Modules**: 23 modules registered in `app.module.ts`
- **Queues**: ~16 BullMQ queues for background processing
- **Guards**: Global `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`
- **Validation**: Global `ValidationPipe` (strict: `forbidNonWhitelisted`)

### Key Modules
| Module | Purpose |
|--------|---------|
| `auth` | JWT auth, user management |
| `rbac` | Roles, permissions, guards |
| `listings` | Listing CRUD, revisions, generation |
| `ingestion` | Image/AI ingestion pipeline |
| `catalog-import` | CSV import, compliance |
| `integrations/ebay` | eBay OAuth, multi-store, sync |
| `channels` | Marketplace channel abstraction |
| `inventory` | Inventory ledger, allocations |
| `orders` | Order CRUD, eBay import |
| `motors-intelligence` | AI attribute extraction |

---

## 10. Deployment Summary

### Docker Compose (Recommended)
```bash
cp .env.example .env          # Set JWT_SECRET + API keys
docker compose up -d --build  # Full stack
docker compose logs -f
```
- Frontend: http://localhost:8050
- API: http://localhost:4191/api
- Swagger: http://localhost:4191/api/docs

### Local Dev (Hot Reload)
```bash
# Terminal 1: Backend
cd backend && npm run start:dev   # :4191

# Terminal 2: Frontend
npm run dev                        # :3911 (proxies /api → :4191)
```

### Environment Requirements
- `JWT_SECRET` — Required, must be strong for production
- `DB_PASSWORD` — Change from default `postgres`
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_DEV_ID` — For eBay integration
- `OPENAI_API_KEY` — For AI features
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — For S3 storage

---

## 11. Important Business Rules

1. **Schema changes via migrations only** — Never enable `DB_SYNCHRONIZE` in production
2. **New routes need permissions** — Register in `permission-registry.ts`
3. **Auth by default** — All routes protected unless `@Public()` decorator
4. **Heavy work in queues** — CSV imports, image processing, eBay sync all use BullMQ
5. **eBay is primary channel** — Shopify/Amazon/Walmart are scaffolding only
6. **Client-side logout** — No server token revocation (known gap)
7. **Super-admin only features** — Client settings/white-label require `super_admin` role

---

## 12. Previous Session Learnings

### From Codebase Analysis (2026-05-29)

1. **Double `/api` prefix** exists in two controllers — verify before fixing
2. **Uncommitted working tree** has many modified files — needs triage
3. **Forgot-password UI** exists but backend reset flow unverified
4. **Branding inconsistency** — "RealTrackApp" vs "ListingPro" (DB name, login screen)
5. **TEXT-typed price columns** — Partially fixed by migration, verify remaining
6. **Missing foreign keys** — Historical issue, needs audit
7. **Sparse tests** — 9 backend specs, 1 e2e, no frontend tests

### Documentation Set Created
- `/docs/AGENT_SYSTEM_MEMORY.md` (this file) — Master entry point
- `/docs/SYSTEM_OVERVIEW.md` — High-level system summary
- `/docs/CODEMAP.md` — File and module reference
- `/docs/DATABASE_MAP.md` — Database schema documentation
- `/docs/API_MAP.md` — API endpoint reference (links to existing)
- `/docs/FRONTEND_MAP.md` — Frontend structure
- `/docs/BACKEND_MAP.md` — Backend module reference
- `/docs/RBAC_AND_SECURITY.md` — Security model
- `/docs/SETUP_AND_DEPLOYMENT.md` — Setup guide
- `/docs/AGENT_HANDOFF.md` — Handoff template
- `/docs/KNOWN_GAPS_AND_RISKS.md` — Risk register

---

## 13. Current Implementation Status

### Implemented (Working)
- Auth + RBAC (login, register, permissions, roles)
- Dashboard with KPIs
- Listing editor with AI assistance
- Catalog import (CSV)
- eBay multi-store integration (OAuth, sync, publish)
- Inventory management
- Order import from eBay
- Motors filters UI
- Notifications (WebSocket)
- Audit trail

### Partial (Working but incomplete)
- AI listing generation (quality unverified)
- Motors intelligence pipeline
- Ingestion pipeline
- Channels beyond eBay (scaffolding)
- Forgot password flow
- Feature flags

### Missing/Scaffolding
- Shopify/Amazon/Walmart full integration
- Frontend tests
- Comprehensive backend tests
- Server-side token revocation

---

## 14. Known Gaps

See `/docs/KNOWN_GAPS_AND_RISKS.md` for full details. Critical items:

1. **R1**: Double-`/api` prefix routing confusion
2. **R2**: Low test coverage hides regressions
3. **R3**: Production secrets may be left as defaults
4. **R6**: TEXT-typed price columns (partially fixed)
5. **R8**: Weak tenant/org row-level isolation
6. **R9**: No JWT revocation; long-lived tokens
7. **R10**: eBay token refresh/OAuth fragility

---

## 15. Safe Development Rules

1. **Read before changing** — Inspect existing code, don't guess
2. **Follow patterns** — Match existing module structure, naming conventions
3. **Update docs** — Every meaningful change updates relevant `/docs` files
4. **Migrations only** — Never use `synchronize: true` for schema changes
5. **Register permissions** — New routes need entries in `permission-registry.ts`
6. **Test your changes** — Run `lint`, `build`, `test` where applicable
7. **No drive-by refactors** — Stay focused on the requested task
8. **Verify risky areas** — Extra care with auth, migrations, eBay OAuth

---

## 16. Files Future Agents Must Read First

**Before any coding task, read in this order:**

1. **`/docs/AGENT_SYSTEM_MEMORY.md`** (this file) — Master context
2. **`/docs/architecture/overview.md`** — Architecture deep dive
3. **`/docs/architecture/api-map.md`** — API reference
4. **`/docs/architecture/database.md`** — Database reference
5. **`/docs/product/known-gaps.md`** — Current limitations
6. **Relevant module docs** — Check `/docs/architecture/codebase-map.md` for module-specific files

**Also read:**
- `AGENTS.md` — Agent operational rules
- `CLAUDE.md` — Claude-specific guidance
- `CONTEXT.md` — Compact project memory
- `README.md` — Quick start and overview

---

## Quick Reference Links

| Topic | File |
|-------|------|
| Architecture | `/docs/architecture/overview.md` |
| API Map | `/docs/architecture/api-map.md` |
| Database | `/docs/architecture/database.md` |
| Auth/RBAC | `/docs/architecture/auth-rbac.md` |
| Codebase Map | `/docs/architecture/codebase-map.md` |
| Features | `/docs/product/features.md` |
| Known Gaps | `/docs/product/known-gaps.md` |
| Risk Register | `/docs/handover/risk-register.md` |
| Next Steps | `/docs/handover/next-steps.md` |
| Setup | `/docs/development/setup.md` |
| Environment | `/docs/development/environment-variables.md` |

---

*Last updated: 2026-05-29 by comprehensive codebase analysis*

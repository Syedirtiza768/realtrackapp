# Development Phases

> **Source**: Extracted from `docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md` (2026-02-28).
> The phase plan below reflects the historical roadmap. Some phases are partially complete; see [/docs/context/ROADMAP.md](../context/ROADMAP.md) for current status.

---

## Phase 0 — Project Understanding and Documentation

### Goal
Create complete project context and planning documentation.

### Deliverables
- Full system audit (backend, frontend, database, infrastructure)
- Gap matrix and risk assessment
- Phased implementation roadmap
- Codebase map and architecture documentation

### Status
✅ Complete (2026-02-28 audit + 2026-05-29 documentation set + 2026-06-06 reorganization)

---

## Phase 1 — Safe Foundations

### Goal
Fix critical infrastructure gaps without changing existing behavior.

### Deliverables
- TypeORM migrations for missing tables and columns
- Missing FK constraints and indexes
- Cron scheduling (`@nestjs/schedule`) for background jobs
- Event system wiring (EventEmitter2)
- Queue processor routing fixes
- Feature flag service
- Dead code removal
- XSS protection (DOMPurify)

### Status
✅ Mostly Complete — some items need verification

---

## Phase 2 — Core Features

### Goal
Build the first functional version of the main product.

### Deliverables
- Automation rules engine
- Listing templates
- Inventory real-time sync
- Order auto-import from eBay
- Dashboard KPI aggregation
- Bulk actions UI
- Auth UI (login, register, password reset)
- Audit trail UI
- Settings completion

### Status
✅ Mostly Complete — non-eBay channel adapters are scaffolding

---

## Phase 3 — Multi-Store eBay & AI Pipeline

### Goal
Full multi-store eBay integration with AI enrichment pipeline.

### Deliverables
- eBay multi-account OAuth connection
- Multi-store listing management
- Motors Intelligence AI pipeline (attribute extraction, validation, review)
- Listing optimization pipeline
- SellerPundit integration (alternative eBay connection source)
- RBAC foundation (8 roles, ~90 permissions, registry-driven)
- Client settings / white-label branding

### Status
✅ Implemented — current focus area

---

## Phase 4 — Migration & Optimization

### Goal
Consolidate, optimize, and remove deprecated code.

### Deliverables
- TEXT → NUMERIC price column migration (complete conversion)
- Channel table consolidation (deprecate `channel_listings`)
- PostgreSQL partitioning for high-volume tables
- API v2 with standardized response shapes
- TanStack Query for frontend API caching
- Multi-tenant/org isolation enforcement
- Performance tuning (connection pool, queries, Redis caching)
- Dead code removal (complete)

### Status
⚠️ Partially Complete — several items still in progress

---

## Phase 5 — Production Readiness

### Goal
Prepare the project for real users and scale.

### Deliverables
- Comprehensive test suite (backend unit/integration, frontend tests, e2e)
- JWT refresh rotation and server-side revocation
- Tenant isolation audit and enforcement
- Security review and penetration testing
- Performance benchmarking and optimization
- Production deployment documentation
- Monitoring and alerting setup

### Status
Planned

---

*Reorganized: 2026-06-06.*

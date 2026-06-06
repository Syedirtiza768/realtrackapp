# Roadmap

> **Source**: Extracted from `docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md` (2026-02-28) and `docs/handover/next-steps.md` (2026-05-29).
> The phased plan below reflects the historical roadmap from the full system audit. Some phases may already be partially complete.

---

## Development Phases

### Phase 1 — Safe Foundations ✅ (Mostly Complete)

**Goal**: Fix critical infrastructure gaps without changing existing behavior.

| # | Task | Status |
|---|------|--------|
| 1.1 | Create TypeORM migrations for missing tables | ✅ Complete (21 migrations exist) |
| 1.2 | Add `searchVector`, `extractedMake`, `extractedModel` columns | ✅ Complete |
| 1.3 | Add missing FK constraints | ⚠️ Partial (verification needed) |
| 1.4 | Add missing indexes | ✅ Complete |
| 1.5 | Install `@nestjs/schedule` and wire cron jobs | ✅ Complete |
| 1.6 | Wire EventEmitter2 for domain events | ✅ Complete |
| 1.7 | Fix `channels` queue processor routing | ✅ Complete |
| 1.8 | Feature flag service | ✅ Complete (partial — double-prefix issue) |
| 1.9 | Remove dead frontend code | ⚠️ Partial (verify current state) |
| 1.10 | Add DOMPurify for XSS protection | ✅ Complete (`lib/sanitize.ts`) |

### Phase 2 — Parallel Implementation ✅ (Mostly Complete)

**Goal**: Build missing features as new isolated modules alongside existing ones.

| # | Task | Status |
|---|------|--------|
| 2.1 | Automation Rules Engine | ✅ Implemented (`automation/` module) |
| 2.2 | Template System | ✅ Implemented (`templates/` module) |
| 2.3 | Amazon Adapter | ⚠️ Scaffolding only |
| 2.4 | Walmart Adapter | ⚠️ Scaffolding only |
| 2.5 | Inventory Real-Time Sync | ✅ Implemented |
| 2.6 | Order Auto-Import | ✅ Implemented |
| 2.7 | Dashboard Aggregation | ✅ Implemented |
| 2.8 | Bulk Actions UI | ✅ Implemented |
| 2.9 | Auth UI | ✅ Implemented (login, register, forgot pw) |
| 2.10 | Pricing Push to Channels | ⚠️ Partial |
| 2.11 | Audit Trail UI | ✅ Implemented |
| 2.12 | Settings Completion | ✅ Implemented |

### Phase 3 — Migration & Optimization ⚠️ (Partially Complete)

**Goal**: Consolidate, optimize, and remove deprecated code.

| # | Task | Status |
|---|------|--------|
| 3.1 | Migrate TEXT → NUMERIC price columns | ⚠️ Partial (numeric cols added, TEXT cols remain) |
| 3.2 | Deprecate `channel_listings` table | ⚠️ In progress |
| 3.3 | Extract compliance columns to satellite | Not started |
| 3.4 | Add PostgreSQL partitioning | Not started |
| 3.5 | API v2 for modified response shapes | ⚠️ Partial (`listings-v2`) |
| 3.6 | TanStack Query for frontend caching | ✅ Implemented |
| 3.7 | Multi-tenant/org model | ⚠️ Partial (columns exist, isolation inconsistent) |
| 3.8 | Performance tuning | ⚠️ Ongoing |
| 3.9 | Remove dead code | ⚠️ Ongoing |

### Phase 4 — Multi-Store eBay & AI Pipeline ✅ (Current Focus)

**Goal**: Full multi-store eBay integration with AI enrichment pipeline.

| # | Task | Status |
|---|------|--------|
| 4.1 | eBay multi-account OAuth | ✅ Implemented |
| 4.2 | Multi-store listing management | ✅ Implemented |
| 4.3 | Motors Intelligence pipeline | ✅ Implemented |
| 4.4 | Listing optimization pipeline | ✅ Implemented |
| 4.5 | SellerPundit integration | ✅ Implemented |
| 4.6 | RBAC foundation + client settings | ✅ Implemented |

---

## Now (Current Priorities)

From [NEXT_STEPS.md](NEXT_STEPS.md):

1. **Resolve double-`/api` prefix** in `feature-flag` and `export-rule` controllers
2. **Commit/triage uncommitted working tree**
3. **Raise test coverage** on auth/RBAC and eBay publish/sync
4. **Verify production secrets & config** (strong JWT, non-default DB creds, correct eBay environment)

## Next (High Priority)

5. Standardize branding (RealTrackApp vs ListingPro)
6. Confirm DB hygiene (numeric columns, missing FKs, channel table consolidation)
7. Finish or flag forgot-password flow
8. Tenant isolation review

## Later (Medium Priority)

9. Flesh out non-eBay channels or remove scaffolding
10. Add frontend tests for protected routing
11. Document DTO request/response shapes in API contracts

## Future Possibilities

- Shopify/Amazon/Walmart full channel integration
- JWT refresh token rotation and server-side revocation
- PostgreSQL partitioning for high-volume tables
- Multi-tenant SaaS model
- Mobile app

## Not Currently Planned

- Customer-facing storefront
- Real-time inventory webhooks from eBay
- AI model fine-tuning for automotive domain

---

*Reorganized: 2026-06-06.*

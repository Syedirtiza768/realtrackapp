# Initial Brief

> **Note**: RealTrackApp predates the Self-Sustaining AI Project Context framework. This file is a lightweight stub documenting the project's original intent. For the full picture, see [CONTEXT.md](../../CONTEXT.md) and [/docs/context/PROJECT_OVERVIEW.md](../context/PROJECT_OVERVIEW.md).

## Original Intent

RealTrackApp (originally "ListingPro") was conceived as a **multi-channel automotive parts listing & operations platform** to help automotive aftermarket sellers manage their catalog-to-marketplace workflow:

1. **Ingest product data** from CSV files and images
2. **Enrich with AI** (OpenAI vision for image classification, text generation for listing descriptions)
3. **Manage vehicle fitment** (Year/Make/Model/Trim) for automotive parts compatibility
4. **Publish to eBay** (the primary marketplace) across multiple accounts and stores
5. **Sync inventory and import orders** from connected marketplaces
6. **Collaborate with teams** via role-based access control

## Original Constraints from Code Patterns

- NestJS + TypeORM backend with PostgreSQL
- React + Vite + Tailwind frontend
- JWT authentication with Passport
- Redis + BullMQ for background job processing
- AWS S3 for image storage
- Docker Compose for deployment

## Project Evolution

The project evolved from a prototype (identified in the 2026-02-28 full system audit) to a mature platform with 23 backend modules, ~79 entities, and 21 TypeORM migrations as of 2026-05-29. Key inflection points:

- **Phase 1**: Safe foundations — fixed critical infrastructure, added missing migrations, wired background jobs
- **Phase 2**: Core features — auth UI, bulk actions, inventory sync, order import, dashboard aggregation
- **Phase 3**: Multi-store eBay — eBay multi-account/multi-store, Motors Intelligence AI pipeline, SellerPundit integration, RBAC foundation

---

*Created: 2026-06-06 (stub).*

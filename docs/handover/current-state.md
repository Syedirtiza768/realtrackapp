# Current State

_Snapshot date: 2026-05-29. This file is frozen-in-time; for live state use
`git log` and run the app._

## Where the project is

RealTrackApp is a substantial, actively developed full-stack platform (NestJS +
React + Postgres + Redis/BullMQ) focused on **eBay** automotive-parts listing,
catalog import, AI enrichment, fitment, inventory, orders, and multi-store
management. The architecture is mature (23 backend modules, ~79 entities, 21
migrations, ~16 BullMQ queues, RBAC with 8 roles / ~90 permissions). Maturity of
*individual features* varies — see [/docs/product/features.md](../product/features.md).

## Recent work (from git history, branch `main`)

- eBay multi-store integration, listing optimization, pipeline fitment/S3 improvements.
- Catalog CSV import, eBay compliance, storage, Motors filters UI.
- S3 PutObject/GetObject/DeleteObject smoke test script.
- Docker Node heap raise + CSV import concurrency cap (OOM fix).
- Listing search-vector migration, S3 image mirroring.

## Working tree at snapshot

Many modified backend controllers/entities/migrations were uncommitted (per
`git status`). Treat the working tree as in-progress; confirm with `git status`
before assuming committed state.

## What's solid

- Auth + RBAC (registry-driven, global guards).
- Docker Compose stack with healthchecks, auto-migrations, seed dump.
- eBay OAuth + multi-account/store scaffolding and sync/publish queues.
- Catalog import and storage/S3 pipeline.

## What's shaky / unverified

- Sparse automated tests (9 backend specs, 1 e2e; ~no frontend tests).
- Double-`/api`-prefix controllers (feature-flags, export-rules).
- Multi-marketplace beyond eBay is scaffolding.
- Tenant isolation and some DB typing/FK issues from prior audits.
- `forgot-password` UI without a confirmed backend reset flow.

## Authoritative references

- Architecture: [/docs/architecture/overview.md](../architecture/overview.md)
- API: [/docs/architecture/api-map.md](../architecture/api-map.md)
- DB: [/docs/architecture/database.md](../architecture/database.md)
- Prior deep audit (large, pre-dates this set): `docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`

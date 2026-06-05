# RealTrackApp

Full-stack, multi-channel **automotive parts listing & operations platform**
(internal/DB name: `listingpro`). Ingests product data and images, enriches with
AI, manages vehicle fitment, and publishes/syncs listings to marketplaces
(primarily **eBay**), with orders, inventory, pricing, dashboards, automation,
RBAC, and audit.

- **Frontend**: React 18 + Vite 6 + TypeScript + Tailwind (dev port 3911, Docker 8050)
- **Backend**: NestJS 11 + TypeORM + PostgreSQL 16 (port 4191, API prefix `/api`)
- **Infra**: Redis 7 + BullMQ, Socket.IO, AWS S3, OpenAI; Docker Compose

## Quick start

### Docker (full stack, production-like)

```bash
cp .env.example .env          # set JWT_SECRET (required) + any API keys
docker compose up -d --build  # postgres, redis, backend, frontend
docker compose logs -f
```
Frontend → http://localhost:8050 · API → http://localhost:4191/api · Swagger → `/api/docs`

### Local dev (hot reload)

```bash
# Backend (needs Postgres + Redis running)
cd backend && npm install && npm run start:dev   # :4191

# Frontend (repo root, separate terminal)
npm install && npm run dev                        # :3911, proxies /api → :4191
```

Full instructions: [docs/development/setup.md](docs/development/setup.md).

## Common commands

| Command | Where | Purpose |
|---------|-------|---------|
| `npm run dev` | root | Vite dev server |
| `npm run build` | root | Build frontend |
| `npm run lint` | root | Lint frontend |
| `npm run start:dev` | backend | NestJS watch mode |
| `npm run build` | backend | `nest build` |
| `npm run test` / `test:e2e` | backend | Jest |
| `npm run migration:run` / `:generate` / `:revert` / `:show` | backend | TypeORM migrations |
| `docker compose up -d --build` | root | Full stack |

## Documentation map

Start here, then drill in:

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](CONTEXT.md) | Compact project memory (purpose, stack, status, priorities) |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude Code |
| [AGENTS.md](AGENTS.md) | Rules for any AI agent |
| [CHANGELOG.md](CHANGELOG.md) | Change history |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System overview |
| [docs/architecture/codebase-map.md](docs/architecture/codebase-map.md) | Where things live |
| [docs/architecture/api-map.md](docs/architecture/api-map.md) | Controllers, routes, auth |
| [docs/architecture/database.md](docs/architecture/database.md) | DB, entities, migrations |
| [docs/architecture/auth-rbac.md](docs/architecture/auth-rbac.md) | Auth + RBAC |
| [docs/architecture/integrations.md](docs/architecture/integrations.md) | External APIs + queues |
| [docs/architecture/deployment.md](docs/architecture/deployment.md) | Deploy topology |
| [docs/development/setup.md](docs/development/setup.md) | Local setup |
| [docs/development/environment-variables.md](docs/development/environment-variables.md) | Env var reference |
| [docs/development/agent-workflow.md](docs/development/agent-workflow.md) | How agents work here |
| [docs/product/features.md](docs/product/features.md) | Feature inventory + status |
| [docs/product/known-gaps.md](docs/product/known-gaps.md) | Gaps & caveats |
| [docs/product/user-roles.md](docs/product/user-roles.md) | Roles & permissions |
| [docs/operations/deployment-runbook.md](docs/operations/deployment-runbook.md) | Deploy/rollback runbook |
| [docs/operations/security-checklist.md](docs/operations/security-checklist.md) | Pre-deploy security |
| [docs/handover/current-state.md](docs/handover/current-state.md) | Snapshot of where things are |
| [docs/handover/next-steps.md](docs/handover/next-steps.md) | Prioritized next work |
| [docs/handover/risk-register.md](docs/handover/risk-register.md) | Risks |
| [docs/decisions/adr-index.md](docs/decisions/adr-index.md) | Architecture decisions |

Older reference docs (pre-date this set, preserved as-is):
`docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`, `docs/PRODUCT_FEATURE_CATALOG.md`,
`docs/RBAC.md`, `docs/ebay-*`, `docs/enterprise-*`, `docs/*-audit-report.md`,
`docs/search-architecture.md`.

## First-read order (new contributors / agents)

1. README.md → 2. CONTEXT.md → 3. CLAUDE.md → 4. AGENTS.md →
5. docs/handover/current-state.md → 6. docs/architecture/overview.md →
7. docs/product/features.md → 8. docs/product/known-gaps.md

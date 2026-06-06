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
| [docs/context/PROJECT_OVERVIEW.md](docs/context/PROJECT_OVERVIEW.md) | Project overview |
| [docs/context/SYSTEM_MAP.md](docs/context/SYSTEM_MAP.md) | Where things live |
| [docs/context/CURRENT_STATE.md](docs/context/CURRENT_STATE.md) | Current development state |
| [docs/context/FEATURE_REGISTRY.md](docs/context/FEATURE_REGISTRY.md) | Feature inventory + status |
| [docs/context/KNOWN_ISSUES.md](docs/context/KNOWN_ISSUES.md) | Known issues & risks |
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | Architecture deep dive |
| [docs/architecture/API_CONTRACTS.md](docs/architecture/API_CONTRACTS.md) | Controllers, routes, auth |
| [docs/architecture/DATABASE_SCHEMA.md](docs/architecture/DATABASE_SCHEMA.md) | DB, entities, migrations |
| [docs/architecture/AUTH_RBAC.md](docs/architecture/AUTH_RBAC.md) | Auth + RBAC |
| [docs/architecture/INTEGRATIONS.md](docs/architecture/INTEGRATIONS.md) | External APIs + queues |
| [docs/architecture/DEPLOYMENT.md](docs/architecture/DEPLOYMENT.md) | Deploy topology |
| [docs/architecture/SECURITY.md](docs/architecture/SECURITY.md) | Security model + checklist |
| [docs/frontend/COMPONENT_MAP.md](docs/frontend/COMPONENT_MAP.md) | Frontend structure |
| [docs/frontend/ROUTES_AND_SCREENS.md](docs/frontend/ROUTES_AND_SCREENS.md) | Routes & screens |
| [docs/backend/MODULE_MAP.md](docs/backend/MODULE_MAP.md) | Backend modules |
| [docs/operations/SETUP.md](docs/operations/SETUP.md) | Local setup |
| [docs/operations/ENVIRONMENT_VARIABLES.md](docs/operations/ENVIRONMENT_VARIABLES.md) | Env var reference |
| [docs/operations/TROUBLESHOOTING.md](docs/operations/TROUBLESHOOTING.md) | Common issues |
| [docs/operations/TESTING.md](docs/operations/TESTING.md) | Testing |
| [docs/planning/USER_ROLES.md](docs/planning/USER_ROLES.md) | Roles & permissions |
| [docs/planning/USER_FLOWS.md](docs/planning/USER_FLOWS.md) | User journeys |
| [docs/handover/risk-register.md](docs/handover/risk-register.md) | Risk register |
| [docs/decisions/adr-index.md](docs/decisions/adr-index.md) | Architecture decisions |
| [docs/AGENT_SYSTEM_MEMORY.md](docs/AGENT_SYSTEM_MEMORY.md) | Master entry point for AI agents |

Older reference docs (pre-date this set, preserved as-is):
`docs/FULL_SYSTEM_AUDIT_AND_ROADMAP.md`, `docs/PRODUCT_FEATURE_CATALOG.md`,
`docs/RBAC.md`, `docs/ebay-*`, `docs/enterprise-*`, `docs/*-audit-report.md`,
`docs/search-architecture.md`.

## First-read order (new contributors / agents)

1. README.md → 2. CONTEXT.md → 3. CLAUDE.md → 4. AGENTS.md →
5. docs/context/CURRENT_STATE.md → 6. docs/architecture/ARCHITECTURE.md →
7. docs/context/FEATURE_REGISTRY.md → 8. docs/context/KNOWN_ISSUES.md

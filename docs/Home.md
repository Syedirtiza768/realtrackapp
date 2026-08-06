# RealTrackApp — Map of Content

**Last reviewed:** 2026-08-06

Entry point for the vault. RealTrackApp (DB name `listingpro` — see
[[areas/database-and-jobs|database-and-jobs]] for the branding note) is a full-stack
eBay automotive-parts listing management and inventory pipeline platform: React
frontend, NestJS backend, PostgreSQL + Redis/BullMQ, and a large surface of
one-off catalog import/enrichment scripts accumulated over time. It is **not** a
monorepo — frontend lives in `src/` at the repo root, backend lives in `backend/`
with its own `package.json`.

Open this vault in Obsidian at the repo root (`F:\apps\realtrackapp`) — the graph
view gives you a live picture of how the areas below connect. Claude Code (and any
other agent) also reads these files directly as plain markdown; see
[[../CLAUDE.md|CLAUDE.md]] and [[../AGENTS.md|AGENTS.md]] for how agents are
expected to use them.

**This repo already had an extensive `docs/` tree before this vault setup** —
dozens of architecture/handoff/audit documents built up over months, several
covering the same ground more than once at different points in time (see the
"Open questions" in each area note below). This Home page and the `areas/*` notes
are a **new, thin orientation layer** on top of that pre-existing material — they
don't replace it, and none of the old content was rewritten or deleted to build
this.

## Areas (new, freshness-tracked orientation notes)
- [[areas/frontend]] — React/Vite/TypeScript SPA (`src/`)
- [[areas/backend]] — NestJS/TypeORM API (`backend/`)
- [[areas/database-and-jobs]] — PostgreSQL, migrations, BullMQ queues
- [[areas/ebay-and-partsbazar360-integration]] — eBay Trading/Browse API
  integration, and the confirmed data contract with the sibling PartsBazar360 repo
- [[areas/deployment]] — Docker, nginx, environment variables

## Cross-cutting references
- [[decisions]] — running log of non-obvious decisions and why they were made
  (day-to-day companion to the ADR-style [[decisions/adr-index|decisions/adr-index.md]]
  and the narrative [[context/DECISION_LOG|context/DECISION_LOG.md]])
- [[context/CURRENT_STATE|context/CURRENT_STATE.md]] — most current single source
  for "what works / what's broken / what's planned" (last updated 2026-08-01;
  treat as more current than [[handover/current-state|handover/current-state.md]],
  which is older)
- [[context/FEATURE_REGISTRY|context/FEATURE_REGISTRY.md]] — feature-by-feature
  maturity tracking

## Pre-existing deep-dive docs (not rewritten here — dates matter)
The `docs/` tree has multiple generations of architecture documentation. When two
files cover the same topic, prefer whichever has the newer modification date and
treat the older one as a historical snapshot rather than current truth:

- Architecture: [[architecture/ARCHITECTURE|architecture/ARCHITECTURE.md]] (Jul 12,
  newer) vs [[architecture/overview|architecture/overview.md]] (Jun 6, older)
- API contracts: [[architecture/API_CONTRACTS|architecture/API_CONTRACTS.md]] (Aug 6,
  newest) vs [[architecture/api-map|architecture/api-map.md]] (Jun 7) vs the
  root-level [[API_MAP|API_MAP.md]] (Jun 6, oldest)
- Database: [[architecture/DATABASE_SCHEMA|architecture/DATABASE_SCHEMA.md]] (Aug 6,
  newest) vs [[architecture/database|architecture/database.md]] (Jul 18) vs the
  root-level [[DATABASE_MAP|DATABASE_MAP.md]] (Jul 18)
- Auth/RBAC: [[architecture/AUTH_RBAC|architecture/AUTH_RBAC.md]] (Jul 13, newer)
  vs [[architecture/auth-rbac|architecture/auth-rbac.md]] (Jun 6) vs the root-level
  [[RBAC|RBAC.md]] / [[RBAC_AND_SECURITY|RBAC_AND_SECURITY.md]]
- Frontend: [[frontend/ROUTES_AND_SCREENS|frontend/ROUTES_AND_SCREENS.md]] (Aug 6,
  newest) and [[frontend/COMPONENT_MAP|frontend/COMPONENT_MAP.md]] (Jul 13) vs the
  root-level [[FRONTEND_MAP|FRONTEND_MAP.md]] (Jul 13)
- Backend module structure: [[backend/MODULE_MAP|backend/MODULE_MAP.md]] vs the
  root-level [[BACKEND_MAP|BACKEND_MAP.md]] and [[CODEMAP|CODEMAP.md]]
- Product/feature scope: [[product/features|product/features.md]] vs
  [[PRODUCT_FEATURE_CATALOG|PRODUCT_FEATURE_CATALOG.md]] (root, older)
- Handoff/audit narratives (largely historical — read for context, not as current
  state): [[AGENT_HANDOFF|AGENT_HANDOFF.md]], [[AGENT_SYSTEM_MEMORY|AGENT_SYSTEM_MEMORY.md]],
  [[FULL_SYSTEM_AUDIT_AND_ROADMAP|FULL_SYSTEM_AUDIT_AND_ROADMAP.md]],
  [[backend-audit-report|backend-audit-report.md]], [[frontend-audit-report|frontend-audit-report.md]],
  [[UPGRADE_BLUEPRINT_GridxConnect_MergeKart|UPGRADE_BLUEPRINT_GridxConnect_MergeKart.md]],
  [[enterprise-implementation-blueprint|enterprise-implementation-blueprint.md]]
- Integration: [[integrations/partsbazar360-trading-enrichment|integrations/partsbazar360-trading-enrichment.md]] —
  see [[areas/ebay-and-partsbazar360-integration]] for the orientation summary
- Ops: [[operations/SETUP|operations/SETUP.md]], [[operations/TESTING|operations/TESTING.md]],
  [[operations/TROUBLESHOOTING|operations/TROUBLESHOOTING.md]], [[operations/api-users|operations/api-users.md]]
- Model comparison work: [[model-comparison/REPORT|model-comparison/REPORT.md]]

## Keeping this vault alive
This map is only useful if it's updated alongside the code. When you (or an AI
session) make an architecturally significant change — new module, new data flow, a
non-obvious workaround — update the relevant `areas/*` note (bump its
`Last reviewed:` date even if content didn't change) and add an entry to
[[decisions]] rather than letting it live only in a commit message or your head.
A pre-commit hook (`scripts/check-docs-freshness.mjs`) enforces this for changes
under `src/`, `backend/src/`, `backend/scripts/`, `scripts/`, and `shared/` — see
[[../AGENTS.md|AGENTS.md]] for how it works and how to override it when it's wrong.

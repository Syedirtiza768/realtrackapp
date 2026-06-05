# RealTrackApp — Claude Code Guide

## Project overview

RealTrackApp is a full-stack eBay listing management and inventory pipeline tool.

- **Frontend**: React + Vite + TypeScript + Tailwind CSS (port 8050)
- **Backend**: NestJS + TypeORM + PostgreSQL + Redis (port 4191)
- **Infra**: Docker Compose (postgres, redis, backend, frontend)

## First read (project memory)

Before any meaningful change, read in order:
`README.md` → `CONTEXT.md` → `AGENTS.md` → `docs/handover/current-state.md` →
`docs/architecture/overview.md`. Trust code over docs when they conflict — then
fix the doc.

## Dev commands

```bash
# Frontend (Vite dev :3911, proxies /api → :4191)
npm run dev

# Backend (NestJS watch :4191, prefix /api)
cd backend && npm run start:dev

# Backend migrations (from backend/)
npm run migration:run        # apply pending
npm run migration:generate   # generate from entity diff
npm run migration:show       # status

# Docker (production-like; frontend :8050)
docker compose up -d --build
docker compose logs -f
```

## Risky areas (extra care)

- `backend/src/app.module.ts` — global guard order, DB/Redis/queue config.
- TypeORM migrations + `data-source.ts` — production runs migrations on boot;
  never enable `DB_SYNCHRONIZE`.
- `backend/src/rbac/permission-registry.ts` — source of truth for RBAC; register
  new permissions here.
- `backend/src/integrations/ebay/` — OAuth/token handling against live API.
- BullMQ processors + `common/scheduler` — concurrency/idempotency.
- `feature-flag` and `export-rule` controllers declare `@Controller('api/...')`
  on top of the global `api` prefix → `/api/api/...`. Verify before "fixing".

## Continuous Documentation Protocol

Before finishing any meaningful task, check whether changes affected:

- README.md
- CONTEXT.md
- CLAUDE.md
- AGENTS.md
- CHANGELOG.md
- /docs/architecture/*
- /docs/development/*
- /docs/product/*
- /docs/operations/*
- /docs/decisions/*
- /docs/handover/*

If yes, update the relevant docs.

No meaningful code change is complete until related documentation is updated.

### Continuous Documentation Rule

Whenever any agent changes code, database schema, API behavior, UI flow, RBAC logic, deployment config, or business rules, it MUST update the relevant documentation in `/docs` during the same session.

**Required updates for changes to:**

| Change Type | Documentation to Update |
|-------------|------------------------|
| New/modified API endpoint | `/docs/architecture/api-map.md`, relevant module docs |
| New/modified database entity | `/docs/architecture/database.md`, `/docs/DATABASE_MAP.md` |
| New/modified permission | `/docs/architecture/auth-rbac.md`, `/docs/RBAC_AND_SECURITY.md` |
| New/modified feature | `/docs/product/features.md` |
| New/modified route | `/docs/FRONTEND_MAP.md`, `src/App.tsx` comments |
| Architecture change | `/docs/architecture/overview.md`, `/docs/SYSTEM_OVERVIEW.md` |
| New module/component | `/docs/CODEMAP.md`, `/docs/BACKEND_MAP.md` or `/docs/FRONTEND_MAP.md` |
| Security change | `/docs/RBAC_AND_SECURITY.md`, `/docs/KNOWN_GAPS_AND_RISKS.md` |
| Deployment change | `/docs/SETUP_AND_DEPLOYMENT.md` |
| Bug fix | `CHANGELOG.md`, relevant docs if behavior changed |
| Breaking change | All relevant docs + `CHANGELOG.md` + migration notes |

**Documentation Principles:**
1. **Trust code over docs** — When they conflict, fix the doc
2. **Mark outdated docs** — Don't silently remove; mark as outdated with date
3. **Preserve business rules** — Document why, not just what
4. **Update immediately** — Same session as code changes
5. **Be specific** — File paths, function names, exact behavior

**Never:**
- Delete previous context without recording it
- Leave documentation in a state that contradicts code
- Skip updating docs for "minor" changes (they compound)

## gstack

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool.

- Product ideas/brainstorming → /office-hours
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Full review pipeline → /autoplan
- Bugs/errors → /investigate
- QA/testing site behavior → /qa or /qa-only
- Code review/diff check → /review
- Visual polish → /design-review
- Ship/deploy/PR → /ship or /land-and-deploy
- Security audit → /cso

# AGENTS.md — Rules for AI Agents

Operational rules for any AI agent (Claude Code or otherwise) working in this repo.
Keep it short; this is a contract, not a tutorial.

## First read

`README.md` → `CONTEXT.md` → `CLAUDE.md` → this file →
`docs/handover/current-state.md` → `docs/architecture/overview.md`.
Then inspect the actual code. **Trust code over docs when they conflict, and fix
the doc.**

## Project shape (orientation)

Full-stack platform: React/Vite frontend (`src/`), NestJS/TypeORM backend
(`backend/`), PostgreSQL + Redis/BullMQ. eBay-centric automotive listing tool.
Details in `docs/architecture/`.

## Rules

1. **Scope discipline** — do only the requested task; no drive-by refactors.
2. **Inspect before changing** — don't guess file contents or behavior.
3. **Don't read** `node_modules/`, `dist/`, `uploads/`, `output/`, or
   `docs/inventory-export-*_batches/` unless required.
4. **Auth by default** — backend routes are protected by the global guard stack.
   New routes need `@RequirePermissions('module.action')`; register the permission
   in `backend/src/rbac/permission-registry.ts`. Use `@Public()` only deliberately.
5. **Schema via migrations only** — never enable `DB_SYNCHRONIZE`; generate +
   review migrations. Production runs migrations on boot.
6. **Secrets in env vars only** — never hardcode or commit values; document new
   var *names* in `docs/development/environment-variables.md`.
7. **Validate input** — DTOs use `class-validator`; the global ValidationPipe is
   strict (`forbidNonWhitelisted`).
8. **Risky actions** (migrations affecting data, deploys, force-push, deleting
   branches/files) — confirm with the user first.
9. **Verify** — run `lint`/`build`/`test` where applicable; exercise UI changes in
   a browser.

## Risky areas

`app.module.ts` (guards/config), TypeORM migrations + `data-source.ts`,
`rbac/permission-registry.ts`, `integrations/ebay/` (OAuth), BullMQ processors +
scheduler, and the `@Controller('api/...')` double-prefix controllers.

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

**Agent Entry Point:**
All future agents MUST first read `/docs/AGENT_SYSTEM_MEMORY.md` before any coding task.

## Definition of done

Follow `docs/development/task-completion-checklist.md`.

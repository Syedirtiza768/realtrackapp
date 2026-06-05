# Agent Workflow

How AI agents (and humans) should work in this repo so project memory stays intact.

## Before you start

1. Read, in order: `README.md` → `CONTEXT.md` → `CLAUDE.md` → `AGENTS.md` →
   `/docs/handover/current-state.md` → `/docs/architecture/overview.md`.
2. Inspect the actual code before acting — docs may lag. Trust code over docs when
   they conflict, then **update the doc**.
3. Do not read generated/vendor dirs (`node_modules/`, `dist/`, `uploads/`,
   `output/`, `docs/inventory-export-*_batches/`) unless required.

## While working

- Keep changes scoped to the task. No drive-by refactors.
- Backend: respect the global guard stack — new routes are protected by default;
  use `@Public()` only deliberately, and register new permissions in
  `backend/src/rbac/permission-registry.ts`.
- DTOs use `class-validator`; the global ValidationPipe is strict
  (`forbidNonWhitelisted`).
- Schema changes go through TypeORM migrations (never rely on `synchronize`).
- Secrets stay in env vars — never hardcode or commit values.

## Risky areas (extra care)

- `app.module.ts` guard ordering and global config.
- TypeORM migrations + `data-source.ts` (production runs migrations on boot).
- eBay OAuth/token handling (`integrations/ebay/`).
- BullMQ processors and the scheduler (concurrency, idempotency).
- The `@Controller('api/...')` double-prefix controllers (see api-map).

## Verify before done

Run the relevant checks (`npm run lint`, `npm run build`, `npm run test`) and,
for UI/behavioral changes, exercise the feature in the browser.

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

## Definition of done

Use the [task-completion-checklist](task-completion-checklist.md).

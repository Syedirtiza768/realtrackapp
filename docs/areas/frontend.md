# Frontend

**Last reviewed:** 2026-08-06

React + Vite + TypeScript + Tailwind CSS SPA. Lives at the repo root in `src/`
(this is a two-part app, not a monorepo — see [[../Home|Home]]).

## Stack
- React 18 + React Router 7
- Vite 6 (dev server, proxies `/api` → the NestJS backend)
- Tailwind CSS
- `@tanstack/react-query` for server state
- `@dnd-kit/*` for drag-and-drop (pipeline/queue UIs)
- `exceljs` / `xlsx` for in-browser spreadsheet import/export
- `dompurify` for sanitizing rendered eBay HTML descriptions

## Structure (`src/`)
- `App.tsx` — routes
- `components/` — one folder per feature area: `audit`, `auth`, `automation`,
  `catalog`, `catalog-import`, `channels`, `dashboard`, `filters`, `fitment`,
  `image-drive`, `ingestion`, `inventory`, `layout`, `legal`, `listings`, `motors`,
  `notifications`, `orders`, `pipeline`, `preview`, `pricing`, `published-listings`,
  `settings`, `sku`, `templates`, `ui`
- `contexts/`, `hooks/`, `lib/`, `types/`

## Commands
```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint
npm run preview
```

## Deep dives (pre-existing, more detail than this note)
- [[../frontend/ROUTES_AND_SCREENS|Routes and screens]] (most recently updated of the route docs)
- [[../frontend/COMPONENT_MAP|Component map]]
- [[../frontend/STATE_MANAGEMENT|State management]]
- [[../frontend/UI_UX_GUIDELINES|UI/UX guidelines]]
- [[../FRONTEND_MAP|Legacy FRONTEND_MAP.md]] — older, root-level doc; check dates
  before trusting over `docs/frontend/*`.

## Open questions / TODO
- `docs/FRONTEND_MAP.md` (root) and `docs/frontend/COMPONENT_MAP.md` appear to cover
  overlapping ground written at different times — not reconciled as part of this
  setup pass. Prefer the newer file when they disagree, per each file's mtime.
- No frontend test coverage exists yet (confirmed in
  [[../context/CURRENT_STATE|CURRENT_STATE.md]] under "What Is Planned But Not Built").

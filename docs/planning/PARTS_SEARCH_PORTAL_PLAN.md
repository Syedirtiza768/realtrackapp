# Parts Search Portal — Implementation Plan

**Status:** Phases 1 and 2 implemented 2026-10-26 (branch `feat/parts-search-portal`; PartsBazar360 branch `feat/internal-parts-search`), not yet deployed · **Date:** 2026-10-26
**Owner repo:** Omni Core (`F:\apps\realtrackapp`) · **Upstream:** PartsBazar360 (`F:\apps\PartsBazar360`)

## 1. Goal

A dedicated search portal **inside Omni Core, on its own top-level route** (`/parts-search`),
separate from the `/auto-parts` workspace but sharing the same login. Phase 1 exposes
PartsBazar360's universal search (one box that understands OEM/part numbers in any
separator format, partial numbers, typos, and year/make/model phrases). Later phases add
internal-only fields and Omni Core's own data as further sources.

**Who can use it:** exactly the people who can open the Auto Parts workspace.

## 2. Access model

| Rule | Detail |
|---|---|
| Gate | `dashboard.view` — the same permission that gates `/auto-parts/*` (`src/App.tsx`) and the Auto Parts login (`AuthService.validateAndSign` with `vertical: 'automotive'`). |
| Roles that get in by default | super_admin, admin, manager, staff, catalog_manager, listing_manager, ops_user, viewer, listing_user, supervisor (`READ_ONLY` in `permission-registry.ts`). |
| Roles kept out | fashion_* and business_industrial_* roles (they don't hold `dashboard.view`). |
| Org scoping | Not applied in Phase 1. PartsBazar360 results are marketplace-wide, not Omni Core tenant data, so `AutomotiveAccessScopeService` has nothing to filter. Revisit in Phase 3 when Omni Core inventory joins the results. |

**Why reuse `dashboard.view` instead of a new `parts_search.access` permission:**
`RbacService.doSyncFromRegistry` skips roles with `isCustomized = true`, so a new
permission added to the registry would silently never reach customized roles, and those
users would be locked out of the portal while still having Auto Parts access. Reusing
`dashboard.view` makes "can use Auto Parts ⇔ can use the portal" true by construction.
If the two ever need to diverge, add `parts_search.access` **plus a migration** that grants
it to every role (customized or not) that currently holds `dashboard.view`.

**Single sign-on:** free, because it is the same origin. The JWT lives in `localStorage`
(`AuthContext.tsx`), so a user already signed in to Auto Parts is already signed in to the
portal, and logging out of either logs out of both. Token revocation (`auth:revoked:<jti>`
in Redis) and the 4-hour expiry apply unchanged.

## 3. Routes

### Frontend (React Router, `src/App.tsx`)

| Route | Page | Notes |
|---|---|---|
| `/parts-search/login` | `PartsSearchLoginPage` | Calls `login(email, password, 'automotive')`; redirects back to the requested portal URL. Public. |
| `/parts-search/change-password` | reuse `FashionPasswordPage` | Same pattern as the other workspaces. |
| `/parts-search` | `PartsSearchHomePage` | Large search box, autocomplete, recent searches (per-user `localStorage`). |
| `/parts-search/results` | `PartsSearchResultsPage` | All state in the query string (`q`, filters, `sort`, `page`, `pageSize`) so a search is a shareable link and back/forward work. |
| `/parts-search/parts/:partId` | `PartsSearchPartPage` | Read-only detail from PartsBazar360, plus "Open on partsbazar360.com". |
| `/parts-search/*` | not-found | "Parts search page not found" + link to `/parts-search`. |

All of these except the login route are wrapped in
`<ProtectedRoute permissions={['dashboard.view']} loginPath="/parts-search/login">`, with a
`PartsSearchShell` built on the existing `VerticalWorkspaceShell` (same as `FashionShell`).

`/parts-search` is **not** added to `LegacyAutoPartsRedirect`'s root list. It's a sibling
of `/auto-parts`, `/fashion` and `/business-industrial`, not a child of `/auto-parts`.

**Entry points:** a fourth "Parts Search" tile in `src/components/landing/LandingPage.tsx`
(workspaces list and footer), a "Parts search" item in the Auto Parts sidebar
(`Shell.tsx` `NAV_ITEMS` + `SIDEBAR_MODULE_PERMISSIONS`, gated on `dashboard.view`), and a
"Back to Auto Parts" link in the portal shell.

### Backend (NestJS, global prefix `/api`)

New module `backend/src/parts-search/`, controller `@Controller('parts-search')`.
The URLs below are therefore `/api/parts-search/...`. Do **not** write
`@Controller('api/parts-search')`; that's the `/api/api/...` trap noted in `CLAUDE.md`.

| Endpoint | Upstream PartsBazar360 call | Purpose |
|---|---|---|
| `GET /api/parts-search/query` | `GET /api/v1/search` | Results, facets, interpretation, corrections, pagination. |
| `GET /api/parts-search/suggest?q=` | `GET /api/search/suggest` | Typeahead (parts, categories, brands, makes). |
| `GET /api/parts-search/parts/:id` | `GET /api/search/parts/:id` | Part detail. |
| `GET /api/parts-search/health` | `GET /api/v1/search?q=` (cheap probe) | Upstream reachable, index name, `degraded` flag. |

Every handler: `@RequirePermissions('dashboard.view')`, `@ApiTags('parts-search')`.

## 4. Backend design

Files:

```
backend/src/parts-search/
  parts-search.module.ts
  parts-search.controller.ts
  parts-search.service.ts         # caching, error mapping, logging
  parts-search.client.ts          # HTTP to PartsBazar360 (read-only)
  dto/parts-search-query.dto.ts   # allow-list mirroring PartsBazar360's SearchQueryDto
  parts-search.types.ts           # response types (results, facets, suggest, part)
  *.spec.ts
```

- **Client:** separate from the existing push client (`channels/partsbazar360/partsbazar360.client.ts`).
  It reads the same `PARTSBAZAR360_API_URL` (default `https://partsbazar360.com/api`) but needs
  no API key in Phase 1, because these are public endpoints. Timeout `PARTS_SEARCH_TIMEOUT_MS`
  (default 5000). No retries for suggest (the user is typing), one retry on 502/503/504 for query/detail.
- **Validation:** mirror PartsBazar360's bounds so bad input is rejected locally, not
  forwarded. `q` ≤ 200 chars, `page` 1–400, `pageSize` ∈ {24, 48, 72}, `sort` ∈
  {relevance, price_asc, price_desc, newest, best_condition}, list filters ≤ 25 items each
  (`category`, `brand`, `make`, `model`, `partType`, `condition`), `year` 1950–2049,
  `priceMin/priceMax`, `hasImage`, `inStock`, `includeInterchange`. Unknown params are dropped.
  Never forward `seller`/`sourceTag` in Phase 1 (upstream blanks them anyway).
- **Caching:** Redis, key = sorted normalized params, TTL 30 s for query/suggest and 120 s
  for part detail. Best-effort: Redis down means no cache, not an error.
- **Rate limiting:** `@Throttle` per user: suggest 20/s burst, query 5/s, detail 10/s.
  This protects PartsBazar360 from one Omni Core server IP fanning out every keystroke.
- **Errors:** upstream timeout or 5xx → `503 { degraded: true, message: 'PartsBazar360 search is unavailable' }`;
  upstream 400 → 400 with the upstream message; 404 on detail → 404.
- **Logging:** one structured log line per query (user id, q, filter keys, total, tookMs,
  upstream status). No DB table in Phase 1, so **no migration**.
- **Wiring:** import `PartsSearchModule` in `app.module.ts`. Add the import only; don't
  touch guard order, DB, Redis or queue config (risky area).

## 5. Frontend design

```
src/components/parts-search/
  PartsSearchShell.tsx
  PartsSearchLoginPage.tsx
  PartsSearchHomePage.tsx
  PartsSearchResultsPage.tsx
  PartsSearchPartPage.tsx
  SearchBox.tsx                # input + suggestion dropdown, keyboard nav
  ResultCard.tsx
  FacetSidebar.tsx
  partsSearchApi.ts            # typed calls to /api/parts-search/*
  usePartsSearchSuggest.ts     # 200 ms debounce, AbortController, min 2 chars, 60 s memo
```

Behaviour carried over from PartsBazar360's buyer search (`useSearchSuggestions.ts`, `/search` page):

- **Typeahead:** groups for parts (image, title, MPN, price), categories, brands and makes.
  Arrow keys and Enter, Esc closes, `/` focuses the box from anywhere in the portal.
- **Interpretation chip:** shows what the engine understood, e.g. "Part number 8640112020 · Toyota".
- **Corrections banner:** for example "No exact matches for X — showing related parts". Never
  present relaxed results as exact matches.
- **Match reason badge** from `matchedVia`: "OEM number", "Interchange", "Superseded".
- **Facets:** make, model, year, category, brand, part type, condition, price, has image, in stock.
- **Pagination:** when `totalRelation === 'gte'`, show "10,000+", not a fake exact count.
- **Result card:** image, title, brand, MPN, condition, lowest price + currency, buttons
  to copy the part number and to open on partsbazar360.com (new tab).
- **States:** empty, loading skeleton, upstream degraded (banner with retry), no results.
- Use React Query (already provided by `QueryProvider`) for caching and cancellation.

## 6. Phases

| Phase | Scope | Touches PartsBazar360? |
|---|---|---|
| **1 — Portal + public universal search** | Everything in §3–§5. Read-only, buyer-visible catalog only. | No |
| **2 — Internal view** | Show seller/source store, all offers (incl. inactive), and seller/source facets. Needs a new PartsBazar360 endpoint, e.g. `GET /api/integrations/realtrack/search`, guarded by a server key like `RealtrackPushGuard` (a new read-only `PARTSBAZAR360_SEARCH_KEY`). It reuses `SearchV1Service` but skips `sanitizeSearchItems` and keeps the seller/sourceTag facets. Consider an extra Omni Core permission for supplier identity. | Yes |
| **3 — Federated search** | Add Omni Core sources (catalog, inventory, warehouse stock, published listings) as tabs or merged results. Add a "we already stock this" cross-reference by normalized MPN, and actions such as "create listing from this part". This is where `AutomotiveAccessScopeService` org scoping comes in. | No |

## 7. Tests and verification

- **Backend unit:** DTO allow-list and bounds; client error mapping (timeout, 5xx, 404);
  cache key stability; permission gate (viewer → 200, fashion_operator → 403, anonymous → 401).
- **Frontend:** `npm run build` type-check; in the browser preview, log in at
  `/parts-search/login`, then run these probes and confirm the top result:
  `86401-12020`, `86401`, `A 221 820 02 64`, `altrenator`, `Audi bumper`,
  `2019 toyota corolla lane camera`.
- **Access:** an Auto Parts user lands in the portal without re-login. A Fashion-only user
  is refused at `/parts-search/login` and redirected from `/parts-search`.

## 8. Documentation to update in the same change (per `CLAUDE.md`)

`docs/architecture/api-map.md`, `docs/API_MAP.md`, `docs/FRONTEND_MAP.md`, `src/App.tsx`
route comments, `docs/product/features.md`, `docs/CODEMAP.md`, `docs/BACKEND_MAP.md`,
`docs/architecture/auth-rbac.md` + `docs/RBAC_AND_SECURITY.md` (document that the portal
reuses `dashboard.view`), `docs/architecture/integrations.md`, `.env.example` /
`backend/.env.example` (`PARTS_SEARCH_TIMEOUT_MS`), `docs/decisions.md` (entry for the
"reuse `dashboard.view`" and "server-side proxy" decisions), `CHANGELOG.md`.

## 9. Risks

- **The engine isn't used by PartsBazar360's own buyers yet.** `/api/v1/search` is live on
  the `parts_search` index, but buyers still use the older `/search/parts`. We'd be its first
  heavy consumer, so watch for facet/count gaps.
- **Suggestions and results come from different engines.** `/search/suggest` reads the
  older index, so a suggestion can occasionally disagree with the full results. Fix
  upstream later with a v1 suggest endpoint.
- **Shared IP.** All portal traffic leaves from the Omni Core server. Throttling and
  caching (§4) keep it polite; confirm PartsBazar360's nginx has no per-IP limit that
  would trip.
- **Working tree.** The current branch `codex/auto-parts-image-save` has a large set of
  unrelated uncommitted changes, so implement on a fresh branch from `main`.

## 10. As built (differences from this plan)

- Phase 2 shipped with Phase 1. PartsBazar360's internal endpoint is `GET /api/integrations/realtrack/search` (+ `/parts/:id`, `/health`), guarded by `REALTRACK_SEARCH_API_KEY`. It runs the same v1 query, then replaces the index's offer projection with every `SellerOffer` row from Postgres (any status), flagged `buyerVisible` / `outrankedBySuperior`, with per-warehouse stock; part detail adds `SourceRecord`s (no raw payloads).
- Omni Core env var is `PARTSBAZAR360_SEARCH_API_KEY`. Internal 401/403/404/503 falls back to public search with `meta.internalUnavailableReason`.
- Page sizes offered: 24/48/72. Recent searches are per browser (`localStorage`).
- Not in the landing page's marketing "industries" list (it is not a vertical); linked from the Auto Parts sidebar instead.

## 11. Open decisions

1. Phase 1 public data only, or go straight to the internal view (Phase 2, needs a
   PartsBazar360 deploy)?
2. Route name: `/parts-search` (proposed) or something else, e.g. `/search`?
3. Should the Auto Parts sidebar link to the portal, or should it be reachable only from
   the landing page?

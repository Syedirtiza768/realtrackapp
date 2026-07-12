# API integration users

Read-only (or otherwise scoped) service accounts for external integrations, monitoring, or
BI tools that need programmatic access to a narrow slice of the API — without the broad
default permissions a normal `staff`/`viewer` account carries.

There is no separate API-key mechanism; these are regular `users` rows authenticated via
`POST /api/auth/login` like any other account, but assigned a **custom RBAC role** with only
the permissions the integration needs.

## Published Listings Reader

Read-only access to the live eBay listing mirror (`ebay_published_listings`, synced from
eBay by `PublishedListingsSyncService`). Nothing else.

| | |
|---|---|
| Base URL | `https://mhn.realtrackapp.com/api` |
| Email | `api-published-listings@realtrack.local` |
| Password | `Ebay$321` |
| Role | `api_published_listings_reader` (custom, non-system) |
| Permissions | `published_listings.view` only — confirmed via `GET /api/auth/me` |
| Store scope | `storeAccessAll = true` — all 11 connected stores (list below) |
| Workspace | Member of the primary RealTrack organization (`3ed54be6-7138-4264-bd8b-73dfa9336245`) |

Rotate this password with `PATCH /api/rbac/users/:id/reset-password` (requires
`users.reset_password`) if it's ever shared beyond its intended integration, and update this
doc.

## Getting an auth token

Same login flow as any user — POST credentials, get back a bearer JWT (24h expiry per
`JWT_EXPIRY_SECONDS`).

```bash
curl -s -X POST https://mhn.realtrackapp.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"api-published-listings@realtrack.local","password":"Ebay$321"}'
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "2697aa94-2061-4cbd-a414-6b2bd4d63e6e",
    "email": "api-published-listings@realtrack.local",
    "name": "API - Published Listings Reader",
    "role": "viewer"
  }
}
```

> The `role` field on the login response is a legacy display value and reads `viewer` — the
> **actual enforced permission set** comes from the RBAC role assignment, not this field. Confirm
> the real scope with `GET /api/auth/me`:

```bash
curl -s https://mhn.realtrackapp.com/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "user": {
    "id": "2697aa94-2061-4cbd-a414-6b2bd4d63e6e",
    "email": "api-published-listings@realtrack.local",
    "roleSlug": "api_published_listings_reader",
    "roleName": "API - Published Listings Reader",
    "permissions": ["published_listings.view"]
  },
  "organizations": [
    { "organizationId": "3ed54be6-7138-4264-bd8b-73dfa9336245", "name": "Super Admin", "role": "viewer" }
  ]
}
```

Every request below carries `-H "Authorization: Bearer $TOKEN"`.

## Connected stores (storeId values)

From `GET /api/stores` / the `stores` table, at time of writing:

| storeId | Store name |
|---|---|
| `79f249a5-31e0-42a8-978c-a99b0665c61b` | All About Mercedes |
| `fa528c8a-f249-4816-94f6-f2ce8b932449` | B.JLRWORLD |
| `d16199c4-55b5-429e-ad27-892bed94e00d` | BLACKLINEAUTOPARTS |
| `5fc75f19-31f3-44e4-b1ae-6545055f7945` | K. Brit Auto Depot - UK |
| `65aff8ec-21ee-460f-af17-20daa0b843c1` | K. Euro Japan Auto Parts |
| `eed3dbd6-9967-43ac-ad4e-6d5081cfb9b0` | K. Salvage Auto Parts |
| `cc658cc0-ab21-4519-9f06-4aea8ff6a809` | K. Salvage Dismantlers - DE |
| `7658e52e-4dd6-48a7-ad78-6933630bdac7` | K. Southern Cross Auto Parts - AU |
| `cfcc4a9c-c41b-4166-ab41-989c00a6fad1` | Primemotive |
| `8d7d8b23-d769-4ed5-91e2-e26d14a45215` | VW & RR |
| `70ad5c44-6424-4998-815c-99adf28c2487` | eBay store |

This account cannot call `GET /api/stores` itself (needs `stores.view`, which it doesn't
have) — the table above is provided here as reference since it can't discover store IDs on
its own. Use `storeId` from this table with the endpoints below.

## Endpoints

All three support the same filters/pagination — `page` (default 1), `limit` (default 50, max
200), plus `storeId`, `offerId`, `ebayAccountId`, `marketplaceId`, `status`, `search`, etc.
(full filter list in `PublishedListingsQueryDto`).

### 1. List published listings, paginated

```
GET /api/published-listings?page={page}&limit={limit}
```

```bash
curl -s "https://mhn.realtrackapp.com/api/published-listings?page=1&limit=3" \
  -H "Authorization: Bearer $TOKEN"
```

Verified response (production, live data — 314,076 published listings total):

```json
{
  "items": [
    {
      "id": "f88fe2d2-38dd-4fd2-8624-771e48214cbc",
      "organizationId": "3ed54be6-7138-4264-bd8b-73dfa9336245",
      "storeId": "fa528c8a-f249-4816-94f6-f2ce8b932449",
      "marketplaceId": "EBAY_MOTORS_US",
      "ebayItemId": "287416311728",
      "offerId": null,
      "sku": "KIA-1278-DGray-s-Engine-242",
      "title": "2026 Kia Carnival Auto Trans Differentialträger Lagerscheibe 458493B628",
      "price": "83.38",
      "currency": "EUR",
      "quantityAvailable": 1,
      "listingStatus": "active",
      "listingUrl": "https://www.ebay.de/itm/...-/287416311728",
      "imageUrls": ["https://images.gridxconnect.io/gxc/..."],
      "healthFlags": [{ "code": "weak_images", "severity": "warning", "message": "Fewer than 3 images — add more for better conversion" }]
    }
  ],
  "total": 314076,
  "page": 1,
  "limit": 3
}
```

`page=2&limit=3` returns the next 3 distinct rows (verified — no overlap with page 1).

### 2. Filter by storeId, paginated

```
GET /api/published-listings?storeId={storeId}&page={page}&limit={limit}
```

```bash
curl -s "https://mhn.realtrackapp.com/api/published-listings?storeId=eed3dbd6-9967-43ac-ad4e-6d5081cfb9b0&page=1&limit=3" \
  -H "Authorization: Bearer $TOKEN"
```

Verified: every returned item's `storeId` matches the filter (K. Salvage Auto Parts,
71,512 listings on that store):

```json
{
  "items": [
    { "id": "...", "storeId": "eed3dbd6-9967-43ac-ad4e-6d5081cfb9b0", "title": "..." },
    { "...": "2 more, same storeId" }
  ],
  "total": 71512,
  "page": 1,
  "limit": 3
}
```

There's also a store-first route with the same filtering/pagination, scoped by path segment
instead of query param:

```
GET /api/stores/{storeId}/listings/published?page={page}&limit={limit}
```

Identical result shape and totals — verified against the same store above (`total: 71512`).
It additionally 404s if you request `GET /api/stores/{storeId}/listings/published/{id}` for
an `id` that belongs to a *different* store, as a safety check.

### 3. Filter by offerId, paginated

```
GET /api/published-listings?offerId={offerId}&page={page}&limit={limit}
```

`offerId` is the eBay Inventory API offer identifier (present on listings synced via the
Inventory API path; legacy Trading-API-synced listings have `offerId: null` and can only be
found by `sku`, `ebayItemId`, or `search`).

```bash
curl -s "https://mhn.realtrackapp.com/api/published-listings?offerId=113819855011&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

Verified — exact match, `total: 1`:

```json
{
  "items": [
    {
      "id": "a0b57da6-fee7-4ad4-bf0e-20ae5e74ccf4",
      "offerId": "113819855011",
      "storeId": "8d7d8b23-d769-4ed5-91e2-e26d14a45215",
      "title": "2015 Jeep Cherokee Junction Block Cover Gebraucht OEM 68202821AA"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 5
}
```

`offerId` support was added in this session (`backend/src/published-listings/dto/published-listings.dto.ts`,
`services/published-listings.service.ts`) — it didn't exist before; `storeId` filtering was
added in an earlier session. Both are deployed and live as of this writing.

## What it cannot do (verified)

| Call | Result |
|---|---|
| `GET /api/listings` | `403 {"message":"Insufficient permissions"}` |
| `GET /api/dashboard/summary` | `403 {"message":"Insufficient permissions"}` |
| `PATCH /api/published-listings/:id` (revise price/etc.) | `403 {"message":"Insufficient permissions"}` |
| No `Authorization` header | `401 {"message":"Unauthorized"}` |

## How it was created

The admin API only lets you assign the 10 built-in system role slugs to a user
(`POST /api/rbac/users`, `PATCH /api/rbac/users/:id/role` both validate `roleSlug` against
`ROLE_SLUG_VALUES`). Custom roles can be created and given permissions through the API, but
attaching one to a user currently requires a direct `user_roles` update — there's no admin
endpoint for it. Steps used:

1. `POST /api/rbac/roles` — create the custom role `api_published_listings_reader`
   (`roles.create`).
2. `POST /api/rbac/roles/:id/permissions` — set its permission list to just
   `["published_listings.view"]` (`roles.assign_permissions`).
3. `POST /api/rbac/users` — create the user with a placeholder system `roleSlug` (e.g.
   `viewer`), since the DTO requires one.
4. Reassign it directly in the DB: `UPDATE user_roles SET "roleId" = '<custom role id>'
   WHERE "userId" = '<user id>'`. There must be exactly **one** row in `user_roles` for the
   user — `RbacService.getPermissionKeysForUser` unions permissions across *all* of a user's
   role assignments, not just the primary one, so a leftover placeholder-role row would leak
   extra permissions back in.
5. `POST /api/store-access/access-all/:userId {"enabled": true}` (`stores.access_all_manage`)
   — grants store-scoped read access across all connected stores.
6. New users get auto-provisioned into their own solo organization on first
   `resolveOrganizationId` call unless already a member of one — move the
   `organization_members` row to the real shared workspace (and drop the empty
   auto-created org) so the account resolves the right org by default instead of
   returning empty results or a "not a member" error.
7. Password/hash updates were applied directly via SQL (`UPDATE users SET "passwordHash" =
   '<bcrypt hash>'`) rather than the reset-password endpoint in one instance — see gotcha
   below.

### Gotchas hit while setting this up

- **Shell-quoting `$` in bcrypt hashes / passwords over nested SSH+bash.** A bcrypt hash looks
  like `$2b$12$...` — inside a double-quoted string in bash, `$2b`, `$12` etc. are parsed as
  (empty, unset) variable references and silently stripped, corrupting the hash. Same risk for
  a password containing `$` (like this account's `Ebay$321`) passed through more than one shell
  layer. Fix: never inline secrets containing `$` in a double-quoted shell string — write them
  to a file (SQL script, JSON body) and execute/pipe that instead of interpolating inline.
- **A stale local dev stack can silently intercept `localhost:<port>` tunnels.** While setting
  this up, a full local Docker Compose stack for this same app (from an earlier, unrelated
  local-testing attempt) was running in the background on this workstation, bound to the same
  ports (`4191`, `5432`, etc.) used for an SSH port-forward to the real production host. Every
  request "worked" and returned self-consistent-looking data — because it was hitting a
  completely separate local database with its own seeded users, not production — which looked
  exactly like data corruption/caching bugs until traced down. Lesson: when tunneling to a
  remote host for testing, either use a non-default local port, or verify you're talking to the
  right target by running the request through `ssh ... "curl http://<container-ip>:<port>/..."`
  (executed remotely) rather than trusting a local port-forward blindly, especially after any
  local Docker activity earlier in the session.

### Known gap

There's no first-class "attach a custom role to a user" or "create API-only account" admin
endpoint — step 4 above needs direct DB access. If more of these accounts get created, worth
adding `PATCH /api/rbac/users/:id/role` support for custom role slugs (drop the
`@IsIn(ROLE_SLUG_VALUES)` restriction and validate against the `roles` table instead).

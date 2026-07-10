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
| Email | `api-published-listings@realtrack.local` |
| Role | `api_published_listings_reader` (custom, non-system) |
| Permissions | `published_listings.view` only |
| Store scope | `storeAccessAll = true` — all connected stores |
| Workspace | Member of the primary RealTrack organization (`3ed54be6-7138-4264-bd8b-73dfa9336245`), `viewer` org role |
| Password | Rotated secret — not stored in this repo. Ask an admin for the current value or reset it via `PATCH /api/rbac/users/:id/reset-password` (`users.reset_password`). |

### What it can call

- `GET /api/published-listings` (+ `/summary`, `/sync-logs`, `/:id`, `/:id/revisions`)
- `GET /api/stores/:storeId/listings/published` (+ `/:id`)

### What it cannot do

Everything else 403s — no `listings.*`, `dashboard.*`, `ebay.*`, `stores.manage`, sync/bulk/
revise actions on published listings, user/role administration, etc. Verified permission
set for the account is exactly `["published_listings.view"]` (`GET /api/auth/me`).

### How it was created

The admin API only lets you assign the 10 built-in system role slugs to a user
(`POST /api/rbac/users`, `PATCH /api/rbac/users/:id/role` both validate `roleSlug` against
`ROLE_SLUG_VALUES`). Custom roles can be created and given permissions through the API, but
attaching one to a user currently requires a direct `user_roles` update — there's no admin
endpoint for it. Steps used:

1. `POST /api/rbac/roles` — create the custom role (`roles.create`).
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

### Known gap

There's no first-class "attach a custom role to a user" or "create API-only account" admin
endpoint — step 4 above needs direct DB access. If more of these accounts get created,
worth adding `PATCH /api/rbac/users/:id/role` support for custom role slugs (drop the
`@IsIn(ROLE_SLUG_VALUES)` restriction and validate against the `roles` table instead).

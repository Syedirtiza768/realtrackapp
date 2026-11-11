# MotoArk release record — deployed 2026-11-03

**State:** Deployed and production-verified on 2026-11-03 UTC. The user approved
the backend rollout, two database migrations, and a separate lifecycle signing
key on 2026-11-02. Marketplace stock pushing remains off. The confirmed opening
stock policy is to use verified warehouse counts and keep unmapped sales
pending. No production opening balances were written.

## Rollout and backup

- Candidate image: `realtrackapp-backend:motoark-lifecycle-20261102-candidate`
- Candidate image ID: `sha256:5d6010dad284aa051195b4b59a7e692e481fe4596caa074c9be4143fa6bc6bb9`
- Previous image retained for rollback: `realtrackapp-backend:ebay-revise-00aad7cd`
- Previous image ID: `sha256:96f8b62edbe9e899674a4b5d901d3d0cca68684e7b95c1816b950b57ded75161`
- Completed at: `2026-11-03T01:19:59Z`
- Pre-migration archive: `/home/ubuntu/backups/motoark-pre-migrate-20261102T105643Z.dump`
- Archive size: `1,205,635,111` bytes; mode `0600`
- Full `pg_restore --file=/dev/null` validation passed; SHA-256:
  `fb6663c5fa0f4c822adb80b94b7b1a5b5f344770ef2a974b2ab339c4696ec82e`
- Release metadata is in
  `/home/ubuntu/realtrackapp-motoark-lifecycle-20261102/deployment-public.json`.

The first SSH session was interrupted on 2026-11-02 while the backup was
running. On 2026-11-03 the completed archive was fully validated before any
migration. An initial Compose preflight also detected that a saved password
value containing literal dollar signs did not match Compose's escaped display;
the check stopped before service changes. An isolated Compose probe confirmed
the container receives the original value, and the rollout then passed the
full byte-preservation check.

The existing 42-file Compose chain and live backend environment were preserved.
Only the backend container was recreated. The production-only PartsSearch module
was retained in the candidate. Frontend, PostgreSQL, Redis, and PgBouncer
container IDs stayed unchanged. The existing `PRIMEMOTIVE_SALES_WEBHOOK_SECRET`
was preserved; the distinct `MOTOARK_ORDER_WEBHOOK_SECRET` is configured in
protected server configuration. No secret value is recorded here or in logs.

## Database changes

Both reviewed migrations applied successfully during backend startup:

1. `1791500000000-MotoarkOrderLifecycle`: receipt/event inbox, order/line,
   return, and refund records; quantity constraints; and four permissions.
   The external reader role receives notify/view only.
2. `1791600000000-PrimemotiveOrderedChanges`: bigint listing revisions,
   committed/promoted change sequence and indexes, and eligibility-aware
   listing triggers. The previous capture function remains available for
   rollback.

The migrations are additive. No opening stock was initialized and no eBay
quantity or marketplace stock policy was changed.

## Production verification

- Backend candidate is healthy. Local and public `/api/health` checks returned
  HTTP 200. Unauthenticated MotoArk status and legacy sales routes returned
  HTTP 401.
- Existing external-reader access was used without granting new permissions.
  Its effective access includes `motoark.orders.notify` and
  `motoark.orders.view`; it has no physical return receive/restock authority.
- Primemotive snapshot and committed change-feed requests returned HTTP 200,
  including a listing revision and stable cursors.
- Quantity lookup for a marked synthetic, unmapped listing returned HTTP 200,
  `mapped: false`, and `quantityAvailable: null`.
- A correctly signed lifecycle event against that synthetic listing returned
  HTTP 202 and was safely rejected as synthetic. Identical retry deduplicated;
  changed payload returned 409, invalid HMAC returned 401, strict DTO
  validation returned 400, and status lookup returned 200. The check created
  zero orders and zero stock movements.
- The legacy signed sale receipt accepted a fixture-only event and deduplicated
  its retry. Verification used no real order or inventory.
- A bounded 200-row active Primemotive sample still has 0 mapped inventory
  items. Therefore no production purchase can create stock from eBay mirror
  quantities. Unmapped/short events remain pending until verified warehouse
  stock and mappings exist.
- `stock_channel_push` remains disabled. Outbound listing callbacks remain
  inactive until their URL, separate signing key, and explicit organization
  scope are configured.

See [the consumer contract](../architecture/MOTOARK_ORDER_LIFECYCLE.md) for
event payloads, status semantics, permissions, stock limits, and checkout or
sourcing assumptions. Use a secure secret-sharing channel to provision the
configured lifecycle key to MotoArk; do not send either signing key in this
document or an ordinary chat message.

## Rollback

The previous backend image and exact Compose chain are retained. If necessary,
restore that image through the preserved Compose chain. Keep the new additive
tables and inbox during rollback; do not automatically run migration `down`,
which removes lifecycle data and requires separate approval.

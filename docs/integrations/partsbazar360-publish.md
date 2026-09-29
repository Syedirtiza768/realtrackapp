# Publishing listings to PartsBazar360 (push)

**Last reviewed:** 2026-09-29

RealTrack can publish listings **directly into partsbazar360.com** as a channel
(`partsbazar360`), next to eBay. This is the reverse of the existing
[trading-enrichment contract](partsbazar360-trading-enrichment.md), where
PartsBazar360 *pulls* our published eBay listings. Both paths coexist; a pushed
listing never depends on the pull sync and the pull sync never removes it.

Receiver side (in the `F:\apps\PartsBazar360` repo): `apps/api/src/modules/realtrack-publish/`
and `IngestionProcessor.processPushedListing`. See that repo's `docs/apps/api.md`.

## Flow

```
Catalog "Publish to PartsBazar360" / POST /api/channels/publish-multi
   → channels queue 'publish' job
   → PartsBazar360Service.publish()
        map listing_records + catalog_products → payload   (partsbazar360-listing.mapper.ts)
        POST {PARTSBAZAR360_API_URL}/integrations/realtrack/listings   (bearer key)
   ← 202 queued
   → poll GET …/listings/:storeId/:listingId  (≈15 s)  → imported | rejected | failed
   → still queued? delayed job 'partsbazar-status-check' (30 s × attempt, 6 tries) → error if never confirmed
```

The receiver queues the import onto its own `ingestion` BullMQ queue, so the push
returns fast and the real answer arrives via the status endpoint. The
`listing_channel_instances` row (`channel = 'partsbazar360'`) mirrors that state:
`publishing` → `synced` (externalId = PartsBazar offer id, externalUrl = storefront
part URL once its SEO slug exists) or `error` (with a readable `lastError`).

## Setup

1. On partsbazar360.com set `REALTRACK_PUSH_API_KEY` (compose `api` service). Unset ⇒
   the endpoint answers **503**, it is never open.
2. On RealTrack set `PARTSBAZAR360_API_KEY` to the same value (and `PARTSBAZAR360_API_URL`
   if not `https://partsbazar360.com/api`). See
   [environment-variables](../development/environment-variables.md).
3. **Settings → Channels → PartsBazar360**: enter a label and the seller's **store ID on
   PartsBazar360** (`Seller.storeId` there — for onboarded eBay sellers that is the RealTrack
   store id, e.g. Blackline `d16199c4-55b5-429e-ad27-892bed94e00d`). "Link seller" calls
   `/health?storeId=` first, so a wrong key or unmapped seller fails here, not at first publish.
4. Publish from a listing's detail panel (Channels → PartsBazar360 → Publish) or, for a
   selection, catalog bulk bar → **More → Publish to PartsBazar360**.

One RealTrack `stores` row (channel `partsbazar360`, `externalStoreId` = the seller's
store id) exists per PartsBazar seller. With several linked, pass `storeId` to
`publish-multi` / `bulk-publish` (the UI shows a picker); without it the latest active
connection wins.

## Payload (`PartsBazarPushItem`)

`sourceListingId` = `listing_records.id` (idempotency key — a repeat updates the same offer).
`listing` mirrors the published-listings shape so the receiver reuses its pull pipeline:
`title, sku, price (string, USD seller price), currency, quantityAvailable, listingStatus,
marketplaceId, condition, categoryName, brand, mpn, oeNumbers[], description, imageUrls[],
itemSpecifics, compatibility{compatibleProducts[]}, ebayItemId, listingUrl`. `hints`
carries `qualityTier` / `partSource` / `partType` so a NEW aftermarket part is not stored
as used salvage OEM (the receiver's default).

Mapping rules (`partsbazar360-listing.mapper.ts`, pure and unit-tested):

- **Refused up front** (no push, `UnrecoverableError`, message on the instance): no title,
  price ≤ 0, no usable image.
- **Photos** (`PartsBazar360Service.publicImageUrls`): everything PartsBazar360 shows is a WebP object in
  RealTrack's S3 bucket, exposed through RealTrack's public `{PARTSBAZAR360_IMAGE_BASE_URL or
  FRONTEND_BASE_URL}/api/storage/serve/<key>` route (the bucket is private; the route is public and
  nginx-cached, `immutable`). Per photo: a first-party URL resolves to its existing `.webp` sibling, or a
  WebP copy is made from a JPG/PNG-only original; an **external** URL (NAPA, eBay …) is downloaded, resized
  to ≤1600 px, converted to WebP and stored at `catalog-images/partsbazar360/<hash-of-source-url>.webp`
  (re-publishing reuses it). NAPA Canada's CDN refuses server-side fetches, so `media.napacanada.com` is
  read from `media.napaonline.com` (same image ids); eBay thumbnails are upgraded to `s-l1600`. Sources
  that cannot be fetched, are not images or are smaller than 100 px are dropped, as are `temp/` keys.
  Disable mirroring with `PARTSBAZAR360_MIRROR_IMAGES=false` (external URLs then pass through).
- **No photo, no listing**: if a listing has photos but none survive, or has none, the publish is refused
  and — if the listing is already live on PartsBazar360 — it is taken off sale (`client.end`), with that
  stated in the instance's `lastError`.
- **Fitment**: only rows validated against the MVL (same `selectPublishFitmentSource` rule as
  eBay publish). Nothing validated ⇒ `compatibility: null`; the receiver then falls back to
  its own title inference (lower evidence level). Fitment is never guessed here.
- **OE numbers** are sent as separate values; a comma-joined string would be stored as one
  bogus OE number.
- **Size**: receiver body limit is 100 kB, so the payload is trimmed (description to 8k chars,
  then fitment rows halved) to ≤ 90 kB with a warning stored on the instance.
- `listingStatus` is `ended` for `sold`/`delisted`/`archived` listings.

## What the receiver may still decline

It applies the same gates as its pull sync: USD only, marketplace `EBAY_MOTORS_US`, English
title, in stock, active, no eBay Mag images, excluded brands. A decline shows on the
instance as e.g. *"PartsBazar360 declined the listing: the title is not in English"*.
Price is **seller price** — the marketplace runs its own pricing policy on top, so the
storefront price will differ from `startPrice`.

## Operations

- End: `POST /api/channels/listings/:id/channel/partsbazar360/end` calls the receiver (takes the
  offer off sale); it is not just a local flag as it is for other channels.
- Update: same publish path (upsert). Inventory/price changes reach PartsBazar360 only by
  re-publishing — the bulk inventory sync is deliberately a no-op for this channel (its
  placeholder quantity of 1 would overwrite real stock).
- Manual re-check: `POST /api/channels/partsbazar360/listings/:id/refresh`.
- Smoke test (needs the key): `GET {PARTSBAZAR360_API_URL}/integrations/realtrack/listings/health?storeId=<id>`
  with `Authorization: Bearer <key>` → `{ ok: true, seller: { … } }`.
- Retries: 429/502/503/504 and network errors retry with backoff (`Retry-After` honored);
  401/403/404/validation failures do not.

## Known gaps

- No push of stock/price changes without a re-publish; no per-listing "sync on edit".
- Two publishes of the *same* listing racing each other can create two catalog parts on the
  receiver; the queue serialises normally, so this needs a double-click at the wrong moment.
- The receiver's storefront slug is assigned asynchronously, so `externalUrl` can be empty
  right after import; use **Check** on the listing tile to refresh.
- Verified live on 2026-09-29 with one production listing (Blackline BLA-18425): imported, 24 photos
  served, 8 fitment rows CONFIRMED, searchable in the buyer app, and a re-publish updated the same offer
  (no duplicate). Not load-tested; publish a small batch before a bulk run.
- Listings whose photos are only in `temp/` and no longer exist (e.g. BLA-18179) cannot be published
  anywhere until re-photographed; the channel reports it rather than pushing broken images.
- The receiver derives OE numbers from the title as well, so a title ending "OEM Used" yields a stray
  "USED" OE entry. This predates the push path (the pull sync does the same).

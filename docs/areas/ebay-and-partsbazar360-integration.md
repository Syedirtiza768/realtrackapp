# eBay integration & the PartsBazar360 relationship

**Last reviewed:** 2026-08-06

## eBay
RealTrackApp's core purpose is eBay automotive-parts listing management: multi-store
OAuth, catalog import, AI enrichment, MVL (motor vehicle listing / fitment)
compatibility, publish/revise pipelines. Code lives mainly under
`backend/src/channels/ebay/`, `backend/src/integrations/`, and
`backend/src/fitment/`.

Confirmed non-obvious behaviors (see [[../decisions|decisions.md]] for the full
entries):
- `EbayMvlService` is injected optionally into `EbayPublishService` to break a
  circular dependency between the `channels` and `fitment` modules.
- Publish failures with eBay errorId `25005` (invalid category) trigger a
  purge-and-recreate-offer retry, not just a plain retry.
- Item-specific values are sanitized to eBay's 65-character aspect limit before
  publish.
- Inventory location defaults to Dubai / `AE_Dubai`, not Houston / `US_77001`; see
  [[../context/CURRENT_STATE|CURRENT_STATE.md]] (reason for the Dubai default
  itself isn't documented anywhere found in this repo — TODO below).

## Relationship to PartsBazar360
**This is a real, verified cross-repo integration**, not a guess: RealTrackApp is
the "RealTrack API" that the sibling repo `F:\apps\PartsBazar360` references in its
own `docs/REALTRACK_API_REQUIREMENTS.md` (external data source requirements from
PartsBazar360's side).

From this repo's side, the contract is documented in
[[../integrations/partsbazar360-trading-enrichment|partsbazar360-trading-enrichment.md]]:

- RealTrackApp exposes `GET /api/published-listings/:id/trading-enrichment` —
  returns full eBay Trading API data (all gallery images, 130+ row vehicle
  compatibility list, styled HTML description, item specifics/MPN/OE-OEM numbers)
  for a given published listing.
- Cached 7 days in a `raw_ebay_response.tradingEnrichment` JSONB column; rate
  budget ~4,500 Trading API calls/day across all listings.
- A batch pre-enrichment endpoint (`POST
  /api/published-listings/trading-enrichment/batch`) lets PartsBazar360 warm the
  cache so listing pages load instantly.
- PartsBazar360 is expected to call the base `/api/published-listings/:id`
  endpoint first (fast, ~50ms), render immediately, then fire the
  trading-enrichment call in parallel and merge results in — never block page
  render on enrichment.
- Auth: a shared service account (`api-published-listings@realtrack.local`,
  `published_listings.view` permission) — no separate credentials needed.

Real production incidents from this integration are already logged:
[[../context/CURRENT_STATE|CURRENT_STATE.md]] documents a 2026-07-23 watermark bug
where PartsBazar360's reader endpoints returned `total: 0` against non-empty
mirror tables because a shared `lastSuccessfulSyncAt` field was being stamped by
the wrong writer (see [[../decisions|decisions.md]]).

## Deep dives (pre-existing, more detail than this note)
- [[../integrations/partsbazar360-trading-enrichment|Full trading-enrichment integration guide]]
- [[../architecture/integrations|architecture/integrations.md]]
- [[../ebay-multi-store-architecture|ebay-multi-store-architecture.md]]
- [[../ebay-api-integration-notes|ebay-api-integration-notes.md]]
- [[../ebay-client-onboarding|ebay-client-onboarding.md]]
- [[../EBAY_MULTI_STORE_DEVELOPER_HANDOFF|EBAY_MULTI_STORE_DEVELOPER_HANDOFF.md]]

## Open questions / TODO
- Why Dubai/`AE_Dubai` is the default inventory location (vs. the earlier
  Houston/`US_77001` default) isn't explained in any doc found in this repo —
  only that it changed. Worth capturing the business reason next time someone
  who knows it touches this area.
- Not verified in this pass: whether PartsBazar360 has actually implemented the
  consumer side of the trading-enrichment contract yet, or whether it's still a
  spec waiting on the frontend work described in the integration guide's React
  example.

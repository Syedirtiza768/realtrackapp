# Fashion batch publish ("Publish next N")

Status: added 2026-11-09 on branch `feat/fashion-batch-publish`. Code: `backend/src/fashion-batch-publish/`,
`src/components/fashion/batch/`.

From the Fashion Catalog, one action takes the next N unpublished Fashion listings through
photos → S3 → counterfeit/VeRO check → fix or review → eBay publish. Later batches are the
same click.

## Flow

```
Catalog "Publish next…" ─▶ POST /api/fashion/batch-publish/batches
   picks oldest N (createdAt, id) under pg_advisory_xact_lock per org
   ─▶ BullMQ queue `fashion-batch-publish` (concurrency FASHION_BATCH_CONCURRENCY, default 3)
        per listing:
        IMAGES_PROCESSING  FashionImagePipelineService
        IMAGES_READY
        COMPLIANCE_CHECK   text rules + vision model + safe auto-fixes
        ├─ BLOCKED / NEEDS_REVIEW ─▶ stop (review queue)
        └─ READY ─▶ dry run: stop
                   live: FashionReview approved as the confirming reviewer
                         ─▶ EbayMultiStoreListingService.createPublishJob (existing queue)
        PUBLISHING ─▶ sync job polls ebay_listing_job_targets every 15 s (max ~30 min)
        PUBLISHED | FAILED
```

Per-item errors are caught and stored (`FAILED` + message); the batch keeps going. Failed items
are retried one by one (`POST items/:id/retry`).

## State

| Table | Purpose |
|---|---|
| `fashion_listing_pipeline` | One row per catalog product: current state, compliance result, risk score, issues, fixes, AI suggestion, processed images (keys, sizes, flags, exclusions), cached vision verdict + fingerprint, eBay master URLs, eBay-hosted URLs, publish job/offer/item IDs. `active_batch_id` locks a listing to one batch. |
| `fashion_publish_batches` | Requested size, dry-run flag, target eBay account/marketplace, `confirmed_by_user_id`, status. |
| `fashion_publish_batch_items` | Listing membership per batch with the outcome (state, result, risk, issue codes, eBay item ID, error). Feeds the progress view and CSV. |
| `fashion_compliance_configs` | Per-org override of the rule lists (block terms, review phrases, filler, protected brands and price floors, known/ambiguous brands, Authenticity Guarantee thresholds). |

Migration: `1791700000000-CreateFashionBatchPublish` (additive).

### Picking (no double-picking)

Eligible: `vertical='fashion'`, `ebay_item_id IS NULL`, `manual_review=false`, status not
`deleted/quarantined/rejected`, no published `ebay_listing_channels` row, and either no pipeline
row or one at rest (`active_batch_id IS NULL`) in `UNPUBLISHED` (dry run) or `UNPUBLISHED|READY`
(live). A live batch therefore picks up listings a dry run marked READY first — rollout step
"publish 10 of the dry-run 100" is just "Publish next 10".

## Images

`catalog/{listingId}/{sha256}/{variant}.{ext}` under `AWS_S3_PREFIX`, Cache-Control
`public, max-age=31536000, immutable` (StorageService.putObject):

| Variant | Format | Longest side | Quality |
|---|---|---|---|
| original | as uploaded | — | unchanged |
| thumb | WebP | 200 | 75 |
| small | WebP | 600 | 80 |
| large | WebP | 1600 | 82 |
| ebay_master | JPEG, 4:4:4, white background | ≤ 2000 | 90 |

All variants: EXIF auto-rotate, sRGB, metadata (EXIF/GPS) stripped by sharp, `withoutEnlargement`
(never upscaled). Under 500 px longest side → excluded from the eBay set (`IMAGE_TOO_SMALL`); under
1600 px → `low_quality` flag. Same bytes twice → stored once, second copy `IMAGE_DUPLICATE`. More
than 24 → `IMAGE_OVER_LIMIT` (eBay's per-listing limit in most categories). Re-runs reuse objects
by hash (HEAD on `ebay_master.jpg`).

Images in our bucket are read with GetObject; others are fetched with a 30 s timeout, 3 attempts
with backoff, content-type check and a 30 MB cap; sharp must be able to read the file.

eBay accepts JPG, GIF, PNG, BMP, TIFF, AVIF, HEIC and WEBP (eBay "Managing images" guide, checked
2026-11-09); JPEG is used for the master for widest compatibility.

### How the masters reach eBay

The pipeline writes two flat string-array attributes on the product: `_ebayMasterUrls` (the masters,
in photo order) and `_ebayMasterSourceUrls` (the catalog photos they were made from). It does this on
live runs and re-checks only, never dry runs. `CatalogPublishResolverService` uses `_ebayMasterUrls`
for Fashion when `_ebayMasterSourceUrls` still equals the product's `imageUrls`
(`fashion-ebay-images.util.ts`); otherwise it falls back to the normal image path. Object-typed
attributes are not allowed: the Fashion validator rejects them and every save of the listing fails.
The first version wrote an object (`_ebayMasterImageSet`); the 8 listings it touched were cleaned up on
2026-11-09 (audit action `fashion.batch.repair`). The existing
`EbayMediaApiService` then uploads each master's bytes from S3 with `create_image_from_file` (the
bucket stays private) close to publish time and caches the EPS URL in `ebay_hosted_images`; the
pipeline copies those URLs into `fashion_listing_pipeline.ebay_image_urls`.

## Compliance check

`fashion-compliance.rules.ts` (pure, unit-tested) + `fashion-vision-check.service.ts`.

Severities: `info`/`warn` add risk only, `review` → NEEDS_REVIEW, `block` → BLOCKED.
Risk score 0–100 (any open block ≥ 90). Result: `PASS`, `AUTO_FIXED`, `NEEDS_REVIEW`, `BLOCKED`.

| Check | Outcome |
|---|---|
| Replica-type terms (replica, fake, counterfeit, 1:1, AAA, mirror quality, …) in title/brand | block |
| Same in description inside a negation ("not a replica") | review |
| Exceptions: "fake fur", "faux", "imitation leather", … | ignored |
| Comparisons: "inspired by", "style of", "dupe", "like Gucci", "Chanel-style", "unbranded" next to a brand | review (never auto-fixed: removing the words could disguise a dupe) |
| Several brands in the title, real brand present | auto-fix: remove the others |
| Several brands, collab marker (" x ", "collab") or no brand | review |
| Title brand ≠ Brand specific; brand field ≠ Brand specific; description names another protected brand | review |
| Brand specific empty, title starts with exactly one known brand | auto-fix: fill it |
| No brand at all | review |
| Filler (L@@K, WOW, must see, HTF, emoji, `!!!`) | auto-fix |
| Protected brand priced under its floor (e.g. Gucci $80, Louis Vuitton $150, Rolex $1500) | block |
| Missing price | review |
| Authenticity Guarantee category at/over threshold (sneakers $100, handbags $500, watches $2000, fine jewelry $500) | warn; review when the brand is protected |
| Vision: visible logo/label ≠ listing brand | block |
| Vision: logo distorted/misspelled; stock/catalog photo | review |
| Vision: watermark/other seller branding, different product, wrong colour/type, collage, heavy text overlay | auto-fix: drop the photo (review instead if it would drop every photo) |
| Vision: blurry | warn |
| Vision call failed | review (fail closed) |
| No usable photo left | review |

Ambiguous brand words (Coach, Gap, Guess, Vans, Boss, …) are only matched when they are the
listing's own brand, so "coach jacket" does not trigger brand rules.

Vision model: `FASHION_COMPLIANCE_MODEL` → `FASHION_AI_MODEL` → `google/gemini-3.1-flash-lite`,
fallback `FASHION_AI_FALLBACK_MODEL` (default `google/gemma-4-31b-it`) — the Jev-chosen Fashion
models (see decisions.md 2026-10-07). Up to 8 photos are sent as 600 px WebP data URLs (bucket
stays private). The verdict is cached by a fingerprint of prompt version + title + brand +
description + image hashes + text issue codes, so dry run → live does not pay twice. The same call
returns a suggested title/brand/description when there are review-level text issues.

Fixes are applied to the catalog only on live runs and re-checks, and the check is re-run after
any reviewer fix.

## Publish readiness (added 2026-11-09)

READY means ready to publish, not just "photos and text passed". After the compliance check, every
listing that would pass runs through `ListingBuilderService.build` in read-only mode. That is the same
code the live publish uses. Its blocking errors become review issues, so the listing does not reach
READY:

| Issue code | Meaning | Who fixes it |
|---|---|---|
| `MEASUREMENT_UNITS` | Imported measurements need a cm/inches confirmation | Reviewer, per listing |
| `CONDITION_MISSING` | No eBay condition; the builder does not infer one | Reviewer, per listing |
| `POLICY_MISSING` | Store policies not synced or mapped | Store settings |
| `RETURN_POLICY` | New-condition listings need a 30-day return policy with seller-paid returns | eBay Seller Hub, then re-sync policies |
| `MERCHANT_LOCATION`, `IMAGE_REQUIRED`, `LISTING_BUILD` | Other builder blockers | Depends on the message |
| `BUILD_CHECK_FAILED` | The check itself errored | Retry the item |

Every batch needs an eBay store, because the check runs against that store's policies. Read-only mode
never creates a merchant location on eBay; it reports the blocker instead (`readOnly` in
`listing-builder.service.ts`). Live batches approve a listing only after this check passes. The
builder's own approval check ("authenticity/compliance review must be approved") is left out of this
check, because the live batch records the reviewer's approval itself just before it publishes.

## Authenticity approval (decided 2026-11-09)

Publishing still requires an approved `FashionReview` with `authenticityConfirmed=true`
(`FashionListingsService.assertApproved`, unchanged). A **live** batch must be started by a user
with `fashion.review` + `fashion.authenticity.review` who ticks one confirmation; listings in
that batch that reach READY are approved under that user's ID, recorded per listing in
`fashion_reviews` and `listing_action_logs`. NEEDS_REVIEW listings are approved individually in
the review queue. BLOCKED listings cannot be approved.

## Idempotency

- Picking: advisory lock + `active_batch_id`; a listing is in at most one running batch.
- S3: content-hash keys, reuse on HEAD.
- eBay: `createPublishJob` idempotency key `fbp:{product}:{account}:{marketplace}:{publishAttempt}`;
  `publishAttempt` only increases when a failed item is retried. The existing publisher also
  detects already-published SKUs (`skipped` → recorded as PUBLISHED).

## API (`/api/fashion/batch-publish`)

| Method | Path | Permissions |
|---|---|---|
| POST | `/batches` `{size, dryRun, ebayAccountId?, marketplaceId?, confirmAuthenticity?}` | fashion.publish (+ review perms for live) |
| GET | `/batches`, `/batches/:id`, `/batches/:id/report.csv` | fashion.listings.view |
| POST | `/items/:itemId/retry` | fashion.publish |
| GET | `/review-queue?state=NEEDS_REVIEW\|BLOCKED` | fashion.authenticity.review |
| GET | `/listings/:id`, `/listings/:id/audit` | fashion.listings.view |
| POST | `/listings/:id/apply-suggestion` | fashion.listings.update + fashion.review |
| POST | `/listings/:id/reject-suggestion`, `/listings/:id/recheck` | fashion.review |
| POST | `/listings/:id/approve`, `/listings/:id/reject` | fashion.review + fashion.authenticity.review |
| GET/PUT | `/compliance-config` | listings.view / fashion.settings.manage |

CSV columns: listing_id, sku, title, status, compliance_result, risk_score, issues, ebay_item_id,
published_at, error.

## UI

- Catalog toolbar (Fashion, `fashion.publish`): **Publish next…** → count, dry-run/live, store,
  reviewer confirmation → `/fashion/batches/:id`.
- `/fashion/batches`, `/fashion/batches/:id`: counts per state, progress, top issue types,
  per-listing status/risk/issues/eBay link, retry failed, audit log drawer, CSV export.
- `/fashion/compliance-review`: NEEDS_REVIEW / BLOCKED queue, issues, photo previews (dropped
  photos greyed), AI fix before/after diff with apply / edit / reject, re-run check,
  approve (authenticity checkbox) / reject.

## Audit actions (`listing_action_logs`)

`fashion.batch.images`, `fashion.batch.compliance`, `fashion.batch.compliance.recheck`,
`fashion.batch.autofix`, `fashion.batch.publish.queued|success|failed`, `fashion.batch.failed`,
`fashion.review.approved|rejected`, `fashion.review.suggestion.applied|edited|rejected`.

## Known limits

- Batches cannot be cancelled from the UI yet.
- Price floors and brand lists are starting values; tune them per org via `compliance-config`.
- The vision model was chosen for Fashion identification, not benchmarked for counterfeit
  signals; benchmark before relying on it at scale (see `jev-for-model-selection`).

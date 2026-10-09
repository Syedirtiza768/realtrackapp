# Fashion quick capture — 2026-10-09

Closes the gaps found by comparing the Fashion workspace with a competitor
photos-to-listing flow (SellerPundit "Bulk Upload Images", screen recording of 2026-09-28):
fixed photo slots, garment measurement charts, a branded size-chart image, batch SKUs,
warehouse at intake, background AI identification, a phone-first capture screen, image
banners and an intake history. The 2026-10-09 catalog handoff/reporting update keeps
processed captures staged until an operator adds them to Catalog, tracks who uploaded and
added each item, and moves store/policy selection to catalog-time publishing.

## What was added

| Gap | Implementation |
|---|---|
| Garment measurements (A–E) | `backend/src/verticals/fashion-measurements.ts` — 10 templates (T-shirt/top, shirt/sweater, outerwear, dress, pants, shorts, skirt, bag, cap/hat, shoes), each with lettered points, attribute keys ending in `Measurement`, keywords and a schematic diagram. Served by `GET /api/fashion/measurement-templates`. |
| Measurement chart UI + cm/in | `src/components/fashion/FashionMeasurementChart.tsx` (editor and capture). Switching units does not convert numbers already entered. |
| Branded size-chart image | `FashionIntakeImagesService.sizeChart` renders an SVG (brand name, "SIZE GUIDE — <chart>", diagram, value table, SKU) to WebP with sharp and stores it under `fashion/size-charts/<org>/`. Endpoint `POST /api/fashion/listings/size-chart`. |
| Fixed photo slots | Front (1, required), Back (1, required), Tag & labels (1–2, required), Additional (≤13), Size chart (≤1). `src/lib/fashionPhotoSlots.ts`, `FashionPhotoSet.tsx`. Slot order is the eBay picture order; front is primary. |
| Batch + SKU generator | `fashion_sku_counters` table; `POST /api/fashion/intake/sku` returns `<BATCH>-<0001>[-<SIZE>]`. The first use of a batch seeds from the highest existing `<BATCH>-<n>` SKU in `catalog_products`; taken SKUs are skipped (SKUs are globally unique). |
| SKU-named photo files | `POST /api/fashion/listings/photos?sku=…` stores `<SKU>-<timestamp>-<id>.webp`. The capture screen locks the SKU once photos exist. |
| Canonical photo format | Every accepted JPEG, PNG, or WebP source photo is normalized by `ImageProcessorService.convertBufferToWebp` and stored with `image/webp` content type and a `.webp` key. |
| Warehouse at intake | `fashion_warehouses` table, managed in Fashion settings (`fashion.settings.manage`). Stored on the item as `_warehouseCode` / `_warehouseName`. **Does not change the eBay merchant location used at publish.** |
| Background identification | `POST /api/fashion/intake` saves a staged item and queues BullMQ `fashion-intake-analysis`; `FashionIntakeProcessor` → `FashionIntakeService.processIdentification`. Capture can continue while identification runs. `POST /api/fashion/listings/:id/identify` re-queues. |
| Phone-first capture screen | `/fashion/capture` (`FashionCapturePage.tsx`). Session settings persist per browser (`localStorage` key `fashion.capture.session`). "Save & next garment" resets the item and generates the next SKU in the batch. |
| Image banners | `POST /api/fashion/listings/photos/banner` composites a text strip (top/bottom, dark/pink/light) onto a copy of a photo. Only keys under this organization's `fashion/intake/<org>/` or `fashion/size-charts/<org>/` are accepted — no arbitrary URL fetch. |
| Intake history and catalog handoff | `/fashion/intake` (`FashionIntakePage.tsx`) over `GET /api/fashion/intake` (batch/status/search/source filters, page/pageSize ≤100). Auto-refreshes while items are queued or processing. Once identification is `suggested` or `skipped`, and the item is neither quarantined nor flagged for manual review, **Add to Catalog** calls `POST /api/fashion/intake/:id/add-to-catalog`; this records `_catalogAdded`, `_catalogAddedBy`, `_catalogAddedAt`, plus a `fashion.intake.catalog_added` action log. Capture items remain hidden from the Fashion Catalog until this action. |
| Activity report | `/fashion/reports` (`FashionActivityReportPage.tsx`) over `GET /api/fashion/reports/activity` and `/export`. Filters cover activity dates, uploader, catalog adder, catalog/identification/review/publication status, store, batch, free-text search across item fields/photos/specifics, and Fashion attribute key/value. CSV includes all visible product attributes and publication target policy/outcome data. |
| Catalog-time store and policy choice | `FashionPublishModal` opens from the shared Fashion Catalog for selected items. Operators select one or more active Fashion stores and, per store, shipping/payment/return policies or store defaults. The server verifies access, approval and the exact store-policy selection before queueing the existing bulk publish job. |

## Data stored on `catalog_products.vertical_attributes`

Measurement values: `sizeChartTemplate`, `measurementsUnit` (`cm`|`in`) and per-point keys
(`shoulderMeasurement`, `chestMeasurement`, `sleeveMeasurement`, `bodyLengthMeasurement`,
`sleeveWidthMeasurement`, `hemMeasurement`, `waistMeasurement`, `hipMeasurement`,
`riseMeasurement`, `inseamMeasurement`, `legOpeningMeasurement`, `lengthMeasurement`,
`bagWidthMeasurement`, `bagHeightMeasurement`, `bagDepthMeasurement`, `strapDropMeasurement`,
`headCircumferenceMeasurement`, `brimLengthMeasurement`, `crownHeightMeasurement`,
`insoleLengthMeasurement`, `outsoleWidthMeasurement`, `heelHeightMeasurement`,
`shaftHeightMeasurement`). Keys are family-scoped: changing family drops measurements that
do not belong to it.

Meta keys (never sent to eBay): `_intakeSource` (`capture`), `_intakeBatch`,
`_warehouseCode`, `_warehouseName`, `_intakeCreatedBy`, `_createdByUserId`,
`_catalogAdded`, `_catalogAddedBy`, `_catalogAddedAt`, `_photoRoles`,
`_sizeChartImageUrl`, `_analysisStatus`
(`queued`|`processing`|`suggested`|`failed`|`skipped`), `_analysisQueuedAt`.

`_photoRoles` holds one `role:url` entry per image (for example
`front:https://…/AVP-0001-M-….webp`). It is keyed by URL rather than position so screens
that reorder `imageUrls` (the shared catalog quick view) cannot mislabel photos. Items saved
before slots existed load with the first photo as Front and the rest as Additional.

## Business rules

- Measurements are always entered by a person; the vision prompt still forbids inferring them.
  Quick capture requires every point on the chosen chart when "Add measurement chart" is on.
- Measurements are published in the description ("Measurements (taken flat, inches): A. …")
  and the size-chart image, **not** as eBay item specifics. `fashionAspectsFromAttributes`
  also stopped emitting `categoryFamily`, `sizeChartTemplate`, `measurementsUnit` and
  `measurements` as custom specifics (previously every non-`_` key became a specific).
- Background identification merges onto the **latest** saved draft: confirmed keys, a
  confirmed title/description and existing brand/condition/category are never overwritten;
  conflicts go to `_conflictKeys`. The placeholder title `Pending identification — <SKU>`
  never counts as confirmed, even after an editor save. Only `draft`, `needs_review` and
  `rejected` items are identified; approved, quarantined or manual-review items are skipped.
  Approval status is not changed.
- The generated size chart is excluded from vision input.
- Capture does not select an eBay account or store. Only processed captures that are not quarantined or flagged for manual review can be explicitly added to the shared Catalog; store and per-store policy choices are made from the Catalog publish action.
- The report is organization-scoped and uses the authenticated user's Fashion listing-view permission. CSV cells are quoted and formula-prefixed values are neutralized.
- The analysis suggests `sizeChartTemplate` from the identified item type when none is set.
- No new permissions: capture/SKU/size chart/banner/catalog handoff use `fashion.listings.create`, history/report and
  warehouse reads use `fashion.listings.view`, identify uses `fashion.listings.update`,
  warehouse writes use `fashion.settings.manage`.

## Deployment

- Migration `1791000000000-CreateFashionIntake` creates `fashion_warehouses` and
  `fashion_sku_counters` (additive; reverts cleanly).
- The backend Docker runner installs `fonts-dejavu-core`. Without a system font, sharp/librsvg
  renders size-chart and banner text blank.
- New BullMQ queue `fashion-intake-analysis` (concurrency 2) runs in the backend process.

## Verification (2026-09-28)

- Backend: `npx jest src/verticals` — 60 tests passed (new: `fashion-measurements.spec.ts`,
  `fashion-intake.service.spec.ts`); `tsc -p tsconfig.build.json` clean; new files lint clean.
- Frontend: `npm run build` passed.
- Isolated browser run (scratch database, throwaway Redis, no S3/OpenAI credentials): warehouse
  create/duplicate rejection, SKU generation seeded from an existing `AVP-12969-XL` →
  `AVP-12970-M`, required-slot validation, intake create (5 photos in slot order, `queued`),
  background job → `failed` without an OpenAI key, retry from the editor (202 + polling),
  intake history filters/badges, editor slot/chart reconstruction, 375px layout without
  horizontal scroll.
- Live AI (approved 2026-09-28, 2 OpenAI vision calls): a quick-capture draft of a Gildan
  T-shirt (front, back, label photos cropped from the reference video, sent as data URLs)
  went queued → processing → suggested in ~9 s. Result: brand Gildan (read from the label),
  eBay category 15687 T-Shirts, title within 80 characters, colour/pattern/neckline/sleeve
  suggestions; the confirmed department, label size, condition and all five measurements
  were kept, with no false conflicts; the description included the measurement table. A
  second run regenerated only the unconfirmed title. The editor showed 14 "Suggested" badges.
- Banner compositing: `fashion-intake-images.service.spec.ts` renders a banner onto a photo
  with mocked storage and checks output format/size/pixels and organization scoping.
- **Not verified: real S3 storage.** The AWS access key in `backend/.env` (also used by the
  local Docker backend) is rejected by AWS ("Access Key Id … does not exist"), so no upload,
  size-chart or banner object could be written. Rendering is covered by tests; the storage
  calls are the existing `StorageService.putObject` path used by photo upload. Re-check once a
  valid key is configured.
- Fixed after the live run: "A printed size was not confirmed" no longer appears when the
  operator entered the size, and the "label size vs measured dimensions" warning is skipped
  when a measurement chart is set.
- Observed 2026-09-28, partly addressed 2026-10-07: the model returns lower-case values
  ("blue", "t-shirt"); department is now normalized to eBay values (`Men`, `Women`, ...).
  Composition from a brand line ("Ultra Cotton") is discouraged by prompt v2 (material
  only from a label) and was not reproduced on the 2026-10-07 benchmark.
- 2026-10-07 model selection and demo run (5 labelled garments, 20 models, decided by
  Jev): see docs/decisions.md. Live service run with the defaults: all brands, sizes and
  compositions correct, 21 autofilled fields per item, 4-10 s, ~$0.0017 per item.
- Rendered chart sample: see `fashion-measurements.spec.ts` (`FASHION_CHART_PREVIEW=<png>`).

## Not in scope / follow-ups

- Warehouse → eBay merchant location mapping at publish time.
- Converting existing values when switching cm/in.
- Batch-level bulk actions from intake history (publish, reassign warehouse).

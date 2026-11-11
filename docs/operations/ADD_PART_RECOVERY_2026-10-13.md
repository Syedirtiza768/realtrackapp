# Add Part recovery — 2026-10-13

## Causes and changes

- `SingleListingFormService.lookupPart` previously replaced provider/storage errors with a generic photo mismatch. It now propagates the original exception when the photo check fails.
- `resolveVerifiedPhotoIdentity` in `backend/src/ingestion/services/part-photo-evidence.util.ts` requires a complete OCR token match (spaces/hyphens may separate a printed number). It retains that verified entered number when the model chooses a different printed identifier. It removes the alternate primary identifier from the generated name and uses a neutral description; OCR evidence remains available. Partial numeric substrings and unverified model MPNs are rejected.
- Production already reads managed S3 photos through authenticated `prepareVisionImageInputs`, supplying bounded image data to the provider. The local source now includes this behavior. An old image-403 listing succeeded with this reader during diagnosis.
- `VisionEnrichmentPipeline.analyze` recognizes `ECU_IDENTIFICATION_PROMPT` even when explicitly supplied and requests high image detail for Add Part/ECU identification.
- `OpenAiService.chat` defaults missing/invalid completion limits to 4,096 tokens. Explicit positive limits remain respected. `EnrichmentRetryService.classifyError` recognizes billing 402 before substring-based error markers; funding/configuration failures stop automatic retries and appear as system failures.

## Evidence and rollout

- BMW `BLAP-20082`: the model selected `64119243951`, but the OCR also contained the entered `11611611` in `Germany 11611611`. The outer exact-primary-number check rejected this valid evidence. Regression coverage reproduces it.
- Diagnostics for `BLAP-20085` and the old 403 case `BLAP-19960` succeeded with authenticated image input and bounded requests.
- Backend build and six focused Jest tests passed. An isolated container checked token defaults, alternate printed identifiers, provider error propagation, billing classification, review status, and explicit ECU prompt parsing.
- Backend image: `realtrackapp-backend:add-part-recovery-20261013-r1`, derived from `inventory-photo-review-20261013-r2`; only five scoped compiled files changed. Existing Compose overrides/environment were preserved. Local and public health returned success. Rollback image: `realtrackapp-backend:rollback-add-part-recovery-20261013-r1`.
- Release directory: `/home/ubuntu/realtrackapp-add-part-recovery-20261013-r1`. Snapshot and recovery ledger: `/home/ubuntu/realtrackapp/output/add-part-recovery-20261013`, private permissions. No migration or eBay publication is part of this repair.

## Recovery audit

The immutable snapshot at 10:54:03 UTC covers failed, non-deleted records imported or failed since 2026-10-06 10:54:03 UTC. It contains 25 records: 20 Add Part and five pipeline-import records, including one already published record. Earlier live counts changed while other processing/users repaired records; the snapshot is the recovery baseline.

Recovery uses `InventoryAutoTriggerService.enqueueAutoEnrich(..., { force: true })` and the existing inventory worker. Before queueing, the runner checks the current failed state, pending jobs, publication status, and unchanged photos/identifiers against the snapshot. Published content is reviewed separately. The ledger records every queued listing and pre-repair version.

## Final results (11:18:56 UTC)

- All 24 unpublished failed records were retried through the existing worker, in batches of four. `BLAP-20035` needed one additional retry after a separate OCR check and visual inspection confirmed `GPLA-19B555-CC` on its original label.
- `BU1-16326` contained `37906233` in both saved number fields. Its photographed stock label clearly shows `037906233`; the reader independently extracted that number. The missing leading zero was restored in the listing/catalog, with a before-image saved, then enrichment succeeded.
- **13 completed; 12 require review; zero failed; zero pending recovery jobs.** All 25 baseline records were accounted for; a fresh query found no failed records imported or failed during the last seven days.
- Three require original number evidence: `BLAP-20022` (the five caliper photos show casting identifiers but not saved `34216776789`), `BLAP-20079` (23 photos do not verify `1087200305`), and the already published `DT-BOSCH-0986479J99` (photos do not verify saved `600643100D`). The published record's obsolete billing failure was replaced with an accurate identity-review reason; its content, channel, status, and eBay item ID were preserved. These are unresolved evidence requirements, not successful identity checks.
- Six processed records lack validated fitment: `BLAP-19941`, `BLAP-19960`, `BLAP-20021`, `BLAP-20036`, `BU1-16317`, and `BU1-16326`. They remain in review; the recovered image access/identity processing does not establish vehicle compatibility.
- Three imported records carried unrelated Volkswagen Golf vehicle context into regenerated titles/fitment: `BU1-16336`, `BU1-16349`, and `BU1-16394`. Complete before-images were saved in `imported-fitment-before.json`. Unsupported active fitment, vehicle/year claims, and cached optimization payload were withdrawn; neutral part-number titles/descriptions were retained and all unpublished marketplace variants/catalog records were left in manual review. Photos, prices, quantities, source files, and the shared import job were preserved. Do not force optimization until exact part-to-vehicle evidence is supplied.
- Final backend health: container healthy; local/public HTTP 200. No billing-402 or 65,536-token errors were found in logs since deployment. Build and six targeted tests passed again after local source alignment; new helper/spec files passed ESLint.

### Completed listings

`BLAP-20015`, `BLAP-20016`, `BLAP-20017`, `BLAP-20018`, `BLAP-20019`, `BLAP-20020`, `BLAP-20024`, `BLAP-20025`, `BLAP-20028`, `BLAP-20035`, `BLAP-20062`, `BLAP-20064`, `BLAP-20082`.

### Deployment/source preservation

The server checkout predates several active compiled hotfixes, including photo-first lookup. Its four relevant source files were archived as `source-before.tgz` in the release directory and were not overwritten with the dirty local checkout. Current source corrections are in the local repository; the production release contains scoped patches derived from the inspected running image. Reconcile the older server checkout with active fixes before a future full rebuild. The release directory and immutable recovery snapshots provide rollback evidence.

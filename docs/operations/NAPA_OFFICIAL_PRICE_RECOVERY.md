# NAPA official-price recovery strategy

Status: 2026-09-29. This plan applies to the 737 NAPA rows in import
`31fe3770-48c8-4667-9351-af4a1fad99ad`. It uses the You.com key in
`C:\Users\Irtaza Hassan\Documents\youNAPA.txt`; never copy the key into this
document, logs, SQL, or a product record.

## Target and current evidence

The target is an **exact-product NAPA base unit price**, with its official
product URL, currency, storefront location when relevant, retrieval time, and
visible price text. Shipping, tax, sale bundles, and refundable core deposits
are separate. All inventory rows retain the owner's **new** designation. On
2026-09-29 the owner accepted NAPA prices from remanufactured pages when the
exact part number matches. Retain that source-condition provenance; still
reject a drum price for a rotor listing or another product-type mismatch.

Current live readback: 737 NAPA rows; 445 have some catalog price, 292 have
none. Of the 445 priced rows, 393 have accepted official NAPA price evidence
(390 fresh official-page prices and three explicitly indexed official prices).
The official-price backlog is therefore **344 rows**, including 52 rows with
an existing price from another source. Its mutually exclusive segments are:

| Segment | Rows | Next route |
| --- | ---: | --- |
| Exact, type-compatible NAPA page, no visible price | 79 | Store context and alternate official storefront |
| No verified exact official product page | 254 | Targeted discovery and exact identity check |
| Official page describes a different product type | 11 | Hold for inventory/source reconciliation |

The previous MPN-only pass searched the 235 then-unpriced unresolved rows and
found four newly compatible pages; another pass searched 40 then-unpriced
accepted pages and found five more official prices on alternate NAPA pages.
A third pass searched 19 accepted products with another-source price and found
three more official prices. A separate 22-product discovery pass checked all
remaining other-priced products without a verified exact page (44 queries,
no errors). It found four rows with official URL candidates, but their indexed
titles describe a different product type. These stay unpriced from NAPA until
an exact, type-compatible product can be verified. After the owner's condition
override, 124 formerly held exact-part rows were applied in five guarded batches.
The user-provided Google screenshots supplied indexed official prices for
`NAPA-26917` ($14.49) and `NAPA-2072XB` ($108.99); both have screenshot hashes
and distinct indexed-price status. The $111.99 Shopping display for 2072XB
was not used.
An additional alternate-storefront pass checked 19 newly eligible blank-priced
exact-page rows (38 You.com searches). It found an exact NAPA Canada page for
`NAPA-2775XA` with C$163.29/Each, official primary image, and Dodge Dart
fitment. The guarded writer stored US$115.25 using the recorded 0.7058 CAD/USD
conversion, backed up production, and verified price, image, and fitment
readback. Other new candidates were unavailable or a different part type.
Reuse those search and Contents checkpoints. Repeating identical queries is
unlikely to help. The existing report and evidence are under
`output/_retry-work/`.

## Recovery sequence

1. **Freeze the queue.** Export current catalog and draft IDs, prices, and
   evidence statuses. Deduplicate by SKU and normalized manufacturer part
   number. Keep separate counters for `no_any_price`, `other_source_price`,
   and `verified_official_price`. Back up the database before any write.
2. **Recover price on the 79 exact pages first.** Batch known URLs in groups
   of at most 10 through You.com Contents with `formats: ["markdown", "html",
   "metadata"]`, `max_age: 0`, and a 20–30 second crawl timeout. Try the
   matching US and Canada official product page when the exact MPN and product
   type agree. Check visible `Unit Price`/`Price` and structured product
   offers; ignore crossed-out, core, shipping, and cart totals. Where the
   content is blank, pilot a fixed store/ZIP context in a browser on three
   known-priced controls and three unpriced pages before scaling. NAPA says
   prices and availability depend on the selected store. Record the chosen
   store and ZIP with every such price. Do not assume a URL parameter sets a
   store until a control page proves it.
3. **Discover exact pages for the 254 unresolved rows.** Use You.com Web Search
   in a bounded query cascade, stopping as soon as exact candidates appear:
   `"<MPN>" "<part type>" NAPA`; `"<compact MPN>" site:napaonline.com/en/p/`;
   and the Canada equivalent. Include the full listing title only when the
   short query is ambiguous. Try official-domain boosting with `country: US`
   or `CA` rather than a strict domain allowlist for discovery; accept prices
   only from an official NAPA product page. Search result thumbnails are not
   product-image proof. Use a search cache keyed by normalized query, country,
   and API parameters. Batch only newly found official product URLs into
   Contents.
4. **Validate identity before price.** The source page's `Part #` must match
   the normalized MPN exactly, including suffixes; a longer part number that
   merely ends in the target is rejected. Confirm NAPA brand, product family,
   source condition, and any explicit position against the listing. The owner's
   2026-09-29 override permits a reman source for an exact-MPN new listing. Different
   NAPA lines may share a number; record the official line and require a
   type-compatible product. Do not infer a price from a nearby MPN or similar
   vehicle. Put conflicts in a review queue with both titles and URLs.
5. **Escalate sparingly.** Use the built-in web search to cross-check hard
   exact matches and indexed official price snippets. An indexed snippet is
   usable when the official URL, exact part, product type, unit price, and
   screenshot or stored snippet are retained; label it separately from fresh
   page pricing. Use You.com Research `lite` only to discover additional
   candidate URLs. A pilot on `PCC 104133` falsely said its existing official
   page could not be located, so Research output is never identity or price
   authority. Do not scale Research over all 344 rows.
6. **Apply the exact-MPN condition override.** The 124 former new-versus-reman
   holds were processed in five readback-verified batches. Keep the 11 type
   conflicts held. For example,
   `NAPA-440-6635` currently says rotor while the cited official product is a
   drum; its $154.99 must not be copied to the rotor row.
7. **Publish only verified deltas.** Apply accepted official prices to the
   catalog product and its single draft listing in one guarded transaction.
   Preserve existing official image ordering, descriptions, and verified MVL
   fitment unless independently improved. Store the raw currency and unit
   price in evidence; convert CAD to USD with a dated rate for USD-only fields.
   Re-read every changed row and compare price, URL, image, and draft price.
   Keep a rollback backup and an audit entry for each batch.

## Evidence and checkpoints

Each candidate should record `sku`, listing title/type/condition/position,
normalized MPN, official URL, source `Part #`, source title and line, currency,
base unit price, exact displayed price text, separate core deposit, store/ZIP,
retrieved time, search query/request ID, Contents retrieval result, identity
decision, and rejection reason. Save raw search/Contents results, but only put
accepted, minimal provenance in product records. A price may be published when
the exact official page, validated store-specific official response, or an
exact-product official Google result displays it. Preserve screenshot or snippet
evidence for an indexed price, label it `indexed_or_cached_official_price`, and
do not substitute a conflicting Shopping price. `NAPA-26917` and
`NAPA-2072XB` are examples.

Use resumable batches of 25 listings, up to three search workers, exponential
backoff on 429/5xx, and an immediate stop on 401/402/403. Contents supports
ten URLs per request. Keep a configurable API-call and spend ceiling, and
report after every batch: searched, exact pages, prices found, conflicts,
database writes, readback failures, and remaining gaps. If a pilot yields no
new official prices, stop that route rather than spend the full budget.

## Limits and definition of done

You.com Search finds URLs and snippets; it does not guarantee a price, even
for a page whose full Contents response displays one. You.com Contents may
miss a price rendered only for a selected store. NAPA itself says store and
online prices can differ. The Apify NAPA actor was separately tested and
received HTTP 403 from NAPA, so it is not a bulk fallback at present. A
three-product title-search pilot found the exact `SFI26917` page in You.com but
omitted the $14.49 shown in the user's Google result; Tavily returned HTTP 432
(usage limit) for all three pilot requests. Neither API currently reproduces
Google's visible indexed-price snippet, so do not treat their missing snippet
as proof that Google has no price. Direct Google HTTP probes (normal, text-only,
and legacy variants) returned a redirect page without the known `SFI26917`
control or $14.49. The desktop browser automation runtime failed to initialize
in this Windows sandbox, so a browser-driven bulk pass was unavailable in this
session. Do not infer a zero price from these retrieval failures.

The run is complete when every NAPA row has either (a) a readback-verified
official NAPA price with exact-product evidence and location/currency context,
or (b) a specific, auditable `no_official_price`, `no_exact_page`, or conflict
reason. **Do not promise 737 prices if NAPA does not display 737 prices.**
The median of verified prices is an aggregate report, never a substitute
listing price.

## API documentation

- You.com Web Search: https://you.com/docs/guides/search
- You.com Contents: https://you.com/docs/guides/contents
- You.com Research: https://you.com/docs/guides/research
- NAPA store-dependent pricing: https://www.napaonline.com/en/frequently-asked-questions

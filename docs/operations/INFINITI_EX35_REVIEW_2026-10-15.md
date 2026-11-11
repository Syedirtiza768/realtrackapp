# Infiniti EX35 catalog review repair — 2026-10-15

## Scope and outcome

The screenshot's 65 visible Needs Review listings belong to pipeline
`1d2f793b-6dea-4117-8f5c-9e9cc7e7c9c1`, imported on October 12 from a source
filename describing a 2010 Infinity EX-35 donor. The pipeline has 66 catalog
products and 66 listing records; one zero-price seat-frame listing was already
soft-deleted. This repair changed only the 65 non-deleted catalog/listing pairs.

All 65 now use canonical brand **Infiniti** and model **EX35** in their titles
and donor context. Exact-MPN catalog applications were researched for all 65
rows. Every assigned year/make/model fitment was checked against active
`US_MVL_2026_07` (`e864f9d0-b5d3-4f73-a55c-e57f57d7c78a`). Catalog-backed
title years replace the import's blanket 2008–2012 claims. Where a complete
range was unavailable, the title uses only directly evidenced years or omits a
year range.

The owner confirmed these are separate dismantled parts and that a shared photo
gallery may show each part within the whole donor assembly. This is the expected
workflow for future inventory too. A shared gallery is not itself a review
blocker when the named part is shown in context; descriptions say that only the
named component is included. Part identity, left/right side, condition, and
exact fitment remain separate checks.

**All 65 records are Ready to Publish; none remain in Needs Review.** The final
14 holds were resolved with corrected part names/sides, disclosed condition or
equipment, and exact catalog fitment. Nothing was published to eBay.
The two fender panels have nine side-matched panel photos and five exact MPN
years each. The deleted zero-price seat-frame listing was left unchanged.

## Original cause

Stored optimizer results were version 1. Donor fields were blank, the brand was
`Infinity`, and titles omitted `EX35`. Title parsing produced bogus models such
as `Center`. The active MVL rejected the misspelled make. Original warnings said
there were no validated rows or fewer than five fitments. The source's blanket
2008–2012 range was not evidence for every individual MPN.

Two products carried historical `PRICE_MISSING` errors. One was the already
deleted zero-price seat frame and was left untouched. The visible tailgate panel
had a $599.99 price; its stale price error was removed without changing price.

## Photo and identity findings

The 65 products collapse into 10 distinct galleries when image URLs are sorted
before hashing. The owner confirmed this reuse is intentional: photos may show
the donor assembly with separately sold dismantled parts visible in context.
Descriptions clarify which component is included. The shared-gallery warning
was removed from all 14 held rows, and two headlight photo-conflict notes based
only on assembly context were removed. The final 14 holds were resolved as
follows:

| SKU suffix after `INFINITY-0283-` | Resolution |
| --- | --- |
| `D-1001-01` | Corrected the item name to a rear liftgate panel and documented the OEM MPN's navigation/no-Around-View variant; fitment is 2008–2012 EX35. |
| `DB-2001-07` | Corrected the item to the wood-trim radio panel; official EX35 catalogs support 2010–2012. |
| `FN-8002-01` | MPN `63860-1BA0B` identifies the front-right wheel-arch molding; corrected title/placement and fitment to 2008–2012. |
| `FN-8002-05` | MPN `63844-1BA0A` identifies the front-right fender liner; corrected title/placement and fitment to 2008–2012. |
| `HB-HANDBRK-1201` | Corrected MPN `44010-EG07A` to rear-left parking brake and documented 2009–2012 EX35 application. |
| `RB-5001-01` | Corrected the item to the rear-left mud-guard reflector/deflector; fitment is 2008–2012 EX35. |
| `RB-5002-01` | Corrected the item to a front bumper energy absorber; fitment is 2008–2012 EX35. |
| `RB-5002-04`, `RB-5002-05` | Identified the left/right Xenon headlamps with AFS; restricted fitment to 2010 EX35 and disclosed regional/equipment matching in the descriptions. |
| `RB-BMPROL-5002` | Identified the front reinforcement beam, which the catalog specifies for vehicles without adaptive cruise; fitment is restricted to the verified 2012 EX35 catalog entry. |
| `S-3001-05` | Corrected the item to the front-right seat back pad; fitment is 2008–2012 EX35. |
| `S-SEATMH-3001` | Corrected the item to the front passenger cushion/adjuster assembly, graphite leather, rather than a complete seat; fitment is 2010–2012 EX35. |
| `SM-1301-01` | Changed the title/description to a right mirror housing with glass missing; fitment is limited to the exact 2011–2012 regional catalog application. |
| `SM-MIRRLW-1301` | Verified the exact left mirror MPN and limited fitment to its 2008–2009 regional catalog application. |

Other corrected identities now ready include the front-left seat slide switch
(`87066-3LZ1A`), passenger-side assist vent (`68750-1BA0A`), upper structural
dash panel (`F7100-1BAMA`, catalog-supported for 2008 only), and right rear
mudguard deflector (`76856-1BA0A`). Titles and descriptions now identify the
listed dismantled component rather than incorrectly describing its whole donor
assembly.

The owner authorized NHTSA and PartSouq VIN checks. NHTSA did not decode detailed
vehicle identity for this regional VIN, and the source-year hint produced a
model-year warning. PartSouq's VIN lookup returned HTTP 403. The stored donor
context is therefore explicitly source-file context, not independent VIN
verification.

## Exact-part research

Research used exact product identities and application tables from
[InfinitiPartsDeal](https://www.infinitipartsdeal.com/), the
[official INFINITI Parts Store](https://parts.infinitiusa.com/), and the
[Infiniti of San Jose parts catalog](https://parts.infinitiofsanjose.com/).
Each researched row's source URL is retained in its review-candidate notes and
the operator report. Examples of differences from the blanket range:

- `25915-1BA1B` AV controller and `28565-1BA0A` seat controller: 2008–2010 EX35.
- `27760-1BU1A` A/C controller: 2009–2011 EX35.
- `88650-1BF0C` left rear seat back: 2008–2010 EX35.
- `34901-1BA0E` shift assembly: exact catalog specifies 2WD/VQ35HR and a
  production-date restriction; those restrictions remain review notes.

The bulk catalog reader reached HTTP 429 after its initial bounded pass. Its
resume pass used one request at a time with a delay and a stop-on-429 rule;
subsequent production-host connections failed. Cached public catalog evidence
supplied some remaining entries. Unresolved identifiers were not guessed.

## Persisted fields and safety boundary

The first transaction corrected all 65 titles and brands, filled blank donor
context, and saved exact-MPN fitment candidates. Subsequent scoped transactions:

1. Marked the two correctly identified fender panels Ready to Publish with nine
   side-matched photos and five exact MPN years each.
2. Promoted 45 additional rows after their existing donor-assembly photos were
   accepted as context, their named components were called out in descriptions,
   and readiness/fitment checks passed. Three missing rear placements were
   filled from the identified component location.
3. Corrected the four catalog-backed title/identity conflicts listed above and
   promoted those records after fitment and readiness checks passed.
4. Applied the owner's photo policy to the final 14, then resolved their exact
   MPN, side, condition, equipment, and application holds from catalog evidence.
   Updated titles, descriptions, fitment, and eBay item specifics; all 14 passed
   the deployed readiness checker. No shared-gallery warning remains.

Readback confirms 65 Ready to Publish records, zero Needs Review records, all
65 passing the deployed readiness checker with explicit fitment against active
MVL provenance, and zero published records in this import batch. No price,
quantity, condition field, shipping/return/payment policy, marketplace offer,
or eBay ID was changed. The pipeline's historical optimizer counters were not
rewritten. No route, permission, schema migration, deployment, or publishing
operation was performed.

## Backup and validation

- The dry run checked exactly 65 products/listings, unchanged source titles and
  identifiers, absence of published offers, positive basic fields, and absence
  of existing approved fitment before allowing writes.
- A named-field before-image was written and read back before the initial
  transaction at
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/fields-before-2026-10-15T11-11-10-356Z.json`.
  SHA-256: `7986a337f6f22fa21b757f91d621ab18986e910a21a4094d9d975b9c5a992bcc`.
- Fender before-image:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/fenders-before-ready-2026-10-15T15-27-00-632Z.json`.
  SHA-256: `003c67056378919bf02ab330a01bb4c9e5346c43764b8e3c2119cdd50df99dba`.
- Assembly-context before-image:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/assembly-context-before-ready-2026-10-15T15-36-07-071Z.json`.
  SHA-256: `87392399b237de325aa89ac713ae45f00f6d3097db3e2ca905e0e428a50fe791`.
- Identity-fix before-image:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/identity-fixes-before-ready-2026-10-15T15-38-55-092Z.json`.
  SHA-256: `488783c3706adf3e0271a75d8250f30cdbaf18c79af6ed24cf3e5f95dd923281`.
- Shared-photo-policy before-image for the final 14:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/photo-policy-before-2026-10-15T15-42-54-299Z.json`.
  SHA-256: `2d2c8fd48ea805b8fb20e46ec038ae7083cde3cc9a8de7ee86ad2adf562993a8`.
- Photo-evidence correction before-image for the two headlights and handbrake:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/photo-evidence-correction-before-2026-10-15T15-44-26-317Z.json`.
  SHA-256: `f1d267b5bd21ab46bdb78e9037a9ae5b9f09ef6cf15976118725da9ee7f2bfa6`.
- Final 14-row correction before-image:
  `/home/ubuntu/realtrackapp/output/infiniti-review-20261015/remaining-before-2026-10-15T18-28-10-490Z.json`.
  SHA-256: `b76e61ef722d22686b25bbb97f4452814ff4eaac450b64bdd666cc290d873bae`.
- Each production transaction re-read its scoped rows and checked its exact
  expected count. The deployed readiness helper was checked for promoted rows;
  final readback confirms all 65 are `ready`, with no review errors, eBay
  publication timestamp, or listing ID.
- The deleted zero-price seat-frame row remained unchanged. Production
  `/api/health` returned `status=ok` with database and memory up.
- No application source changed, so frontend/backend builds and unit tests are
  not applicable to this data-only repair.

The 65-row operator report is
`deliverables/Infiniti_EX35_review_2026-10-15.csv`. It reflects the final
production titles/statuses, exact application, shared-assembly photo treatment,
source URL, and publication state. Research/repair preparation files
are under ignored `tmp_infiniti_review_20261015/`; persistent before-images are
under the server output directory above. Restore only named saved fields for the
listed IDs after checking for intervening operator edits; do not restore a
whole database or modify live offers to undo this repair.

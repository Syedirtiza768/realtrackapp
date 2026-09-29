# eBay Product Verticals

> Status: additive pilot implementation, documented 2026-09-07.

Omni Core now carries an explicit product vertical through catalog intake,
pipeline jobs, listing resolution, durable eBay targets, and publish channels.
The supported values are `automotive`, `business_industrial`, and `fashion`.
Missing legacy values resolve to `automotive` in application code so existing
jobs retain their Motors behavior.

## Store configuration and rollout gates

Each eBay store has a JSON `vertical_config` with:

- `enabledVerticals`: verticals allowed for new work;
- `defaultVertical`: the default for a new workflow, still automotive unless
  explicitly enabled and selected;
- `workflows`: room for per-vertical workflow settings.

The `multi_vertical_catalog` feature flag is seeded disabled. Both the store
configuration and the feature flag must allow a non-automotive import or
publish. Existing automotive imports and jobs do not require the flag.

## Intake and AI routing

The catalog import screen requires an explicit vertical selection and sends it
with the upload. The import record stores the choice, and the CSV worker maps
vertical-specific attributes before validation. Business & Industrial rows
use manufacturer/model/specification fields; Fashion rows use brand,
department, garment type, size, color, material, measurements, and
condition details. Fashion Add Item identifies a garment from a complete
photo set using the existing vision provider; suggestions are editable and
successful identification is not required to save.

Non-automotive rows never merge continuation lines into vehicle fitment,
invoke Motors compatibility validation, or use Motors category fallback logic.
The vertical remains available to downstream AI routing and publish projection
so a later model or workflow change cannot silently turn a pilot row into a
Motors listing.

## Category metadata and publishing

Pilot eBay publishing requires a category-driven projection: a leaf category,
condition, required item specifics, listing structure policy, and variation
capability are resolved for the target marketplace. Missing or invalid
metadata blocks the request; the builder does not substitute a Motors
category, fitment, or Motors-specific condition.

Single-SKU pilot publishing uses the existing Inventory API item/offer path.
Variant families use this sequence:

1. Validate the family and every active variant, including unique SKUs and
   shared variation aspects.
2. Upsert one Inventory API item and offer per variant.
3. Upsert an Inventory API item group containing the variant SKUs and
   `variesBy.specifications`.
4. Publish the item group and persist each variant's offer/listing mapping.

Automotive remains on the existing Motors workflow and is rejected by the
variant item-group service.

## Additive schema

Migration `1790300000000-AddProductVerticals` adds nullable vertical columns to
legacy job/listing tables, vertical attributes to catalog products, per-store
configuration, and the family/variant/category-metadata tables. The migration
has not been run as part of this change. `DB_SYNCHRONIZE` remains disabled.

One legacy constraint remains important during the pilot: historical global
SKU/UPC uniqueness can still reject a database insert even though duplicate
detection now scopes its lookup by organization and vertical. Resolve such a
collision with an approved SKU decision; do not overwrite a row from another
vertical.

## Pilot and rollback procedure

1. Review the generated migration and apply it through the normal migration
   change-control process.
2. In a sandbox store, enable `multi_vertical_catalog`, enable exactly one
   pilot vertical in store settings, and set its default only if desired.
3. Import a small Fashion or Business & Industrial fixture, inspect the
   vertical attributes, category metadata, validation report, and generated
   publish projection.
4. Exercise Inventory API item, offer, and item-group behavior in eBay
   sandbox; record error references and readbacks before any production pilot.
5. For rollback, disable the feature flag and/or remove the pilot vertical from
   the store configuration. Existing automotive workflows remain available;
   already-created pilot rows remain auditable and are not silently migrated
   to automotive.

No production migration, live eBay publish, deploy, or bulk repair is implied
by this implementation.

## Fashion workspace security boundary (2026-09-09)

Fashion is available at /fashion/login and uses Fashion-only permissions and roles. Fashion draft listing endpoints are organization scoped; private authenticity evidence is stored in fashion_reviews and omitted from public listing payloads. Photos-first Add Item uploads garment images through existing storage and optionally identifies category and attributes with the shared vision provider; Fashion item specifics are projected from confirmed attributes (not automotive MPN/fitment). A Fashion product must be explicitly approved with authenticity confirmation before the publish projection can proceed. Quarantine blocks publishing locally and reports remote takedown as unavailable unless a supported integration is added.

The Fashion eBay OAuth start route writes vertical context into the Redis OAuth state, creates a Fashion-enabled store, and rejects an eBay seller account already connected in the workspace. The same seller cannot be reused for an automotive or Fashion store. The dedicated seed command provisions the initial Fashion admin without resetting an existing password.

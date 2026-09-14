# Fashion listing table and editor

Updated 2026-09-14. Ownership is the Fashion listing UI and client. App/Shell route integration and other Fashion pages are maintained with the main Fashion workspace.

## Files and routes

- `src/components/fashion/FashionShell.tsx`: shared `VerticalWorkspaceShell` with an explicit **Add Item** nav entry at `/fashion/listings/new`.
- `src/components/fashion/FashionCatalogPage.tsx`: `/fashion/catalog` (legacy `/fashion/listings`); Add Item opens the photos-first editor.
- `src/components/fashion/FashionListingEditorPage.tsx`: `/fashion/listings/new`, `/fashion/listings/:id`, `/:id/edit`.
- `src/components/fashion/FashionPhotoSet.tsx`: camera capture, multi-file upload, drag-and-drop, reorder/primary via `CatalogImageGallery`.
- `src/components/fashion/FashionListingPublishPanel.tsx`: saved-listing validation and enqueue UI.
- `src/lib/fashionListingsApi.ts`: typed Fashion-only endpoint client using `fetchWithAuth`.
- `src/lib/fashionFields.ts`: category-aware clothing, footwear, and accessory field groups.

The catalog list uses the shared workspace. The previous 200-row listings table remains in `FashionListingsPage.tsx` as unused legacy UI.

## Photos-first Add Item

New items start with a photo set for one garment. Users can take photos, upload files, or both, then review, add, remove, reorder, and set the primary image. Identification does not run after each photo. **Identify from photos** sends the complete set to `POST /api/fashion/listings/analyze-images`. **Continue without identification** keeps the photos and opens manual category/attribute entry.

Failed analysis preserves photos and entered values. Re-running analysis does not overwrite fields the user has edited. Saving records `_confirmedKeys` so a later identification pass still keeps those values. Conflicting suggestions are listed for review. If the photos appear to contain multiple different items, the UI asks the user to review the set and does not split it into multiple records.

Uploads use `POST /api/fashion/listings/photos` (Fashion listing create permission) and the existing `StorageService` / WebP conversion path. Fashion operators do not need `storage.upload`.

## Draft behavior

The form matches `CreateFashionDraftDto` / `UpdateFashionDraftDto`: SKU, title, description, brand, conditionId, price, quantity, imageUrls, categoryId, categoryName and verticalAttributes. SKU is read-only after creation. Price may be omitted for a new draft; clearing an existing price is rejected because the update API does not support clearing it. Quantity accepts zero and must be a non-negative safe integer. SKU/title are trimmed, required and limited to 160/200 characters. Image URLs must use HTTP(S). The first image is primary.

Fashion fields follow `backend/src/verticals/fashion.config.ts`. Clothing is always available; footwear and accessories are the other families already in Fashion scope. Changing family keeps photos and compatible values and drops hidden incompatible attributes so they are not sent as valid category data. Label size stays separate from measured dimensions; named measurements keep an explicit unit. Identification metadata keys prefixed with `_` (including `_suggestedKeys` and `_confirmedKeys`) are persisted for review state, survive attribute-key normalization, and are omitted from eBay aspects.

Category metadata adds editable item-specific suggestions and marks required values; multi-valued specifics use `|` separators. Backend validation remains authoritative. New drafts can be saved with incomplete publishing fields. AI success is not required to save.

Preview uses current form values, `sanitizeHtml` for description markup and `toProxyUrl` for images. Generate listing text uses confirmed Fashion details and keeps reported defects visible. Unknown details are omitted rather than stated as facts.

Saving an edit resets backend approval to `needs_review`. Quarantined/manualReview listings are read-only.

## Permissions and publishing

Listing view/create/update use `fashion.listings.view`, `fashion.listings.create`, `fashion.listings.update`. Photo upload and analysis use create. Validate/publish UI requires `fashion.publish`. No generic automotive catalog/store APIs are called from this editor.

Validate and publish operate on saved approved listings only. Publishing returns queue status and never claims marketplace success.

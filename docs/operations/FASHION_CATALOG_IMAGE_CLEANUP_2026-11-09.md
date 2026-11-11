# Fashion catalog image-missing cleanup — 2026-11-09

## Result

At the user's request, 5,490 Fashion catalog products were moved from
`vertical_validation_status = 'draft'` to `'deleted'` on the production host
`ec2-34-196-184-100.compute-1.amazonaws.com`. This is the catalog's soft-delete
lifecycle; product rows were not physically removed. One audit event with
action `fashion.catalog.delete` and result `success` was written per product.
The audit `user_id` is null because the SSH data operation did not run through
an authenticated application-user session.

## Scope and checks

The target was `catalog_products.vertical = 'fashion'` with an empty
`image_urls` array. All 5,490 matches were drafts in the single Fashion
organization. They had no manual-review flag, no eBay item ID, and no active
Fashion row in `ebay_listing_channels`. A repeatable-read before-image was
captured, and its row count and `id:updatedAt` hash were checked again inside
the update transaction. The transaction rolled back on any mismatch.

After the transaction, the database reported 5,490 deleted image-missing rows,
zero non-deleted Fashion rows with an empty image array, and 5,490 recent audit
entries. The operation did not change `listing_records`,
`ebay_listing_channels`, `ebay_published_listings`, inventory data, or eBay.

Read-only checks also found 4,727 active published-listing mirror rows with
matching organization and SKU, and 663 Fashion `listing_records` with a
non-empty `itemPhotoUrl` and matching organization/SKU. These related rows were
left untouched; SKU matching alone does not prove that a mirror row belongs to
the same catalog product. No marketplace listings were ended or withdrawn.

## Before-image and rollback

- Server path: `/home/ubuntu/backups/fashion-no-images-2026-11-09/before-catalog-soft-delete.jsonl.gz`
- Rows: 5,490 full `catalog_products` before-images
- File mode: `0600`; parent directory mode: `0700`
- Size: 879,902 bytes
- SHA-256: `db8f0123ebd206dd6c6205485cd9b8b3af3596a15a81e553da06cfbc3641a35c`
- Target-set baseline hash: `71a1f2adad072fa0e68b904fabb42d50`

If restoration is needed, first check each product for subsequent legitimate
changes. Restore only the prior lifecycle status for verified rows; do not
replace whole rows from the before-image or roll back newer catalog edits.

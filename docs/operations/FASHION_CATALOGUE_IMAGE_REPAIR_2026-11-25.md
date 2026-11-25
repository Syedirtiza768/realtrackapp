# Fashion catalogue image repair (2026-11-24/25)

Scope: all 22,112 non-deleted fashion products (`catalog_products.vertical = 'fashion'`) and their
146,626 `image_urls` entries. Goal: every product has at least two photos, none of them seller
promo images (framed 800x800 PNGs), and no placeholder ("image not available") images.

## What was done

1. **Screen.** Every image was fetched through a short-lived signed S3 URL, and its dimensions, byte
   size and 64-bit difference hash recorded. Live products (9,609) were screened first, then the
   drafts, split between the backend container and a PC. Coverage is complete: 146,626 of 146,626.
2. **Framed 800x800 PNGs (794 images).** All sampled ones (60) were Artistic Haul promos with a
   "30 days" / "GUARANTEED" frame. All 794 sat on products that had only that one photo.
3. **Single-image products (4,067 rewritten).** Each got a clean gallery of 2 to 24 photos:
   - 1,815 reused gallery sets already screened in the earlier fill run (vision, two passes);
   - 2,252 new galleries from the Artistic Haul eBay listings for the same SKU. 28,078 candidate
     photos were downloaded; 833 framed PNGs and 15 placeholders were dropped without review; 27,208
     were deduplicated within each SKU. Reference-matched and prior-verdict photos were settled
     without vision; 18,385 representatives went to two independent vision passes (114 agents).
     Any photo flagged by either pass was rejected.
   - Backup of every previous value: table `catalog_image_backup_20261125` (4,067 rows).
4. **Placeholders in multi-photo products.** Three products had one placeholder among real photos;
   the placeholder was removed (each keeps at least 11 photos). Backup rows added to the same table.
5. **`FA27-6265`.** Its catalogue photos were all placeholders. The matching The Fashion Story eBay
   listing has five clean photos; they were checked by eye and written to the product.

## Still open (41 products)

- **37 `AVP-` products whose galleries are placeholders only.** SellerPundit holds only the
  1,359-byte placeholder for 37 of 38 SKUs checked, and the one missing SKU is not on SellerPundit.
  The eBay source listings for the four `AVP-` SKUs that have one are also placeholders. No real
  photo is available from either source.
- **`AVP-WFC-2280-M`:** no image. SellerPundit's photos are placeholders.
- **`AVP-MFC-3115-L` and `AVP-WFC-3342`:** one real photo each. SellerPundit has only that same photo.
- **One product with no SKU** (id `1d5f1386-f60c-4d77-83dc-29dea47dff34`): one photo. Its eBay listing
  (item 377248541550) has two dress photos that look like the product, not yet identity-checked.

## Rollback

`catalog_image_backup_20261125` holds (id, sku, previous image_urls, backed_up_at) for every row
changed by this run. Restore a row by copying `image_urls` back from the backup.

## Caveats

- New galleries use eBay's public image host (`i.ebayimg.com`), the same as three pre-existing rows.
  The app's own image pipeline normally uses its own S3 copies; the variant-generation step may
  need checking for these rows.
- Live eBay listings were not changed by this run. Where a live eBay listing still shows the old
  photos, a separate eBay revision is needed.
- Credentials: the backend's AWS key was printed in session output during this run. Rotate it.

## Approval of self-check passes (2026-11-25)

- 2,808 draft fashion products that passed the self-check (app text-compliance rules, title, price,
  category, description, at least two photos) were approved through the app's own review action
  (`FashionListingsService.review`), recorded under `fashionadmin@realtrack.local` with authenticity
  confirmed as that reviewer's sign-off. Result: 2,808 approved, 0 failed; approved products 5,954 to 8,762.
- Not part of the self-check: vision check (needs OpenRouter credits), the eBay category/aspect
  check at publish time, and the authenticity judgement itself.
- The 80 failing drafts were left as drafts (brand mismatches, missing descriptions or prices,
  and 2 counterfeit-term blocks). The SKU list is in the self-check output.

## Incident: production write failures (2026-11-25, caused by a read-only check)

- A read-only self-check ran through the database pooler (transaction pooling), leaving read-only
  settings on pooled connections. The backend's writes failed for about 1 hour (about 70 errors/hour,
  order imports failing).
- Fixed by `RECONNECT` on the pooler's admin console (authorised by the user). Write errors stopped
  at the next poll.
- Rule: read-only checks connect straight to Postgres, never through the pooler.

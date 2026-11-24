# Fashion stores: auto-parts card cleanup and one-photo listing fill (2026-11-24)

Stores: Primewardrobeusa and The Fashion Story (both eBay US, fashion-only stores).
Operator requests (2026-11-24): remove the three auto-parts images appended to fashion listings;
check every listing on both stores; give every one-photo listing the rest of its photos from the
SKU's SellerPundit source, with no branding; run it in parallel.

## 1. Auto-parts New-condition cards

- Cause and code fix: see CHANGELOG "Auto-parts New-condition photos kept off fashion listings"
  (main `b1eec9fa`, deployed 2026-11-24 11:19 UTC as backend `main-20261124-b1eec9fa`).
- Affected listings were found by the eBay Picture Services keys of each store's hosted copies of
  F1-F3 (`ebay_hosted_images` rows whose `source_url` contains `new-condition-listing-images`).
  The cards were first hosted 2026-11-23 20:11 UTC (Primewardrobeusa) and 2026-11-24 00:35 UTC
  (The Fashion Story), so only listings published or revised after those times could carry them.
- 17 live listings carried all three (8 Primewardrobeusa, 9 The Fashion Story; all Inventory API
  offers). The cards were removed with an inventory-item PUT (canary first) and each listing was
  re-read through the Browse API.
- Full check: Trading `GetSellerList` over every active listing, 4,058 on Primewardrobeusa and
  7,231 on The Fashion Story. None carries the cards. 66 listings have another 1254x1254 photo;
  those are AI model shots of the product, not cards.

## 2. One-photo listing fill

- Scope: 3,630 active listings with exactly one photo (1,816 Primewardrobeusa, 1,814 The Fashion
  Story), 1,821 SKUs, all `AV…` / `FA…`.
- Source. The logged-in SellerPundit account only holds the "Artistic Haul DE" catalogue (`AVP-`
  SKUs); its catalogue, warehouse and search endpoints return nothing for these SKUs. Their full
  galleries are the live Artistic Haul eBay listings (the account SellerPundit manages; the
  SellerPundit dashboard shows exactly those listings and photos), read from
  `ebay_published_listings`. 1,817 of 1,821 SKUs have one; 4 SKUs have no source listing.
- Identity check: a source gallery is used only if one of its photos matches the listing's current
  photo by perceptual hash (dHash <= 10 of 64). Every used source matched at index 0.
- Branding removal ("no branding" = seller/store branding; the product's own logos and labels stay):
  - Artistic Haul company cards ("Backed by a global supply network…", "Artistic Haul is a
    subsidiary…", "We deal in luxury brands") matched against reference thumbnails (256-bit
    dHash; 5,415 copies, all within 10 bits, none between 10 and 70).
  - 800x800 PNG framed photos with "30 days / guaranteed" badges, card/S3 URLs, tiny images.
  - Two independent vision-agent passes over labelled contact sheets of every remaining candidate
    (578 + 152 sheets, 144 agents); a photo is dropped if either pass flags it. Both passes caught
    100% of the hash-identified cards; they also removed "How we verify items" cards, Artistic Haul
    size-guide charts and placeholders.
  - Lesson: a cross-SKU "same photo in >= 3 other SKUs = promo card" rule also removed genuine
    photos shared by size variants of one item (for example `AV22-5987` to `AV22-5990`). Those
    photos were re-admitted through the same vision screen; 2,122 were real product photos.
- Result (2026-11-24 11:33 to 11:53 UTC): 3,630 listings revised, 0 failures (3,628 via the Inventory
  API, 2 via Trading), about 27,400 photos added. Order: canary (840159869304, the reported listing),
  a 17-listing pilot, then 3,608 listings with 10 workers per store, then the 4 alias-SKU listings
  (`…-RT…` inventory SKUs on The Fashion Story, matched to their base SKU and reviewed by hand).
- Verification: a fresh `GetSellerList` sweep of both stores (11,289 active listings) matched all
  3,626 planned galleries exactly (photo count, current photo first, every planned photo present),
  found 0 listings with the cards and 0 listings with one photo; the last 4 were then re-read through
  the Browse API (8-9 photos each).
- Order: the listing's current photo stays first, then the source gallery order; at most 24 photos.
- Write path: Inventory API listings get an inventory-item PUT; Trading listings get
  `ReviseFixedPriceItem` with the full `PictureDetails`, one Trading call each. The run parks
  Trading listings when the app-wide Trading allowance falls to 1,000 remaining.
- Scripts, plans and backups: server `/home/ubuntu/realtrackapp-main-20261124-b1eec9fa/` and the
  backend container `/tmp/photofill/` (copy out before any container recreate).

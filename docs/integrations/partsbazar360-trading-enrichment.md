# PartsBazar360 — Trading API Enrichment Integration Guide

## Overview

The RealTrack API now exposes a **Trading API enrichment endpoint** that returns
the full eBay Trading API data for any published listing — including all gallery
images, the complete vehicle compatibility list (130+ rows), the styled HTML
description, and item specifics (MPN, OE/OEM numbers). This data is cached for
7 days and rate-limited to ~4,500 calls/day across all listings.

---

## Endpoints

### 1. Get Trading Enrichment for a Single Listing

```
GET /api/published-listings/:id/trading-enrichment
Authorization: Bearer <service-account-token>
```

**Path params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | The published listing UUID (same ID used in `/api/published-listings/:id`) |

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `organizationId` | UUID | auto-resolved | Organization scope (optional for service accounts) |
| `force` | `true`/`1` | `false` | Bypass cache and re-fetch from eBay |

**Response (200):**
```json
{
  "data": {
    "enrichedAt": "2026-07-29T03:30:00.000Z",
    "source": "trading_api",
    "imageUrls": [
      "https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/ngIAAeSwkNFo5llL/$_1.JPG",
      "https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/eXsAAeSwjmBo5llM/$_1.JPG"
    ],
    "compatibility": {
      "compatibleProducts": [
        {
          "compatibilityProperties": [
            { "name": "Year", "value": "2020" },
            { "name": "Make", "value": "Cadillac" },
            { "name": "Model", "value": "XT6" },
            { "name": "Trim", "value": "Premium Luxury Sport Utility 4-Door" },
            { "name": "Engine", "value": "3.6L 222Cu. In. V6 GAS DOHC Naturally Aspirated" }
          ]
        }
      ]
    },
    "description": "<style>...</style><div class=\"wrapper\">...</div>",
    "itemSpecifics": {
      "Brand": ["Cadillac"],
      "Manufacturer Part Number": ["9597375"],
      "OE/OEM Part Number": ["9597375"]
    }
  },
  "cached": true,
  "budget": {
    "used": 42,
    "remaining": 4458,
    "limit": 4500,
    "resetDate": "2026-07-29"
  }
}
```

**When `cached: false`:** The response took ~1.7s (live eBay API call).
When `cached: true`: The response took <10ms (DB read).

---

### 2. Check Budget Status

```
GET /api/published-listings/trading-enrichment/budget
Authorization: Bearer <service-account-token>
```

Returns the current daily rate-limit budget without making any eBay calls.

---

### 3. Pre-Enrich a Batch (Internal Use)

```
POST /api/published-listings/trading-enrichment/batch
Authorization: Bearer <service-account-token>
Content-Type: application/json

{
  "listingIds": ["uuid-1", "uuid-2", "uuid-3"],
  "force": false
}
```

Requires `published_listings.sync` permission. Pre-warms the cache for
multiple listings so PartsBazar360 pages load instantly.

---

## Integration Pattern for PartsBazar360 Listing Page

### Current Flow (no enrichment)

```
1. User clicks listing link
2. PartsBazar360 calls GET /api/published-listings/:id
3. Page renders with limited data (1 image, 6 MVL-verified fitments, no description)
```

### New Flow (with enrichment)

```
1. User clicks listing link
2. PartsBazar360 calls GET /api/published-listings/:id (returns immediately, ~50ms)
3. Page renders immediately with existing data (skeleton/above-the-fold)
4. PartsBazar360 fires GET /api/published-listings/:id/trading-enrichment IN PARALLEL
5. When enrichment returns (~10ms cached / ~1,700ms fresh):
   a. Merge additional images into gallery (7 total vs 1)
   b. Add "Seller-provided fitment" section below "MVL-verified fitment"
   c. Render full HTML description in Description tab
   d. Show MPN / OE/OEM numbers in Technical Details
```

### Frontend Implementation (React/Next.js example)

```tsx
function ListingPage({ listingId }) {
  // 1. Fetch base listing data (SSR or fast fetch)
  const { data: listing } = useQuery(
    ['listing', listingId],
    () => fetch(`/api/published-listings/${listingId}`).then(r => r.json()),
    { staleTime: 5 * 60 * 1000 }
  );

  // 2. Fire enrichment in parallel (don't block page render)
  const { data: enrichment } = useQuery(
    ['trading-enrichment', listingId],
    () => fetch(`/api/published-listings/${listingId}/trading-enrichment`).then(r => r.json()),
    {
      staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      cacheTime: 7 * 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  // 3. Merge data
  const images = enrichment?.data?.imageUrls?.length > (listing?.imageUrls?.length ?? 0)
    ? enrichment.data.imageUrls
    : listing?.imageUrls ?? [];

  const mvlCompatibility = listing?.compatibility; // MVL-verified (6 rows)
  const sellerCompatibility = enrichment?.data?.compatibility; // Seller-provided (130+ rows)

  const description = enrichment?.data?.description || listing?.description;
  const itemSpecifics = {
    ...(listing?.itemSpecifics ?? {}),
    ...(enrichment?.data?.itemSpecifics ?? {}),
  };

  return (
    <div>
      {/* Image gallery: show all images */}
      <ImageGallery images={images} />

      {/* Price, condition, seller info — from base listing */}
      <PriceBlock listing={listing} />

      {/* Compatibility section — two tiers */}
      <CompatibilitySection
        mvlVerified={mvlCompatibility?.compatibleProducts}
        sellerProvided={sellerCompatibility?.compatibleProducts}
      />

      {/* Description — from enrichment (rich HTML) */}
      <DescriptionBlock html={description} />

      {/* Technical details — merged specifics */}
      <TechnicalDetails specifics={itemSpecifics} />
    </div>
  );
}
```

---

## How to Display Compatibility (Two-Tier)

The key UX insight: **show both sources with clear labels**.

```
┌─────────────────────────────────────────────────┐
│ Vehicle compatibility                            │
│                                                  │
│ ✓ Verified fitment — MVL-verified               │
│ ┌───────────────────────────────────────────┐   │
│ │ 2006 Cadillac DTS  4.6L V8               │   │
│ │ 2007 Cadillac DTS  4.6L V8               │   │
│ │ 2008 Cadillac DTS  4.6L V8               │   │
│ │ 2009 Cadillac DTS  4.6L V8               │   │
│ │ 2010 Cadillac DTS  4.6L V8               │   │
│ │ 2011 Cadillac DTS  4.6L V8               │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ⓘ Seller-provided fitment (broader list)        │
│ ┌───────────────────────────────────────────┐   │
│ │ 2020 Cadillac XT6  3.6L V6  [Premium]    │   │
│ │ 2017 Cadillac ATS  2.0L L4  [Base]       │   │
│ │ 2013 Cadillac CTS  3.6L V6  [Luxury]     │   │
│ │ ... 127 more rows                        │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ Compatibility data: MVL = structured catalog.    │
│ Seller-provided = seller's eBay listing data.    │
│ OE number 9597375 is the ground truth.           │
└─────────────────────────────────────────────────┘
```

---

## How to Display Images

```tsx
// Merge: prefer enrichment images (higher count), fall back to base
const allImages = enrichment?.data?.imageUrls?.length > listing?.imageUrls?.length
  ? enrichment.data.imageUrls
  : listing?.imageUrls ?? [];

// Show image count badge
<GalleryBadge count={allImages.length} /> // "7 photos"
```

---

## How to Display Item Specifics

```tsx
// Merge: enrichment adds MPN/OE that base listing may not have
const specifics = {
  ...(listing?.itemSpecifics ?? {}),
  ...(enrichment?.data?.itemSpecifics ?? {}),
};

// Display as key-value pairs
{Object.entries(specifics).map(([key, values]) => (
  <tr>
    <td>{key}</td>
    <td>{values.join(', ')}</td>
  </tr>
))}
```

Expected output:
| Key | Value |
|-----|-------|
| Brand | Cadillac |
| Manufacturer Part Number | 9597375 |
| OE/OEM Part Number | 9597375 |

---

## How to Display Description

```tsx
// The Trading API description is full HTML with inline styles
// Render it in a sandboxed iframe or with DOMPurify
<div
  className="listing-description"
  dangerouslySetInnerHTML={{ __html: description }}
/>
```

Or use an iframe for full style isolation:
```tsx
<iframe
  srcDoc={description}
  sandbox=""
  style={{ width: '100%', border: 'none' }}
/>
```

---

## Performance Budget

| Scenario | Latency | Action |
|----------|---------|--------|
| Cache hit (enriched <7 days ago) | **<10ms** | Render immediately |
| Cache miss (first visit) | **~1,700ms** | Show skeleton, merge when ready |
| Budget exhausted | **<10ms** (stale cache) or **empty** | Graceful fallback |
| eBay API error | **<10ms** (stale cache) or **empty** | Graceful fallback |

**Target:** 95% of listing page views should hit cache (<10ms). The remaining
5% (new listings, weekly refresh) take ~1.7s but render base data immediately.

---

## Error Handling

```tsx
// Graceful degradation — never block the page on enrichment failure
const enrichment = useQuery(
  ['trading-enrichment', listingId],
  fetchEnrichment,
  {
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,                    // Only retry once
    retryDelay: 2000,            // 2s before retry
    refetchOnWindowFocus: false, // Don't re-fetch on tab switch
    onError: () => {},           // Silently fail — base data is sufficient
  }
);

// Always fall back to base listing data
const images = enrichment?.data?.imageUrls?.length
  ? enrichment.data.imageUrls
  : listing.imageUrls;
```

---

## Caching Strategy

### Client-side (PartsBazar360)
- React Query `staleTime: 7 days` — don't re-fetch if enriched in last 7 days
- `cacheTime: 7 days` — keep in memory cache
- `refetchOnWindowFocus: false` — don't re-fetch on tab switch

### Server-side (RealTrack)
- Cached in `raw_ebay_response.tradingEnrichment` JSONB column
- TTL: 7 days (auto-stale after that)
- Budget: 4,500 Trading API calls/day (resets at midnight UTC)
- Pre-enrichment: batch endpoint available for warming cache

---

## Rate Limit Budget

| Metric | Value |
|--------|-------|
| Daily Trading API budget | 4,500 calls |
| Average GetItem response time | ~1.7 seconds |
| Total daily enrichment capacity | 4,500 listings/day |
| Active listings in catalog | ~1,700 |
| Full catalog refresh time | ~48 minutes (at 1.7s/call) |
| Cache TTL | 7 days |

**Budget monitoring:**
```
GET /api/published-listings/trading-enrichment/budget
→ { "used": 42, "remaining": 4458, "limit": 4500 }
```

---

## Pre-Enrichment (Warming the Cache)

Before PartsBazar360 goes live with this integration, warm the cache:

```bash
# Get all active listing IDs
LISTING_IDS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.realtrackapp.com/api/published-listings?status=active&limit=200" \
  | jq '.items[].id')

# Pre-enrich in batches of 50
for batch in $(echo $LISTING_IDS | xargs -n50); do
  curl -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"listingIds\": [$batch]}" \
    "https://api.realtrackapp.com/api/published-listings/trading-enrichment/batch"
  sleep 60  # Rate-limit awareness
done
```

This ensures all listing pages load instantly from cache on first visit.

---

## API Authentication

PartsBazar360 uses the existing service account:
- **Email:** `api-published-listings@realtrack.local`
- **Role:** `api_published_listings_reader`
- **Permission:** `published_listings.view`
- **Token:** Same Bearer token used for existing `/api/published-listings` calls

No new credentials or permissions needed. The enrichment endpoint inherits
the `published_listings.view` permission from the controller class.

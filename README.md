# ListingPro AI Prototype

This is the high-fidelity React prototype for the AI-Powered Motor Parts Listing Platform.

## 🚀 Getting Started

The project structure is set up, but dependencies need to be installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```

## 🏗️ Implemented Views
- **Dashboard**: Operational command center with mocked data.
- **Listing Editor**: AI-assisted listing creation with split-pane preview (eBay/Shopify).
- **Fitment Manager**: Compatibility table with confidence scores.
- **Catalog**: Enterprise-style automotive search + faceted discovery view.

## 🔍 Catalog Upgrade (Automotive Search v2)

The catalog now includes a production-oriented search and filtering layer while keeping the same route (`/catalog`) and preserving existing app flows.

### Implemented Search Enhancements
- Year / Make / Model / Trim compatibility selector
- VIN lookup module (sample decode map)
- ePID + K-Type exact compatibility support
- Guaranteed Fit badge and filter
- Predictive suggestions on search input
- Synonym dictionary support (e.g. bumper ↔ fascia, tail light ↔ rear lamp)
- Fuzzy matching for misspellings
- OEM / aftermarket / SKU part-number recognition and relevance boost
- Attribute-aware relevance (brand + placement)
- Popularity-weighted ranking

### Implemented Dynamic Facets
- Multi-select facets with dynamic counts
- Brand, condition, placement, availability, shipping type, seller rating
- Price range controls
- Real-time updates on every filter/search change
- URL state sync for deep linking

### Implemented UI Modernization
- Grid/List toggle
- Compatibility status badge (Verified Fit / Check Fit)
- Quick View modal
- Compare queue (up to 4 items)
- Watchlist toggle
- B2B bulk selection + bulk add action bar
- Lazy-loaded listing images
- SEO-style product URLs (`/catalog/{slug}-{sku}`)

## 🧱 Data Integration Notes

- A normalized catalog schema is implemented in `src/types/catalog.ts`.
- Sample inventory is structured in `src/data/inventory.ts` for compatibility-indexable records.
- Generated import output is written to `src/data/generatedInventory.ts`.
- Fields are searchable by SKU, brand, OEM and aftermarket part numbers.
- Source profile reference: `B12_p2_eBay_Verified.xlsx`.

### Import Excel Inventory

Run the importer with default or explicit file path:

```bash
npm run import:inventory
```

```bash
npm run import:inventory -- "C:\Users\Irtiza Hassan\Downloads\B12_p2_eBay_Verified.xlsx"
```

Behavior:
- Import script normalizes rows and groups fitment by SKU.
- Catalog automatically uses generated data when `generatedInventory.ts` has records.
- If generated data is empty, catalog falls back to built-in seed data.

## ⚙️ Production Architecture Rollout (No-Downtime)

Recommended backend rollout path (compatible with current UI/API behavior):

1. **Dual-read search layer**
	- Keep current API contract as v1.
	- Introduce `/api/v2/search` for OpenSearch-backed queries.
	- Mirror v1 payload shape during migration.

2. **Index + compatibility model**
	- Build document index containing normalized product + compatibility tokens.
	- Store YMMT, VIN decode attributes, ePID, K-Type as queryable fields.

3. **Caching and sync**
	- Add Redis result caching for hot search/facet combinations.
	- Use event-driven inventory sync for near real-time quantity/availability.

4. **Safe migration strategy**
	- Backfill index from existing DB (read-only migration first).
	- Enable canary traffic split by percentage.
	- Promote gradually after latency and relevance validation.

5. **Rollback strategy**
	- Feature-flag all v2 endpoints.
	- Keep v1 query path live and switch traffic back instantly if needed.
	- Avoid destructive schema changes until v2 passes SLO windows.

## 🧩 Enterprise Platform Blueprint

For full coverage of image ingestion, AI enrichment, fitment extraction, catalog normalization,
multi-channel sync, inventory events, dashboard analytics, and extensible adapters, see:

- `docs/enterprise-platform-architecture.md`

Core TypeScript scaffolding added for implementation:

- `src/types/platform.ts`
- `src/lib/ingestionPipeline.ts`
- `src/lib/channelAdapters.ts`
- `src/lib/inventorySync.ts`
- `src/lib/fitmentSearch.ts`

### Ingestion Provider Switch

The ingestion flow supports provider selection via Vite env vars:

- `VITE_INGESTION_PROVIDER=mock` (default)
- `VITE_INGESTION_PROVIDER=api`
- `VITE_INGESTION_API_BASE_URL=https://your-api-host` (required when provider is `api`)
- `VITE_INGESTION_HEALTH_PATH=/v1/health/ingestion` (optional)

Expected API endpoints for `api` provider:

- `POST /v1/vision/identify`
- `POST /v1/enrichment/generate`

## 🎨 Design System
- **Framework**: Tailwind CSS (Dark Mode default)
- **Icons**: Lucide React
- **Font**: Inter (via Google Fonts/System)

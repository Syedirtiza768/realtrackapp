/* ── Advanced Search Query DTO ─────────────────────────────
 *  Supports full-text search, multi-select filters, range
 *  filters, boolean logic, sorting, and pagination.
 * ────────────────────────────────────────────────────────── */

export class SearchQueryDto {
  /* ── Pagination ───────────────────────────────────────── */
  limit?: number;          // default 60, max 200
  offset?: number;         // default 0
  cursor?: string;         // for infinite-scroll cursor-based paging

  /* ── Full-text search ─────────────────────────────────── */
  q?: string;              // main search query (FTS + fuzzy)
  exactSku?: string;       // exact SKU match (priority)

  /* ── Multi-select filters (comma-separated values) ───── */
  brands?: string;         // "Mercedes-Benz,BMW,Porsche"
  categories?: string;     // "33643,33644" (category IDs)
  categoryNames?: string;  // "Brake Pads,Brake Rotors"
  conditions?: string;     // "1000,1500,3000"
  types?: string;          // cType multi-select
  sourceFiles?: string;    // source file names
  formats?: string;        // listing format (FixedPrice, Auction...)
  locations?: string;      // item locations
  mpns?: string;           // manufacturer part numbers

  /* ── Range filters ────────────────────────────────────── */
  minPrice?: number;
  maxPrice?: number;

  /* ── Boolean filters ──────────────────────────────────── */
  hasImage?: string;       // '1' = only with images
  hasPrice?: string;       // '1' = only with price

  /* ── Filter logic ─────────────────────────────────────── */
  filterMode?: 'and' | 'or'; // default 'and'

  /* ── Sorting ──────────────────────────────────────────── */
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' |
         'title_asc' | 'title_desc' | 'sku_asc';
}

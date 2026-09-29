/* -- Advanced Search Query DTO -----------------------------
 *  Supports full-text search, multi-select filters, range
 *  filters, boolean logic, sorting, and pagination.
 * ---------------------------------------------------------- */

import { IsOptional, IsInt, IsString, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sortable modes. Every catalog table column has an `_asc` / `_desc` pair;
 * `newest` / `oldest` are the Date Added pair and `relevance` is only
 * meaningful alongside a text query.
 */
export const SEARCH_SORT_MODES = [
  'relevance',
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
  'title_asc',
  'title_desc',
  'sku_asc',
  'sku_desc',
  'team_asc',
  'team_desc',
  'condition_asc',
  'condition_desc',
  'stock_asc',
  'stock_desc',
  'status_asc',
  'status_desc',
  'ebay_asc',
  'ebay_desc',
  'image_asc',
  'image_desc',
] as const;

export type SearchSortMode = (typeof SEARCH_SORT_MODES)[number];

export class SearchQueryDto {
  /* -- Pagination ----------------------------------------- */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number; // default 60, max 500

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number; // default 0

  @IsOptional()
  @IsString()
  cursor?: string; // for infinite-scroll cursor-based paging

  /* -- Full-text search ----------------------------------- */
  @IsOptional()
  @IsString()
  q?: string; // main search query (FTS + fuzzy)

  @IsOptional()
  @IsString()
  exactSku?: string; // exact SKU match (priority)

  /* -- Multi-select filters (comma-separated values) ----- */
  @IsOptional()
  @IsString()
  brands?: string; // "Mercedes-Benz,BMW,Porsche"

  @IsOptional()
  @IsString()
  categories?: string; // "33643,33644" (category IDs)

  @IsOptional()
  @IsString()
  categoryNames?: string; // "Brake Pads,Brake Rotors"

  @IsOptional()
  @IsString()
  conditions?: string; // "1000,1500,3000"

  @IsOptional()
  @IsString()
  types?: string; // cType multi-select

  @IsOptional()
  @IsString()
  sourceFiles?: string; // source file names

  @IsOptional()
  @IsString()
  formats?: string; // listing format (FixedPrice, Auction...)

  @IsOptional()
  @IsString()
  locations?: string; // item locations

  @IsOptional()
  @IsString()
  mpns?: string; // manufacturer part numbers

  /* -- Pipeline job / marketplace filters ----------------- */
  @IsOptional()
  @IsString()
  pipelineJobIds?: string; // comma-separated pipeline job UUIDs

  @IsOptional()
  @IsString()
  marketplaces?: string; // comma-separated: "US,DE"

  @IsOptional()
  @IsString()
  teamIds?: string; // comma-separated team UUIDs

  /* -- Vehicle make/model filters (comma-separated names) - */
  @IsOptional()
  @IsString()
  makes?: string; // make names: "Audi,BMW,Mercedes-Benz"

  @IsOptional()
  @IsString()
  models?: string; // model names: "A4,Q7,X6"

  /* -- Range filters -------------------------------------- */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  /* -- Boolean filters ------------------------------------ */
  @IsOptional()
  @IsString()
  hasImage?: string; // '1' = only with images

  @IsOptional()
  @IsString()
  hasPrice?: string; // '1' = only with price

  /** Comma-separated catalog workflow statuses: published, ready_to_publish, need_images */
  @IsOptional()
  @IsString()
  catalogStatus?: string;

  /** Stock tier: in_stock | out_of_stock | low_stock (comma-separated) */
  @IsOptional()
  @IsString()
  stockLevel?: string;

  /** Comma-separated shipping profile names */
  @IsOptional()
  @IsString()
  shippingProfiles?: string;

  /** Imported-at range (ISO date YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  importedFrom?: string;

  @IsOptional()
  @IsString()
  importedTo?: string;

  /* -- Filter logic --------------------------------------- */
  @IsOptional()
  @IsIn(['and', 'or'])
  filterMode?: 'and' | 'or'; // default 'and'

  /**
   * '1' = collapse marketplace/SKU siblings into a single row server-side.
   * One row per customLabelSku (rows without a SKU stay individual), with all
   * sibling marketplaces aggregated into `marketplaces`. Makes `total` and
   * pagination reflect unique SKUs instead of raw listing rows. Used by the
   * catalog grid; other callers omit it and get raw rows unchanged.
   */
  @IsOptional()
  @IsString()
  groupBySku?: string;

  /* -- Sorting -------------------------------------------- */
  @IsOptional()
  @IsIn(SEARCH_SORT_MODES)
  sort?: SearchSortMode;
}

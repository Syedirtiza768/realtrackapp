/* ── Advanced Search Query DTO ─────────────────────────────
 *  Supports full-text search, multi-select filters, range
 *  filters, boolean logic, sorting, and pagination.
 * ────────────────────────────────────────────────────────── */

import { IsOptional, IsInt, IsString, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  /* ── Pagination ───────────────────────────────────────── */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;          // default 60, max 200

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;         // default 0

  @IsOptional() @IsString()
  cursor?: string;         // for infinite-scroll cursor-based paging

  /* ── Full-text search ─────────────────────────────────── */
  @IsOptional() @IsString()
  q?: string;              // main search query (FTS + fuzzy)

  @IsOptional() @IsString()
  exactSku?: string;       // exact SKU match (priority)

  /* ── Multi-select filters (comma-separated values) ───── */
  @IsOptional() @IsString()
  brands?: string;         // "Mercedes-Benz,BMW,Porsche"

  @IsOptional() @IsString()
  categories?: string;     // "33643,33644" (category IDs)

  @IsOptional() @IsString()
  categoryNames?: string;  // "Brake Pads,Brake Rotors"

  @IsOptional() @IsString()
  conditions?: string;     // "1000,1500,3000"

  @IsOptional() @IsString()
  types?: string;          // cType multi-select

  @IsOptional() @IsString()
  sourceFiles?: string;    // source file names

  @IsOptional() @IsString()
  formats?: string;        // listing format (FixedPrice, Auction...)

  @IsOptional() @IsString()
  locations?: string;      // item locations

  @IsOptional() @IsString()
  mpns?: string;           // manufacturer part numbers

  /* ── Range filters ────────────────────────────────────── */
  @IsOptional() @Type(() => Number) @Min(0)
  minPrice?: number;

  @IsOptional() @Type(() => Number) @Min(0)
  maxPrice?: number;

  /* ── Boolean filters ──────────────────────────────────── */
  @IsOptional() @IsString()
  hasImage?: string;       // '1' = only with images

  @IsOptional() @IsString()
  hasPrice?: string;       // '1' = only with price

  /* ── Filter logic ─────────────────────────────────────── */
  @IsOptional() @IsIn(['and', 'or'])
  filterMode?: 'and' | 'or'; // default 'and'

  /* ── Sorting ──────────────────────────────────────────── */
  @IsOptional() @IsIn(['relevance', 'price_asc', 'price_desc', 'newest', 'title_asc', 'title_desc', 'sku_asc'])
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' |
         'title_asc' | 'title_desc' | 'sku_asc';
}

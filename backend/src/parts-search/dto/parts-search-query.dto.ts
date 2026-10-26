import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Bounds mirror PartsBazar360's `SearchQueryDto`
 * (apps/api/src/modules/search/v1/search-query.dto.ts) so bad input is
 * rejected here instead of being forwarded. Keep the two in step.
 */
export const PARTS_SEARCH_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'best_condition',
] as const;
export const PARTS_SEARCH_PAGE_SIZES = [24, 48, 72] as const;
export const PARTS_SEARCH_MAX_QUERY_LENGTH = 200;
export const PARTS_SEARCH_MAX_PAGE = 400;
const MAX_LIST_ITEMS = 25;

/** `a,b` or repeated params → bounded, de-duplicated string[]. */
function toStringArray(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const item = String(raw ?? '').trim().slice(0, 120);
    if (item && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out.length ? out : undefined;
}

function toBool(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return undefined;
}

const LIST_FIELDS = [
  'category',
  'brand',
  'make',
  'model',
  'partType',
  'condition',
  'seller',
  'sourceTag',
] as const;

export class PartsSearchQueryDto {
  @ApiPropertyOptional({ maxLength: PARTS_SEARCH_MAX_QUERY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(PARTS_SEARCH_MAX_QUERY_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  category?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  brand?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  make?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  model?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  partType?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  condition?: string[];

  /** Seller filter — only meaningful with the internal (keyed) PartsBazar360 search. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  seller?: string[];

  /** Source-tag filter (BLK, SAL, …) — internal search only. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @Transform(({ value }) => toStringArray(value))
  sourceTag?: string[];

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2049)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  priceMax?: number;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => toBool(value)) @IsBoolean()
  hasImage?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => toBool(value)) @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @Transform(({ value }) => toBool(value)) @IsBoolean()
  includeInterchange?: boolean;

  @ApiPropertyOptional({ enum: PARTS_SEARCH_SORTS })
  @IsOptional() @IsIn(PARTS_SEARCH_SORTS)
  sort?: (typeof PARTS_SEARCH_SORTS)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: PARTS_SEARCH_MAX_PAGE })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PARTS_SEARCH_MAX_PAGE)
  page?: number;

  @ApiPropertyOptional({ enum: PARTS_SEARCH_PAGE_SIZES })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(PARTS_SEARCH_PAGE_SIZES as unknown as number[])
  pageSize?: number;
}

export class PartsSearchSuggestDto {
  @ApiPropertyOptional({ maxLength: PARTS_SEARCH_MAX_QUERY_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(PARTS_SEARCH_MAX_QUERY_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}

/**
 * Flatten a validated DTO into upstream query params. Lists are sent as
 * repeated params (not comma-joined) so a value that itself contains a comma
 * survives. `seller`/`sourceTag` are dropped for the public audience, where
 * PartsBazar360 does not expose them.
 */
export function toUpstreamParams(
  dto: PartsSearchQueryDto,
  audience: 'internal' | 'public',
): Array<[string, string]> {
  const params: Array<[string, string]> = [];
  if (dto.q) params.push(['q', dto.q]);
  for (const field of LIST_FIELDS) {
    if (audience === 'public' && (field === 'seller' || field === 'sourceTag')) continue;
    for (const value of dto[field] ?? []) params.push([field, value]);
  }
  const scalars: Array<keyof PartsSearchQueryDto> = [
    'year',
    'priceMin',
    'priceMax',
    'hasImage',
    'inStock',
    'includeInterchange',
    'sort',
    'page',
    'pageSize',
  ];
  for (const key of scalars) {
    const value = dto[key];
    if (value !== undefined && value !== null) params.push([key, String(value)]);
  }
  return params;
}

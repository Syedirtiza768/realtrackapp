import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const STOCK_LEVELS = ['in_stock', 'low_stock', 'out_of_stock'] as const;

/** Sortable inventory table columns; each has an `_asc` / `_desc` pair. */
export const INVENTORY_SORT_COLUMNS = [
  'image',
  'sku',
  'brand',
  'location',
  'team',
  'fitments',
  'validation',
  'price',
  'status',
  'enrichment',
  'catalog',
] as const;

export const INVENTORY_SORT_MODES = INVENTORY_SORT_COLUMNS.flatMap((c) => [
  `${c}_asc` as const,
  `${c}_desc` as const,
]);

export type InventorySortMode = (typeof INVENTORY_SORT_MODES)[number];

export class InventoryListingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  missingImages?: boolean;

  /* ── Advanced filters ─────────────────────────────────── */

  @IsOptional()
  @IsDateString()
  dateAddedFrom?: string;

  @IsOptional()
  @IsDateString()
  dateAddedTo?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /* ── Multi-select filters (comma-separated values) ────── */

  @IsOptional()
  @IsString()
  brands?: string;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsString()
  teamIds?: string;

  @IsOptional()
  @IsString()
  locations?: string;

  @IsOptional()
  @IsString()
  marketplaces?: string;

  @IsOptional()
  @IsString()
  stockLevel?: string;

  /* ── Range filters ────────────────────────────────────── */

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWeight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  /** '1' = only parts that have a price (mirrors the catalog `hasPrice` filter). */
  @IsOptional()
  @IsIn(['1'])
  hasPrice?: string;

  /** `<column>_<asc|desc>`; unset = newest first. Ignored by the facets endpoint. */
  @IsOptional()
  @IsIn(INVENTORY_SORT_MODES)
  sort?: InventorySortMode;
}

export class InventoryPartLookupDto {
  @IsUUID()
  listingId!: string;
}

export class InventoryBulkPartLookupDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

export class InventoryEnrichDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

export class UpdateListingImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imageUrls!: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  uploadedAssetIds?: string[];
}

export class ReorderImagesDto {
  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];
}

export class UpdateDonorVehicleDto {
  @IsOptional()
  @IsString()
  donorVin?: string;

  @IsOptional()
  @IsString()
  donorYear?: string;

  @IsOptional()
  @IsString()
  donorMake?: string;

  @IsOptional()
  @IsString()
  donorModel?: string;
}

export class InventoryInlineEnrichDto {
  @IsUUID()
  listingId!: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class InventorySendToCatalogDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

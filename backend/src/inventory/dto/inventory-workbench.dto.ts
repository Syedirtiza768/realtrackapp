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

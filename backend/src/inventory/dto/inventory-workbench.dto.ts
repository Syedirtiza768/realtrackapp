import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @Max(100)
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

export class InventoryInlineEnrichDto {
  @IsUUID()
  listingId!: string;
}

export class InventorySendToCatalogDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

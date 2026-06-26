import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

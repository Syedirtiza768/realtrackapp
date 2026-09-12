import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsJSON,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const SORTS = [
  'relevance',
  'newest',
  'updated',
  'title_asc',
  'title_desc',
  'sku_asc',
  'price_asc',
  'price_desc',
] as const;

export type CatalogSort = (typeof SORTS)[number];

export class CatalogQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  brands?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  categories?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  types?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceFiles?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  formats?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locations?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  mpns?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  teamIds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  marketplaces?: string;

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
  @IsIn(['0', '1'])
  hasImage?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  hasPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stockLevel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  shippingProfiles?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  catalogStatus?: string;

  @IsOptional()
  @IsISO8601()
  importedFrom?: string;

  @IsOptional()
  @IsISO8601()
  importedTo?: string;

  /** JSON object whose keys are vertical attribute names and values are strings or arrays. */
  @IsOptional()
  @IsJSON()
  @MaxLength(10000)
  attributes?: string;

  @IsOptional()
  @IsIn(SORTS)
  sort?: CatalogSort;
}

export class CatalogSuggestQueryDto {
  @IsString()
  @MaxLength(200)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class CatalogProductPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mpn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  conditionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conditionLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @IsString({ each: true })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true },
  )
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  categoryName?: string;

  @IsOptional()
  @IsObject()
  verticalAttributes?: Record<string, unknown>;
}

export class CatalogBulkIdsDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  productIds!: string[];
}

export class CatalogBulkTeamDto extends CatalogBulkIdsDto {
  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}

export class CatalogBulkPoliciesDto extends CatalogBulkIdsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shippingProfile?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentProfile?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  returnProfile?: string | null;
}

export class CatalogExportDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogQueryDto)
  query?: CatalogQueryDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50000)
  @IsUUID(undefined, { each: true })
  productIds?: string[];
}

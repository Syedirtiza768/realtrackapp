import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListingsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset?: number;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  sku?: string;

  @IsOptional() @IsString()
  categoryId?: string;

  @IsOptional() @IsString()
  categoryName?: string;

  @IsOptional() @IsString()
  brand?: string;

  @IsOptional() @IsString()
  cType?: string;

  @IsOptional() @IsString()
  conditionId?: string;

  @IsOptional() @IsString()
  sourceFile?: string;

  @IsOptional() @IsString()
  hasImage?: string; // '1' = only with images
}

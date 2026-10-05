import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsBoolean,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES } from './business-industrial.config.js';

const categoryFamilyIds = BUSINESS_INDUSTRIAL_CATEGORY_FAMILIES.map(
  (family) => family.id,
) as string[];

export class CreateBusinessIndustrialImageIntakeJobDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  sourceRootName!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  sourceReferenceUrl?: string;
}

export class CreateBusinessIndustrialDriveIntakeJobDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  folderUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxItems?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  skipFolderNames?: string[];

  @IsOptional()
  @IsBoolean()
  autoCreateDrafts?: boolean;
}

export class ApplyBusinessIndustrialImageIntakeGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sku?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
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
  model?: string;

  @IsOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  conditionId?: string;

  @IsString()
  @MaxLength(200)
  mpn?: string;

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
  @IsIn(categoryFamilyIds)
  categoryFamily?: string;

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

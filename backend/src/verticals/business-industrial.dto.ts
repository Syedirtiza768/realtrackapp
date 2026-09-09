import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BusinessIndustrialUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  serialNumberPrivate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumberPublic?: string;
}

export class CreateBusinessIndustrialDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  mpn?: string;

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
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsObject()
  verticalAttributes!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BusinessIndustrialUnitDto)
  units?: BusinessIndustrialUnitDto[];
}

export class UpdateBusinessIndustrialDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  mpn?: string;

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
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsObject()
  verticalAttributes?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BusinessIndustrialUnitDto)
  units?: BusinessIndustrialUnitDto[];
}

export class BusinessIndustrialReviewDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsBoolean()
  provenanceConfirmed!: boolean;

  @IsBoolean()
  specificationsVerified!: boolean;

  @IsBoolean()
  testingReviewed!: boolean;

  @IsOptional()
  @IsBoolean()
  restrictedCategoryCleared?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  evidenceKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  riskFlags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BusinessIndustrialRoleDto {
  @IsIn(['business_industrial_admin', 'business_industrial_manager', 'business_industrial_operator'])
  role!: 'business_industrial_admin' | 'business_industrial_manager' | 'business_industrial_operator';
}

export class BusinessIndustrialQuarantineDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class BusinessIndustrialInviteDto extends BusinessIndustrialRoleDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  storeIds?: string[];
}

export class BusinessIndustrialStoreAccessDto {
  @IsUUID()
  storeId!: string;

  @IsIn(['view', 'operate', 'admin'])
  accessLevel!: 'view' | 'operate' | 'admin';
}

export class BusinessIndustrialIncidentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalEventId!: string;

  @IsUUID()
  catalogProductId!: string;

  @IsIn(['counterfeit', 'intellectual_property', 'product_safety', 'recalled_product', 'other'])
  incidentType!: 'counterfeit' | 'intellectual_property' | 'product_safety' | 'recalled_product' | 'other';

  @IsBoolean()
  verified!: boolean;

  @IsOptional()
  @IsISO8601()
  eventOccurredAt?: string;

  @IsOptional()
  @IsObject()
  eventPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}

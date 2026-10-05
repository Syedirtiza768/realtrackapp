import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
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
  IsUrl,
  Max,
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
  @MaxLength(20000)
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

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
  @IsString()
  @MaxLength(200)
  optimizedTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  optimizedDescription?: string;

  @IsOptional()
  @IsObject()
  optimizationPayload?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  seoScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  readinessScore?: number;

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
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

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
  @MaxLength(5000)
  notes?: string;
}

export class BusinessIndustrialRoleDto {
  @IsIn([
    'business_industrial_admin',
    'business_industrial_manager',
    'business_industrial_operator',
  ])
  role!:
    | 'business_industrial_admin'
    | 'business_industrial_manager'
    | 'business_industrial_operator';
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
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  storeIds?: string[];
}

export class BusinessIndustrialUserCreateDto extends BusinessIndustrialRoleDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  storeIds?: string[];
}

export class BusinessIndustrialStoreAssignmentsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  storeIds!: string[];

  @IsOptional()
  @IsIn(['view', 'operate', 'admin'])
  accessLevel?: 'view' | 'operate' | 'admin';
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

  @IsIn([
    'counterfeit',
    'intellectual_property',
    'product_safety',
    'recalled_product',
    'other',
  ])
  incidentType!:
    | 'counterfeit'
    | 'intellectual_property'
    | 'product_safety'
    | 'recalled_product'
    | 'other';

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

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFashionDraftDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sku!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  verticalAttributes!: Record<string, unknown>;
}

export class UpdateFashionDraftDto extends PartialType(CreateFashionDraftDto) {
  @ApiPropertyOptional({ enum: ['draft', 'needs_review'] })
  @IsOptional()
  @IsIn(['draft', 'needs_review'])
  verticalValidationStatus?: 'draft' | 'needs_review';
}

export class FashionReviewDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @ApiProperty()
  @IsBoolean()
  authenticityConfirmed!: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FashionRoleDto {
  @ApiProperty({
    enum: ['fashion_admin', 'fashion_manager', 'fashion_operator'],
  })
  @IsIn(['fashion_admin', 'fashion_manager', 'fashion_operator'])
  role!: 'fashion_admin' | 'fashion_manager' | 'fashion_operator';
}
export class FashionStoreConfigDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class FashionUserCreateDto extends FashionRoleDto {
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
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  storeIds?: string[];
}

export class FashionStoreAccessDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  storeIds!: string[];
  @IsOptional()
  @IsIn(['view', 'operate', 'admin'])
  accessLevel?: 'view' | 'operate' | 'admin';
}

export class AnalyzeFashionImagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsString({ each: true })
  imageUrls!: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  currentAttributes?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  confirmedKeys?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentBrand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  titleConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  descriptionConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  marketplaceId?: string;
}

export class GenerateFashionListingDto {
  @ApiProperty({ type: Object })
  @IsObject()
  verticalAttributes!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  conditionLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  titleConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  descriptionConfirmed?: boolean;
}

/* ── Quick capture intake ─────────────────────────────────────────── */

const BATCH_PATTERN = /^[A-Za-z0-9]{1,20}$/;
const SIZE_SUFFIX_PATTERN = /^[A-Za-z0-9]{1,8}$/;

export class FashionWarehouseDto {
  @ApiProperty({ example: 'PAK_KHI' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/, {
    message: 'Warehouse code may use letters, numbers, _ and - (max 40).',
  })
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'PK' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'Country must be a 2-letter ISO code.' })
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateFashionWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/, { message: 'Country must be a 2-letter ISO code.' })
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class NextFashionSkuDto {
  @ApiProperty({ example: 'AVP' })
  @IsString()
  @Matches(BATCH_PATTERN, {
    message: 'Batch must be 1–20 letters or numbers.',
  })
  batch!: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  @Matches(SIZE_SUFFIX_PATTERN, {
    message: 'Size suffix must be 1–8 letters or numbers.',
  })
  sizeSuffix?: string;
}

export class FashionSizeChartDto {
  @ApiProperty({ example: 'tshirt' })
  @IsString()
  @MaxLength(40)
  template!: string;

  @ApiProperty({ enum: ['cm', 'in'] })
  @IsIn(['cm', 'in'])
  unit!: 'cm' | 'in';

  @ApiProperty({ type: Object, example: { shoulderMeasurement: '19' } })
  @IsObject()
  values!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Store name shown in the chart header.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  brandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  sku?: string;
}

export class FashionImageBannerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  imageUrl!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  text!: string;

  @ApiProperty({ enum: ['top', 'bottom'] })
  @IsIn(['top', 'bottom'])
  position!: 'top' | 'bottom';

  @ApiProperty({ enum: ['dark', 'brand', 'light'] })
  @IsIn(['dark', 'brand', 'light'])
  theme!: 'dark' | 'brand' | 'light';
}

export class CreateFashionIntakeDto {
  @ApiProperty({ example: 'AVP-10001-M' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  sku!: string;

  @ApiPropertyOptional({ example: 'AVP' })
  @IsOptional()
  @IsString()
  @Matches(BATCH_PATTERN, {
    message: 'Batch must be 1–20 letters or numbers.',
  })
  batch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  warehouseCode?: string;

  @ApiPropertyOptional({ example: '3000' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  conditionId?: string;

  @ApiPropertyOptional({ example: 'Unisex' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  department?: string;

  @ApiPropertyOptional({ enum: ['clothing', 'footwear', 'accessories'] })
  @IsOptional()
  @IsIn(['clothing', 'footwear', 'accessories'])
  categoryFamily?: 'clothing' | 'footwear' | 'accessories';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  labelSize?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  frontImageUrl!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  backImageUrl!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  tagImageUrls!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(13)
  @IsString({ each: true })
  additionalImageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sizeChartImageUrl?: string;

  @ApiPropertyOptional({ example: 'tshirt' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sizeChartTemplate?: string;

  @ApiPropertyOptional({ enum: ['cm', 'in'] })
  @IsOptional()
  @IsIn(['cm', 'in'])
  measurementsUnit?: 'cm' | 'in';

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  measurementValues?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  quantity?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  identify?: boolean;
}

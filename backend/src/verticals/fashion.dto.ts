import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

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
  @ApiProperty({ enum: ['fashion_admin', 'fashion_manager', 'fashion_operator'] })
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

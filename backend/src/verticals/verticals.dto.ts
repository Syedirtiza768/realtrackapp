import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PRODUCT_VERTICALS, type ProductVertical } from './vertical.types.js';

export class UpdateStoreVerticalConfigDto {
  @ApiPropertyOptional({ enum: PRODUCT_VERTICALS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PRODUCT_VERTICALS, { each: true })
  enabledVerticals?: ProductVertical[];

  @ApiPropertyOptional({ enum: PRODUCT_VERTICALS })
  @IsOptional()
  @IsEnum(PRODUCT_VERTICALS)
  defaultVertical?: ProductVertical;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  workflows?: Record<string, Record<string, unknown>>;
}

export class CreateFamilyDto {
  @ApiProperty()
  @IsUUID()
  catalogProductId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty({ enum: PRODUCT_VERTICALS })
  @IsEnum(PRODUCT_VERTICALS)
  vertical!: ProductVertical;
}

export class CreateVariantDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionId?: string;
}

export class CreateVariantMappingDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty()
  @IsString()
  marketplaceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventorySku?: string;
}

export class PublishVariantFamilyDto {
  @ApiProperty()
  @IsUUID()
  storeId!: string;

  @ApiProperty()
  @IsUUID()
  ebayAccountId!: string;

  @ApiProperty()
  @IsString()
  marketplaceId!: string;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  merchantLocationKey!: string;

  @ApiProperty()
  @IsString()
  fulfillmentPolicyId!: string;

  @ApiProperty()
  @IsString()
  paymentPolicyId!: string;

  @ApiProperty()
  @IsString()
  returnPolicyId!: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class EbayOAuthStartDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  internalStoreId?: string;

  @IsString()
  marketplaceId!: string;

  @IsIn(['sandbox', 'production'])
  environment!: 'sandbox' | 'production';

  @IsString()
  accountDisplayName!: string;

  /** Dev-only until JWT exposes `sub` on every request */
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class EbayPublishTargetDto {
  @IsUUID()
  ebayAccountId!: string;

  @IsString()
  marketplaceId!: string;
}

export class EbayPublishJobDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  catalogProductId!: string;

  @IsOptional()
  @IsUUID()
  requestedByUserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EbayPublishTargetDto)
  targets!: EbayPublishTargetDto[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class EbayReconnectBodyDto {
  @IsString()
  marketplaceId!: string;

  @IsIn(['sandbox', 'production'])
  environment!: 'sandbox' | 'production';

  @IsString()
  accountDisplayName!: string;

  @IsOptional()
  @IsUUID()
  internalStoreId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class EbayValidateDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  catalogProductId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EbayPublishTargetDto)
  targets!: EbayPublishTargetDto[];
}

export class EbayDefaultPoliciesPatchDto {
  @IsString()
  marketplaceId!: string;

  @IsOptional()
  @IsString()
  defaultPaymentPolicyId?: string | null;

  @IsOptional()
  @IsString()
  defaultReturnPolicyId?: string | null;

  @IsOptional()
  @IsString()
  defaultFulfillmentPolicyId?: string | null;

  @IsOptional()
  @IsString()
  defaultInventoryLocationKey?: string | null;
}

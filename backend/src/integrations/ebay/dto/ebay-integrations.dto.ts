import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class EbayOAuthStartDto {
  /** RealTrack workspace (internal). Omit to use the user's default workspace. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  internalStoreId?: string;

  @IsString()
  marketplaceId!: string;

  @IsIn(['sandbox', 'production'])
  environment!: 'sandbox' | 'production';

  /** Optional label in RealTrack; defaults to eBay username after OAuth. */
  @IsOptional()
  @IsString()
  accountDisplayName?: string;
}

export class EbayPublishTargetDto {
  @IsUUID()
  ebayAccountId!: string;

  @IsString()
  marketplaceId!: string;
}

export class EbayPublishJobDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

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

export class EbayBulkPublishJobDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  listingIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  storeIds!: string[];

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
}

export class EbayValidateDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

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

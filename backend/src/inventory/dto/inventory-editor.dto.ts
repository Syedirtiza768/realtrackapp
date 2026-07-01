import { IsOptional, IsString, IsNumber, IsObject, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/* ─── Editor request/response types ─── */

export interface EditorListingInfo {
  id: string;
  sku: string;
  title: string | null;
  brand: string | null;
  partType: string | null;
  mpn: string | null;
  oemNumber: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrls: string[];
  fitmentCount: number;
  status: string;
}

/** A single marketplace version's editable fields */
export interface MarketplaceVersion {
  marketplace: 'US' | 'AU' | 'DE';
  title: string;
  description: string;
  price: number | null;
  quantity: number | null;
  conditionId: string;
  conditionDescription: string | null;
  itemSpecifics: Record<string, string>;
  fitmentSummary: string | null;
  seoScore: number | null;
  readinessScore: number | null;
}

/** A policy choice (from cached ebay_business_policies) */
export interface PolicyOption {
  id: string;
  ebayPolicyId: string;
  name: string;
  policyType: 'payment' | 'return' | 'fulfillment';
  marketplaceId: string;
}

/** A store with its eBay account, marketplaces, and cached policies */
export interface StoreWithPolicies {
  id: string;
  name: string;
  ebayAccountId: string;
  ebayUserId: string;
  marketplaces: Array<{
    marketplaceId: string;
    label: string;
    defaultPaymentPolicyId: string | null;
    defaultReturnPolicyId: string | null;
    defaultFulfillmentPolicyId: string | null;
    defaultInventoryLocationKey: string | null;
    policies: {
      payment: PolicyOption[];
      return: PolicyOption[];
      fulfillment: PolicyOption[];
    };
  }>;
}

/** The full editor response */
export interface EditorResponse {
  listing: EditorListingInfo;
  marketplaceVersions: MarketplaceVersion[];
  stores: StoreWithPolicies[];
}

/* ─── Save DTO ─── */

export class SaveMarketplaceVersionDto {
  @IsIn(['US', 'AU', 'DE'])
  marketplace!: 'US' | 'AU' | 'DE';

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @IsString()
  conditionId!: string;

  @IsOptional()
  @IsString()
  conditionDescription?: string | null;

  @IsOptional()
  @IsObject()
  itemSpecifics?: Record<string, string>;
}

export class SaveEditorDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveMarketplaceVersionDto)
  marketplaceVersions!: SaveMarketplaceVersionDto[];
}

export class PublishPolicyOverridesDto {
  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @IsOptional()
  @IsString()
  merchantLocationKey?: string;
}

export class PublishTargetDto {
  @IsString()
  storeId!: string;

  @IsString()
  marketplaceId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublishPolicyOverridesDto)
  policyOverrides?: PublishPolicyOverridesDto;
}

export class PublishListingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublishTargetDto)
  targets!: PublishTargetDto[];
}

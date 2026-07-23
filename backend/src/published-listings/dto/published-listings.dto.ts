import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { BulkJobAction } from '../entities/ebay-published-listing-bulk-job.entity.js';

export class PublishedListingsQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  ebayAccountId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  /**
   * Comma-separated eBay storefront slugs, e.g. `salvagea,blackline`
   * or `salvagea,blacklineusedautoparts`. Resolves to RealTrack store IDs.
   * Omit to default to Blackline + Salvage; use `all` for every connected store.
   */
  @IsOptional()
  @IsString()
  storeSlug?: string;

  @IsOptional()
  @IsString()
  offerId?: string;

  @IsOptional()
  @IsString()
  marketplaceId?: string;

  /**
   * Listing status filter (case-sensitive lowercase).
   * - Default: `active` — buyable inventory (`quantityAvailable > 0`) from the
   *   latest successful live Trading sync on an active eBay connection
   * - `ended` — ended retention rows (reconciliation)
   * - `out_of_stock` — live offers with qty 0
   * - `unknown` — unclassified mirror rows
   * - `all` — no status filter (includes ended / out_of_stock / stale)
   */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantityMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantityMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  soldMin?: number;

  @IsOptional()
  @IsString()
  listedFrom?: string;

  @IsOptional()
  @IsString()
  listedTo?: string;

  @IsOptional()
  @IsString()
  lowStock?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class SyncPublishedListingsDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  ebayAccountId?: string;

  @IsOptional()
  @IsString()
  marketplaceId?: string;
}

export class RevisePublishedListingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  itemSpecifics?: Record<string, string[]>;
}

export class UpdatePoliciesDto {
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
  shippingProfileName?: string;

  @IsOptional()
  @IsString()
  returnProfileName?: string;

  @IsOptional()
  @IsString()
  paymentProfileName?: string;
}

export class BulkPublishedListingsDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  listingIds!: string[];

  @IsString()
  action!: BulkJobAction;

  @IsOptional()
  payload?: Record<string, unknown>;
}

export class BulkPriceUpdatePayload {
  @IsOptional()
  @IsEnum([
    'set',
    'increase_percent',
    'decrease_percent',
    'increase_amount',
    'decrease_amount',
  ])
  mode?:
    | 'set'
    | 'increase_percent'
    | 'decrease_percent'
    | 'increase_amount'
    | 'decrease_amount';

  @Type(() => Number)
  @IsNumber()
  value!: number;
}

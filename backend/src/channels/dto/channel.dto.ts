import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsUUID,
  IsArray,
  IsObject,
  ArrayMinSize,
} from 'class-validator';

export class ConnectChannelDto {
  @IsString()
  @IsNotEmpty()
  channel!: string; // 'ebay' | 'shopify'

  @IsOptional()
  @IsString()
  shopDomain?: string; // Shopify only
}

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}

export class PublishListingDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  listingId!: string;
}

export class PublishMultiDto {
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  channels!: string[];

  @IsOptional()
  @IsObject()
  overrides?: Record<
    string,
    { price?: number; title?: string; quantity?: number }
  >;

  /** Publish to one specific store (needed to pick between several destinations). */
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class BulkPublishDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  listingIds!: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  channels!: string[];

  @IsOptional()
  @IsUUID()
  storeId?: string;
}

export class SyncInventoryDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class WebhookPayloadDto {
  @IsOptional()
  payload?: Record<string, unknown>;
}

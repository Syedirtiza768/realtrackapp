import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

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

export class SyncInventoryDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class WebhookPayloadDto {
  @IsOptional()
  payload?: Record<string, unknown>;
}

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsIn,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateStoreDto {
  @IsUUID()
  connectionId!: string;

  @IsString()
  @MaxLength(30)
  channel!: string;

  @IsString()
  @MaxLength(200)
  storeName!: string;

  @IsOptional()
  @IsString()
  storeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalStoreId?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storeName?: string;

  @IsOptional()
  @IsString()
  storeUrl?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'suspended', 'archived'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateInstanceDto {
  @IsUUID()
  listingId!: string;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  overridePrice?: number;

  @IsOptional()
  overrideQuantity?: number;

  @IsOptional()
  @IsString()
  overrideTitle?: string;

  @IsOptional()
  @IsObject()
  channelSpecificData?: Record<string, unknown>;
}

export class PublishInstanceDto {
  @IsUUID()
  instanceId!: string;
}

export class BulkPublishInstancesDto {
  @IsUUID('4', { each: true })
  instanceIds!: string[];
}

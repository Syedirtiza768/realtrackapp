import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrdersQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  until?: string;

  @IsOptional()
  @IsString()
  search?: string; // buyer name, email, or order ID

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateShippingDto {
  @IsString()
  trackingNumber!: string;

  @IsOptional()
  @IsString()
  trackingCarrier?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;
}

export class RefundDto {
  @IsString()
  amount!: string; // NUMERIC as string

  @IsOptional()
  @IsString()
  reason?: string;
}

/* ─── Phase 4: Bulk Operations ─── */

export class BulkShipItemDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  trackingNumber!: string;

  @IsString()
  carrier!: string;
}

export class BulkShipDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkShipItemDto)
  items!: BulkShipItemDto[];
}

export class BulkCancelDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds!: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CsvTrackingUploadDto {
  @IsString()
  csvContent!: string;
}

export class ManualImportDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;
}

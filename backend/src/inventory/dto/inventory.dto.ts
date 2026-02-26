import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustInventoryDto {
  @IsInt()
  change!: number; // positive = add, negative = subtract

  @IsString()
  reason!: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  sourceChannel?: string;
}

export class ReserveInventoryDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  orderId!: string;
}

export class ReleaseInventoryDto {
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  orderId!: string;
}

export class ReconcileDto {
  @IsUUID('4', { each: true })
  listingIds!: string[];
}

export class LowStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class InventoryEventsQueryDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  since?: string;

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

import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

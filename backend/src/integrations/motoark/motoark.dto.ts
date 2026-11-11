import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const MOTOARK_EVENTS = [
  'order.paid',
  'order.shipped',
  'order.cancelled',
  'return.requested',
  'return.received',
  'return.restocked',
  'return.disposed',
  'refund.completed',
] as const;
export type MotoarkEventType = (typeof MOTOARK_EVENTS)[number];

export class MotoarkLineDto {
  @IsString() @MinLength(1) @MaxLength(100) externalLineId!: string;
  @IsOptional() @IsUUID() listingId?: string;
  @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/) unitPrice?: string;
  @IsOptional() @IsUUID() warehouseId?: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  unitIds?: string[];
}

export class MotoarkOrderEventDto {
  @Equals(1) schemaVersion!: number;
  @IsString() @MinLength(1) @MaxLength(160) eventId!: string;
  @IsIn(MOTOARK_EVENTS) eventType!: MotoarkEventType;
  @IsDateString() occurredAt!: string;
  @IsString() @MinLength(1) @MaxLength(100) externalOrderId!: string;
  @IsInt() @Min(1) @Max(2147483647) orderVersion!: number;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((line: MotoarkLineDto) => line.externalLineId)
  @ValidateNested({ each: true })
  @Type(() => MotoarkLineDto)
  lines?: MotoarkLineDto[];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) returnId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) refundId?: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/) amount?: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/) shippingAmount?: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,7})\.\d{2}$/) taxAmount?: string;
}

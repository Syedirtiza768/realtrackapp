import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsNumber,
  IsBoolean,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExportRuleDto {
  @ApiProperty({ description: 'Human-readable rule name' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Target store ID' })
  @IsUUID()
  storeId!: string;

  @ApiPropertyOptional({
    description: 'JSONB filter criteria',
    example: {
      brand: ['TRW', 'Bosch'],
      partType: ['Brake Pad Set'],
      condition: ['NEW'],
      minPrice: 10,
      maxPrice: 500,
    },
  })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Price multiplier (e.g. 1.15 = +15%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMultiplier?: number;

  @ApiPropertyOptional({ description: 'Fixed price addition (after multiplier)' })
  @IsOptional()
  @IsNumber()
  priceAddition?: number;

  @ApiPropertyOptional({ description: 'Title prefix to add' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  titlePrefix?: string;

  @ApiPropertyOptional({ description: 'Title suffix to add' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  titleSuffix?: string;

  @ApiPropertyOptional({ description: 'eBay fulfillment policy ID' })
  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @ApiPropertyOptional({ description: 'eBay payment policy ID' })
  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @ApiPropertyOptional({ description: 'eBay return policy ID' })
  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @ApiPropertyOptional({ description: 'Cron expression for scheduled checks' })
  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @ApiPropertyOptional({ description: 'Auto-publish or create as draft' })
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;
}

export class UpdateExportRuleDto {
  @ApiPropertyOptional({ description: 'Human-readable rule name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Target store ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'JSONB filter criteria' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Price multiplier' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMultiplier?: number;

  @ApiPropertyOptional({ description: 'Fixed price addition' })
  @IsOptional()
  @IsNumber()
  priceAddition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  titlePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  titleSuffix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fulfillmentPolicyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentPolicyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnPolicyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @ApiPropertyOptional({ description: 'Rule status' })
  @IsOptional()
  @IsIn(['active', 'paused', 'disabled'])
  status?: 'active' | 'paused' | 'disabled';
}

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsObject,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ─── Settings DTOs ─── */

export class UpdateSettingDto {
  value: unknown; // JSONB — any valid JSON
}

/* ─── Shipping Profile DTOs ─── */

export class CreateShippingProfileDto {
  @IsString()
  name: string;

  @IsString()
  carrier: string;

  @IsString()
  service: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  handlingTime?: number;

  @IsEnum(['flat', 'calculated', 'free'])
  costType: 'flat' | 'calculated' | 'free';

  @IsOptional()
  @IsString()
  flatCost?: string;

  @IsOptional()
  @IsBoolean()
  weightBased?: boolean;

  @IsOptional()
  @IsBoolean()
  domesticOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateShippingProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsString() service?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30) handlingTime?: number;
  @IsOptional() @IsEnum(['flat', 'calculated', 'free']) costType?: 'flat' | 'calculated' | 'free';
  @IsOptional() @IsString() flatCost?: string;
  @IsOptional() @IsBoolean() weightBased?: boolean;
  @IsOptional() @IsBoolean() domesticOnly?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

/* ─── Pricing Rule DTOs ─── */

export class CreatePricingRuleDto {
  @IsString()
  name: string;

  @IsEnum(['markup', 'markdown', 'round', 'min_margin', 'competitive'])
  ruleType: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';

  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brand?: string;

  @IsObject()
  parameters: Record<string, unknown>;

  @IsOptional() @Type(() => Number) @IsNumber() priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePricingRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(['markup', 'markdown', 'round', 'min_margin', 'competitive'])
  ruleType?: 'markup' | 'markdown' | 'round' | 'min_margin' | 'competitive';
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsObject() parameters?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsNumber() priority?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

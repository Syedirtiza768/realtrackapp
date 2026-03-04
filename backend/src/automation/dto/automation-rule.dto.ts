import { IsString, IsOptional, IsBoolean, IsInt, IsObject, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAutomationRuleDto {
  @ApiProperty({ example: 'Low stock price increase' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['schedule', 'event', 'condition'] })
  @IsEnum(['schedule', 'event', 'condition'])
  triggerType: 'schedule' | 'event' | 'condition';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, unknown>;

  @ApiProperty({ enum: ['update_price', 'sync_inventory', 'publish', 'end_listing', 'notify', 'apply_template'] })
  @IsEnum(['update_price', 'sync_inventory', 'publish', 'end_listing', 'notify', 'apply_template'])
  actionType: 'update_price' | 'sync_inventory' | 'publish' | 'end_listing' | 'notify' | 'apply_template';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  conditions?: Record<string, unknown>[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: 'Scope rule to a specific store (null = all stores)' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Scope rule to a specific channel (null = all channels)' })
  @IsOptional()
  @IsString()
  channel?: string;
}

export class UpdateAutomationRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['schedule', 'event', 'condition']) triggerType?: string;
  @IsOptional() @IsObject() triggerConfig?: Record<string, unknown>;
  @IsOptional() @IsEnum(['update_price', 'sync_inventory', 'publish', 'end_listing', 'notify', 'apply_template']) actionType?: string;
  @IsOptional() @IsObject() actionConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() conditions?: Record<string, unknown>[];
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() channel?: string;
}

export class AutomationRuleQueryDto {
  @IsOptional() @IsString() triggerType?: string;
  @IsOptional() @IsString() actionType?: string;
  @IsOptional() @IsString() enabled?: string; // 'true' | 'false'
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() channel?: string;
}

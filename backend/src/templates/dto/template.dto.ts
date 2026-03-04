import { IsString, IsOptional, IsBoolean, IsArray, IsObject, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'eBay Pro Template' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'ebay' })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ enum: ['description', 'title', 'full'], default: 'description' })
  @IsOptional()
  @IsEnum(['description', 'title', 'full'])
  templateType?: 'description' | 'title' | 'full';

  @ApiProperty({ example: '<h1>{{title}}</h1><p>{{description}}</p>' })
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  css?: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  variables?: Record<string, unknown>[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(['description', 'title', 'full']) templateType?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() css?: string;
  @IsOptional() @IsArray() variables?: Record<string, unknown>[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class TemplateQueryDto {
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() templateType?: string;
  @IsOptional() @IsString() active?: string; // 'true' | 'false'
}

export class RenderPreviewDto {
  @ApiProperty({ description: 'Variables to inject into the template' })
  @IsObject()
  variables: Record<string, unknown>;
}

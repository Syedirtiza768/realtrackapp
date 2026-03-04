import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCsvDto {
  @ApiPropertyOptional({ description: 'User-defined column mapping (csvHeader → catalogField)' })
  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string>;
}

export class StartImportDto {
  @ApiProperty({ description: 'Import ID returned from upload step' })
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @ApiPropertyOptional({ description: 'Column mapping overrides' })
  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string>;
}

export class ImportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  offset?: number;
}

export class ImportRowQueryDto {
  @ApiPropertyOptional({ description: 'Filter by row status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  offset?: number;
}

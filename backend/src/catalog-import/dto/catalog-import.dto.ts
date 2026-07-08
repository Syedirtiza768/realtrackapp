import {
  Equals,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCsvDto {
  @ApiPropertyOptional({
    description: 'User-defined column mapping (csvHeader → catalogField)',
  })
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ImportRowQueryDto {
  @ApiPropertyOptional({ description: 'Filter by row status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class BackfillListingsDto {
  @ApiPropertyOptional({
    description: 'Optional import ID to backfill only one import',
  })
  @IsOptional()
  @IsString()
  importId?: string;
}

export class ClearCatalogDto {
  @ApiProperty({
    description: 'Must be exactly DELETE_ALL_CATALOG',
    example: 'DELETE_ALL_CATALOG',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Equals('DELETE_ALL_CATALOG')
  confirm!: 'DELETE_ALL_CATALOG';
}

import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ImportEbayMvlDirectoryDto {
  @IsOptional()
  @IsString()
  directory?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ImportEbayMvlFileDto {
  @IsString()
  filePath!: string;

  @IsOptional()
  @IsString()
  marketplace?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ValidateEbayMvlBatchDto {
  @IsString()
  marketplace!: string;

  @IsOptional()
  rows?: Array<Record<string, unknown>>;
}

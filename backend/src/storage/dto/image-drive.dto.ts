import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateFolderDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  linkedPartNumber?: string;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  linkedPartNumber?: string | null;
}

export class UploadToFolderDto {
  @IsOptional()
  @IsString()
  partNumber?: string;
}

export class ImageDriveBatchLookupDto {
  @IsArray()
  @IsString({ each: true })
  partNumbers!: string[];
}

export class ListFilesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

export class SearchDriveDto {
  @IsString()
  q!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

export class AutoCreateUploadDto {
  @IsString()
  folderName!: string;

  @IsOptional()
  @IsString()
  partNumber?: string;
}

export class BulkDeleteFilesDto {
  @IsArray()
  @IsString({ each: true })
  fileIds!: string[];
}

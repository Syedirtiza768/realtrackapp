import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ImageDriveUploadDto {
  @IsString()
  partNumber!: string;
}

export class ImageDriveBatchLookupDto {
  @IsArray()
  @IsString({ each: true })
  partNumbers!: string[];
}

export class ImageDriveSearchDto {
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

export class ImageDriveRecordFromPartDto {
  @IsString()
  partNumber!: string;

  @IsArray()
  @IsString({ each: true })
  assetIds!: string[];
}

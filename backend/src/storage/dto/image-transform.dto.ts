import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ImageTransformDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsString()
  fit?: 'cover' | 'contain' | 'inside' | 'outside' | 'fill';

  @IsOptional()
  @IsInt()
  @Min(1)
  quality?: number;
}

import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

export class RequestUploadDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES)
  mimeType!: string;

  @IsOptional()
  @IsString()
  listingId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024) // 20 MB
  fileSize?: number;
}

export class BulkRequestUploadDto {
  @IsOptional()
  @IsString()
  listingId?: string;

  files!: RequestUploadDto[];
}

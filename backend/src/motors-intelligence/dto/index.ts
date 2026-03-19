import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsObject,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MotorsSourceType } from '../entities';

export class CreateMotorsProductDto {
  @ApiProperty({ enum: MotorsSourceType })
  @IsEnum(MotorsSourceType)
  sourceType: MotorsSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sourcePayload?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oemPartNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  imageAssetIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  catalogProductId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class BatchCreateMotorsProductDto {
  @ApiProperty({ type: [CreateMotorsProductDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMotorsProductDto)
  products: CreateMotorsProductDto[];
}

export class MotorsProductQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ReviewTaskQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

export class ResolveReviewTaskDto {
  @ApiProperty()
  @IsString()
  resolution: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  resolutionData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: 'approve' | 'reject' | 'defer';
}

export class UpdateMotorsProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mpn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oemPartNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ebayCategoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generatedTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  generatedItemSpecifics?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  generatedBulletFeatures?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generatedHtmlDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}

export class MotorsPipelineResultDto {
  motorsProductId: string;
  status: string;
  identityConfidence: number | null;
  fitmentConfidence: number | null;
  complianceConfidence: number | null;
  publishable: boolean;
  reviewRequired: boolean;
  reviewTaskId?: string;
  errors: any[];
  warnings: any[];
}

/* ─── Image Upload DTOs ──────────────────────────────────── */

export class ImageUploadFileDto {
  @ApiProperty({ description: 'Original file name' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: 'MIME type (image/jpeg, image/png, image/webp)' })
  @IsString()
  mimeType: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class ImageUploadRequestDto {
  @ApiProperty({ type: [ImageUploadFileDto], description: 'Files to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageUploadFileDto)
  files: ImageUploadFileDto[];

  @ApiPropertyOptional({ description: 'Known brand (optional pre-fill)' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Known MPN (optional pre-fill)' })
  @IsOptional()
  @IsString()
  mpn?: string;

  @ApiPropertyOptional({ description: 'Product type hint' })
  @IsOptional()
  @IsString()
  productType?: string;

  @ApiPropertyOptional({ description: 'Condition' })
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Auto-run pipeline after upload confirmation' })
  @IsOptional()
  autoRunPipeline?: boolean;
}

export class ImageUploadResponseDto {
  motorsProductId: string;
  uploadUrls: { fileName: string; uploadUrl: string; key: string }[];
  status: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'S3 keys of successfully uploaded images' })
  @IsArray()
  @IsString({ each: true })
  uploadedKeys: string[];

  @ApiPropertyOptional({ description: 'Run the AI pipeline immediately' })
  @IsOptional()
  autoRunPipeline?: boolean;
}

export class ConfirmUploadResponseDto {
  motorsProductId: string;
  imageUrls: string[];
  pipelineStarted: boolean;
  status: string;
}

/* ─── Pipeline Progress ──────────────────────────────────── */

export class PipelineStageDto {
  stage: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  details?: Record<string, any>;
}

export class PipelineProgressDto {
  motorsProductId: string;
  overallStatus: string;
  currentStage: string | null;
  stages: PipelineStageDto[];
  confidence: {
    identity: number | null;
    fitment: number | null;
    compliance: number | null;
    content: number | null;
  };
  completedAt?: string;
}

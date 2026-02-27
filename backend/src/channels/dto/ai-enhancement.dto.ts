import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsObject,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RequestEnhancementDto {
  @IsUUID()
  listingId!: string;

  @IsIn([
    'title_optimization',
    'description_generation',
    'item_specifics',
    'fitment_detection',
    'image_enhancement',
  ])
  enhancementType!: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, unknown>;
}

export class BulkRequestEnhancementDto {
  @IsUUID('4', { each: true })
  listingIds!: string[];

  @IsIn([
    'title_optimization',
    'description_generation',
    'item_specifics',
    'fitment_detection',
    'image_enhancement',
  ])
  enhancementType!: string;
}

export class ApproveEnhancementDto {
  @IsOptional()
  @IsUUID()
  approvedBy?: string;
}

export class RejectEnhancementDto {
  @IsString()
  reason!: string;
}

export class EnhancementQueryDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsString()
  enhancementType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

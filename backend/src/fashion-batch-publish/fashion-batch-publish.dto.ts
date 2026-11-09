import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFashionBatchDto {
  @ApiProperty({ minimum: 1, maximum: 500, default: 100 })
  @IsInt()
  @Min(1)
  @Max(500)
  size!: number;

  @ApiProperty({ description: 'Run images + compliance only; never calls eBay publish' })
  @IsBoolean()
  dryRun!: boolean;

  @ApiPropertyOptional({ description: 'Connected Fashion eBay account (required for live batches)' })
  @IsOptional()
  @IsUUID()
  ebayAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  marketplaceId?: string;

  @ApiPropertyOptional({
    description:
      'Live batches: the reviewer confirms authenticity for listings that pass the compliance check',
  })
  @IsOptional()
  @IsBoolean()
  confirmAuthenticity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class ApplySuggestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;
}

export class ApproveListingDto {
  @ApiProperty()
  @IsBoolean()
  authenticityConfirmed!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RejectListingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  notes!: string;
}

export class ReviewQueueQueryDto {
  @ApiPropertyOptional({ enum: ['NEEDS_REVIEW', 'BLOCKED'] })
  @IsOptional()
  @IsIn(['NEEDS_REVIEW', 'BLOCKED'])
  state?: 'NEEDS_REVIEW' | 'BLOCKED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class ComplianceConfigDto {
  @ApiProperty({ description: 'Rule-list overrides; omitted lists use defaults' })
  @IsObject()
  config!: Record<string, unknown>;
}

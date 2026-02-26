import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateFitmentDto {
  @IsInt()
  makeId!: number;

  @IsInt()
  modelId!: number;

  @IsOptional()
  @IsInt()
  submodelId?: number;

  @IsInt()
  @Min(1900)
  @Max(2100)
  yearStart!: number;

  @IsInt()
  @Min(1900)
  @Max(2100)
  yearEnd!: number;

  @IsOptional()
  @IsInt()
  engineId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['manual', 'aces_import', 'ai_detected', 'bulk_import'])
  source?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyFitmentDto {
  @IsBoolean()
  verified!: boolean;
}

export class FitmentDetectionDto {
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

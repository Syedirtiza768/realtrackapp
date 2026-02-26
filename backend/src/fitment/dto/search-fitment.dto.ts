import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchFitmentDto {
  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearEnd?: number;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

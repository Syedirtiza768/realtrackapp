import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class BusinessIndustrialUnitAllocationDto {
  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  offerId?: string;
}

export class BusinessIndustrialUnitSoldDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  offerId?: string;
}

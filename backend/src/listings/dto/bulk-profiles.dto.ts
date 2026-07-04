import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class BulkProfilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  shippingProfile?: string;

  @IsOptional()
  @IsString()
  returnProfile?: string;

  @IsOptional()
  @IsString()
  paymentProfile?: string;

  /** Active catalog team filter — listings outside these teams are rejected. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}

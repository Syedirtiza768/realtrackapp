import { IsString, MaxLength, MinLength } from 'class-validator';

export class BusinessIndustrialReleaseIncidentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;
}

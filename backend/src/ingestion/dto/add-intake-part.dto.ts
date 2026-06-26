import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddIntakePartDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  partNumber!: string;

  @IsString()
  brand!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  imageUrls!: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  uploadedAssetIds?: string[];
}

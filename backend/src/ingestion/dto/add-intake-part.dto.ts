import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const INTAKE_PART_TYPES = ['OEM', 'Aftermarket', 'Salvage'] as const;
export type IntakePartType = (typeof INTAKE_PART_TYPES)[number];

/** eBay File Exchange condition IDs — New / Used only at warehouse intake. */
export const INTAKE_CONDITION_IDS = ['1000', '3000'] as const;

export class AddIntakePartDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  partNumber!: string;

  @IsString()
  brand!: string;

  @IsIn([...INTAKE_PART_TYPES])
  partType!: IntakePartType;

  @IsIn([...INTAKE_CONDITION_IDS])
  conditionId!: string;

  @IsOptional()
  @IsString()
  vehicleMake?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  uploadedAssetIds?: string[];

  /** Applied from AI part lookup when Process SKU runs. */
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

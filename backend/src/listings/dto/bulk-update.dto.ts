import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateListingDto } from './create-listing.dto';

export class BulkUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => CreateListingDto)
  changes: Partial<CreateListingDto>;
}

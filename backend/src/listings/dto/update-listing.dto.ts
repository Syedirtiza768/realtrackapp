import { IsInt, Min } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

// PartialType is not available without @nestjs/mapped-types at entity level,
// so we extend CreateListingDto directly (all fields already @IsOptional).
export class UpdateListingDto extends CreateListingDto {
  @IsInt({ message: 'version must be an integer for optimistic locking' })
  @Min(1)
  version: number;
}

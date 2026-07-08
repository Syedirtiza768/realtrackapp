import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { ListingStatus } from './create-listing.dto';

export class PatchStatusDto {
  @IsEnum(['draft', 'ready', 'published', 'sold', 'delisted', 'archived'], {
    message:
      'status must be one of: draft, ready, published, sold, delisted, archived',
  })
  status: ListingStatus;

  @IsInt({ message: 'version must be an integer for optimistic locking' })
  @Min(1)
  version: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

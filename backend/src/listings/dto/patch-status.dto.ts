import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { ListingStatus } from './create-listing.dto';

export class PatchStatusDto {
  @IsEnum(['draft', 'ready', 'published', 'sold', 'delisted', 'archived'], {
    message: 'status must be one of: draft, ready, published, sold, delisted, archived',
  })
  status: ListingStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

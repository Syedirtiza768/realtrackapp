import type { ListingStatus } from './create-listing.dto';
export declare class PatchStatusDto {
    status: ListingStatus;
    version: number;
    reason?: string;
}

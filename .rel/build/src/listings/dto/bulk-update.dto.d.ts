import { CreateListingDto } from './create-listing.dto';
export declare class BulkUpdateDto {
    ids: string[];
    changes: Partial<CreateListingDto>;
    versions?: Record<string, number>;
}

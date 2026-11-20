import { Repository } from 'typeorm';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import type { VinDecodeResult } from './vin-decode.service.js';
export declare class EbayVinSearchService {
    private readonly browseApi;
    private readonly listingRepo;
    private readonly logger;
    constructor(browseApi: EbayBrowseApiService, listingRepo: Repository<ListingRecord>);
    searchAndPersist(vin: string, decoded: VinDecodeResult): Promise<ListingRecord[]>;
    private buildSearchQuery;
    private upsertListings;
    private daysAgo;
}

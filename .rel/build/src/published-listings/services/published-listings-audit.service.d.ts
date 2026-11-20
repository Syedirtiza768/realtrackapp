import { Repository } from 'typeorm';
import { EbayPublishedListingRevision } from '../entities/ebay-published-listing-revision.entity.js';
export declare class PublishedListingsAuditService {
    private readonly revisionRepo;
    constructor(revisionRepo: Repository<EbayPublishedListingRevision>);
    writeRevision(entry: Partial<EbayPublishedListingRevision>): Promise<void>;
    listRevisions(publishedListingId: string, organizationId: string, limit?: number): Promise<EbayPublishedListingRevision[]>;
}

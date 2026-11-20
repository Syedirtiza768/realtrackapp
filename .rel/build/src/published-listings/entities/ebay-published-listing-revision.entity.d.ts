import { Organization } from '../../auth/entities/organization.entity.js';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../../integrations/ebay/entities/connected-ebay-account.entity.js';
import { EbayPublishedListing } from './ebay-published-listing.entity.js';
export declare class EbayPublishedListingRevision {
    id: string;
    organizationId: string;
    organization: Organization;
    publishedListingId: string;
    publishedListing: EbayPublishedListing;
    ebayAccountId: string;
    ebayAccount: ConnectedEbayAccount;
    userId: string | null;
    user: User | null;
    actionType: string;
    ebayItemId: string | null;
    beforeValue: Record<string, unknown> | null;
    afterValue: Record<string, unknown> | null;
    apiResult: string;
    apiError: string | null;
    createdAt: Date;
}

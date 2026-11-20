import { Organization } from '../../../auth/entities/organization.entity.js';
import { User } from '../../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from './connected-ebay-account.entity.js';
export declare class EbayApiAuditLog {
    id: string;
    organizationId: string;
    organization: Organization;
    ebayAccountId: string | null;
    ebayAccount: ConnectedEbayAccount | null;
    userId: string | null;
    user: User | null;
    httpMethod: string;
    apiFamily: string;
    endpointPath: string;
    marketplaceId: string | null;
    responseStatus: number | null;
    ebayErrorId: string | null;
    ebayErrorMessage: string | null;
    correlationId: string | null;
    durationMs: number | null;
    requestMetadata: Record<string, unknown>;
    createdAt: Date;
}

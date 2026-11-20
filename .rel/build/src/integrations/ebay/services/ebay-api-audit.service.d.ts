import { Repository } from 'typeorm';
import { EbayApiAuditLog } from '../entities/ebay-api-audit-log.entity.js';
export interface EbayApiAuditInput {
    organizationId: string;
    ebayAccountId?: string | null;
    userId?: string | null;
    httpMethod: string;
    apiFamily: string;
    endpointPath: string;
    marketplaceId?: string | null;
    responseStatus?: number | null;
    ebayErrorId?: string | null;
    ebayErrorMessage?: string | null;
    correlationId?: string | null;
    durationMs?: number | null;
    requestMetadata?: Record<string, unknown>;
}
export declare class EbayApiAuditService {
    private readonly repo;
    constructor(repo: Repository<EbayApiAuditLog>);
    record(input: EbayApiAuditInput): Promise<void>;
    listForAccount(ebayAccountId: string, organizationId: string, limit?: number): Promise<EbayApiAuditLog[]>;
}

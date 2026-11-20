import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
export type BusinessIndustrialIncidentType = 'counterfeit' | 'intellectual_property' | 'product_safety' | 'recalled_product' | 'other';
export type BusinessIndustrialIncidentStatus = 'received' | 'quarantined' | 'takedown_pending' | 'takedown_complete' | 'escalated' | 'released';
export declare class BusinessIndustrialIncident {
    id: string;
    organizationId: string;
    organization: Organization;
    catalogProductId: string | null;
    catalogProduct: CatalogProduct | null;
    externalEventId: string;
    incidentType: BusinessIndustrialIncidentType;
    status: BusinessIndustrialIncidentStatus;
    verified: boolean;
    eventOccurredAt: Date | null;
    detectedAt: Date;
    firstTakedownAttemptAt: Date | null;
    takedownCompletedAt: Date | null;
    eventPayload: Record<string, unknown>;
    takedownAttempts: Array<Record<string, unknown>>;
    createdByUserId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

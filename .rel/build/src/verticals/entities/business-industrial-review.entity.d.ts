import { Organization } from '../../auth/entities/organization.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
export type BusinessIndustrialReviewStatus = 'pending' | 'approved' | 'rejected' | 'quarantined';
export declare class BusinessIndustrialReview {
    id: string;
    organizationId: string;
    organization: Organization;
    catalogProductId: string;
    catalogProduct: CatalogProduct;
    status: BusinessIndustrialReviewStatus;
    provenanceConfirmed: boolean;
    specificationsVerified: boolean;
    testingReviewed: boolean;
    restrictedCategoryCleared: boolean;
    evidenceKeys: string[];
    riskFlags: string[];
    reviewedByUserId: string | null;
    notes: string | null;
    reviewedAt: Date | null;
    reviewedProductUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

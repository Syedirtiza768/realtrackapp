import { Organization } from '../../auth/entities/organization.entity.js';
export type BusinessIndustrialImageIntakeJobStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';
export declare class BusinessIndustrialImageIntakeJob {
    id: string;
    organizationId: string;
    organization: Organization;
    createdByUserId: string | null;
    sourceRootName: string;
    sourceReferenceUrl: string | null;
    status: BusinessIndustrialImageIntakeJobStatus;
    totalFolders: number;
    totalImages: number;
    processedFolders: number;
    processedImages: number;
    groupedParts: number;
    failedFolders: number;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

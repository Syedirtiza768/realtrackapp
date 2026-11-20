import { Organization } from '../../auth/entities/organization.entity.js';
import { BusinessIndustrialImageIntakeJob } from './business-industrial-image-intake-job.entity.js';
export type BusinessIndustrialImageIntakeGroupStatus = 'pending' | 'processing' | 'detected' | 'needs_review' | 'failed' | 'draft_created';
export declare class BusinessIndustrialImageIntakeGroup {
    id: string;
    organizationId: string;
    organization: Organization;
    jobId: string;
    job: BusinessIndustrialImageIntakeJob;
    basePartName: string;
    basePartNormalized: string;
    rawFolderNames: string[];
    instanceSuffixes: string[];
    instanceCount: number;
    detectionStatus: BusinessIndustrialImageIntakeGroupStatus;
    detection: Record<string, unknown>;
    confidence: number | null;
    catalogProductId: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
}

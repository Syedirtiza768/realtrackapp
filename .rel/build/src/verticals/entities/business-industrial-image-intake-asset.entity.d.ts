import { Organization } from '../../auth/entities/organization.entity.js';
import { BusinessIndustrialImageIntakeJob } from './business-industrial-image-intake-job.entity.js';
import { BusinessIndustrialImageIntakeGroup } from './business-industrial-image-intake-group.entity.js';
export declare class BusinessIndustrialImageIntakeAsset {
    id: string;
    organizationId: string;
    organization: Organization;
    jobId: string;
    job: BusinessIndustrialImageIntakeJob;
    groupId: string;
    group: BusinessIndustrialImageIntakeGroup;
    sourceFolderName: string;
    relativePath: string;
    filename: string;
    s3Bucket: string;
    s3Key: string;
    cdnUrl: string;
    mimeType: string | null;
    fileSizeBytes: number;
    createdAt: Date;
}

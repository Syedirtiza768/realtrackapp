import { MotorsSourceType } from '../entities';
export declare class CreateMotorsProductDto {
    sourceType: MotorsSourceType;
    sourcePayload?: Record<string, any>;
    brand?: string;
    mpn?: string;
    oemPartNumber?: string;
    upc?: string;
    productType?: string;
    placement?: string;
    condition?: string;
    imageUrls?: string[];
    imageAssetIds?: string[];
    price?: number;
    quantity?: number;
    catalogProductId?: string;
    organizationId?: string;
}
export declare class BatchCreateMotorsProductDto {
    products: CreateMotorsProductDto[];
}
export declare class MotorsProductQueryDto {
    status?: string;
    sourceType?: string;
    brand?: string;
    productType?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export declare class ReviewTaskQueryDto {
    status?: string;
    priority?: string;
    reason?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
}
export declare class ResolveReviewTaskDto {
    resolution: string;
    resolutionData?: Record<string, any>;
    action?: 'approve' | 'reject' | 'defer';
}
export declare class UpdateMotorsProductDto {
    brand?: string;
    mpn?: string;
    oemPartNumber?: string;
    productType?: string;
    placement?: string;
    condition?: string;
    ebayCategoryId?: string;
    generatedTitle?: string;
    generatedItemSpecifics?: Record<string, string>;
    generatedBulletFeatures?: string[];
    generatedHtmlDescription?: string;
    price?: number;
    quantity?: number;
}
export declare class MotorsPipelineResultDto {
    motorsProductId: string;
    status: string;
    identityConfidence: number | null;
    fitmentConfidence: number | null;
    complianceConfidence: number | null;
    publishable: boolean;
    reviewRequired: boolean;
    reviewTaskId?: string;
    errors: any[];
    warnings: any[];
}
export declare class ImageUploadFileDto {
    fileName: string;
    mimeType: string;
    fileSize?: number;
}
export declare class ImageUploadRequestDto {
    files: ImageUploadFileDto[];
    brand?: string;
    mpn?: string;
    productType?: string;
    condition?: string;
    price?: number;
    quantity?: number;
    autoRunPipeline?: boolean;
}
export declare class ImageUploadResponseDto {
    motorsProductId: string;
    uploadUrls: {
        fileName: string;
        uploadUrl: string;
        key: string;
    }[];
    status: string;
}
export declare class ConfirmUploadDto {
    uploadedKeys: string[];
    autoRunPipeline?: boolean;
}
export declare class ConfirmUploadResponseDto {
    motorsProductId: string;
    imageUrls: string[];
    pipelineStarted: boolean;
    status: string;
}
export declare class PipelineStageDto {
    stage: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    error?: string;
    details?: Record<string, any>;
}
export declare class PipelineProgressDto {
    motorsProductId: string;
    overallStatus: string;
    currentStage: string | null;
    stages: PipelineStageDto[];
    confidence: {
        identity: number | null;
        fitment: number | null;
        compliance: number | null;
        content: number | null;
    };
    completedAt?: string;
}

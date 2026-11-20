import { ConfigService } from '@nestjs/config';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ImageProcessorService } from '../storage/image-processor.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { AiRunLogService } from '../common/openai/ai-run-log.service.js';
import { ModelRouter } from '../common/openai/model-router.js';
import { EbayTaxonomyApiService } from '../channels/ebay/ebay-taxonomy-api.service.js';
import type { AnalyzeFashionImagesDto, GenerateFashionListingDto } from './fashion.dto.js';
export declare class FashionImageAnalysisService {
    private readonly config;
    private readonly userOrgs;
    private readonly storage;
    private readonly imageProcessor;
    private readonly openai;
    private readonly aiRunLogs;
    private readonly modelRouter;
    private readonly taxonomy;
    private readonly logger;
    constructor(config: ConfigService, userOrgs: UserOrganizationService, storage: StorageService, imageProcessor: ImageProcessorService, openai: OpenAiService, aiRunLogs: AiRunLogService, modelRouter: ModelRouter, taxonomy: EbayTaxonomyApiService);
    uploadPhotos(user: User, files: Express.Multer.File[] | undefined, organizationId?: string, sku?: string): Promise<{
        uploaded: {
            url: string;
            s3Key: string;
            filename: string;
        }[];
        errors: string[];
    }>;
    analyze(user: User, dto: AnalyzeFashionImagesDto, organizationId?: string): Promise<{
        status: "suggested";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: string[];
        conflicts: import("./fashion.config.js").FashionSuggestionConflict[];
        warnings: string[];
        validationErrors: string[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: string | null;
            categoryName: string | null;
            query: null;
        } | {
            categoryId: string;
            categoryName: string;
            query: string;
        } | {
            categoryId: null;
            categoryName: null;
            query: string;
        };
        brand: string | null;
        conditionLabel: string | null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: string[];
    } | {
        status: "failed";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: never[];
        conflicts: never[];
        warnings: string[];
        validationErrors: never[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: null;
            categoryName: null;
            query: null;
        };
        brand: string | null;
        conditionLabel: null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: never[];
    }>;
    analyzeImages(dto: AnalyzeFashionImagesDto): Promise<{
        status: "suggested";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: string[];
        conflicts: import("./fashion.config.js").FashionSuggestionConflict[];
        warnings: string[];
        validationErrors: string[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: string | null;
            categoryName: string | null;
            query: null;
        } | {
            categoryId: string;
            categoryName: string;
            query: string;
        } | {
            categoryId: null;
            categoryName: null;
            query: string;
        };
        brand: string | null;
        conditionLabel: string | null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: string[];
    } | {
        status: "failed";
        attributes: import("./vertical.types.js").VerticalAttributes;
        suggestedKeys: never[];
        conflicts: never[];
        warnings: string[];
        validationErrors: never[];
        multipleItems: boolean;
        reviewPhotoSet: boolean;
        category: {
            categoryId: null;
            categoryName: null;
            query: null;
        };
        brand: string | null;
        conditionLabel: null;
        title: string;
        description: string;
        suggestedSku: string;
        visibleText: never[];
    }>;
    generateListing(dto: GenerateFashionListingDto): {
        title: string;
        description: string;
        attributes: import("./vertical.types.js").VerticalAttributes;
        errors: string[];
        warnings: string[];
    };
    private fashionModels;
    private identify;
    private logRun;
    private visionUrls;
    private suggestCategory;
}

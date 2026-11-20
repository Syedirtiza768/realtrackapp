import { ImageEnrichmentService } from './image-enrichment.service.js';
export declare class ImageEnrichmentController {
    private readonly imageEnrichmentService;
    constructor(imageEnrichmentService: ImageEnrichmentService);
    enrichBatch(body: {
        parts: Array<{
            partNumber: string;
            title: string;
            brand?: string;
            mpn?: string;
            fitment?: string;
            existingImages?: string[];
        }>;
        jobId?: string;
        downloadImages?: boolean;
    }): Promise<{
        results: never[];
        progress: null;
    } | {
        results: import("./image-enrichment.service.js").PartImageResult[];
        progress: import("./image-enrichment.service.js").ImageEnrichmentProgress;
    }>;
    validateUrls(body: {
        urls: string[];
    }): Promise<{
        results: import("./image-enrichment.service.js").ImageValidationResult[];
        summary: {
            total: number;
            accessible: number;
            issues: number;
        };
    }>;
    getStatus(jobId: string): Promise<{
        jobId: string;
        progress: import("./image-enrichment.service.js").ImageEnrichmentProgress | null;
    }>;
}

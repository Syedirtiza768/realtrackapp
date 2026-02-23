import type {
    AiGeneratedProductData,
    ImageRecognitionResult,
    IngestionJob,
    ProductImage,
} from '../types/platform';

export interface VisionRecognizer {
    identifyPart(images: ProductImage[]): Promise<ImageRecognitionResult>;
}

export interface ProductDataEnricher {
    enrich(recognition: ImageRecognitionResult, images: ProductImage[]): Promise<AiGeneratedProductData>;
}

export class IntelligentIngestionService {
    constructor(
        private readonly recognizer: VisionRecognizer,
        private readonly enricher: ProductDataEnricher,
    ) {}

    async process(job: IngestionJob, images: ProductImage[]): Promise<{
        job: IngestionJob;
        recognition: ImageRecognitionResult;
        generatedData: AiGeneratedProductData;
    }> {
        const inProgressJob: IngestionJob = {
            ...job,
            status: 'processing',
            startedAt: new Date().toISOString(),
        };

        const recognition = await this.recognizer.identifyPart(images);
        const generatedData = await this.enricher.enrich(recognition, images);

        const completedJob: IngestionJob = {
            ...inProgressJob,
            status: 'completed',
            completedAt: new Date().toISOString(),
        };

        return {
            job: completedJob,
            recognition,
            generatedData,
        };
    }
}

import { Repository } from 'typeorm';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { PipelineJob } from '../../ingestion/entities/pipeline-job.entity.js';
import { OpenAiService } from '../../common/openai/openai.service.js';
import type { TitleVerificationSummary } from './title-verification.types.js';
export declare class TitleVerificationService {
    private readonly productRepo;
    private readonly jobRepo;
    private readonly openAi;
    private readonly logger;
    constructor(productRepo: Repository<CatalogProduct>, jobRepo: Repository<PipelineJob>, openAi: OpenAiService);
    verifyJob(jobId: string): Promise<TitleVerificationSummary>;
    private flagTitleMismatch;
    private mapWithConcurrency;
}

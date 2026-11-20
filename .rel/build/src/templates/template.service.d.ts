import { Repository } from 'typeorm';
import { ListingTemplate } from './entities/listing-template.entity.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto, RenderPreviewDto } from './dto/template.dto.js';
export declare class TemplateService {
    private readonly templateRepo;
    private readonly listingPipeline;
    private readonly logger;
    constructor(templateRepo: Repository<ListingTemplate>, listingPipeline: ListingGenerationPipeline);
    findAll(query?: TemplateQueryDto): Promise<ListingTemplate[]>;
    findOne(id: string): Promise<ListingTemplate>;
    create(dto: CreateTemplateDto): Promise<ListingTemplate>;
    update(id: string, dto: UpdateTemplateDto): Promise<ListingTemplate>;
    remove(id: string): Promise<void>;
    renderPreview(id: string, dto: RenderPreviewDto): Promise<{
        html: string;
        css: string | null;
    }>;
    renderContent(content: string, variables: Record<string, unknown>): string;
    getDefault(channel: string | null, templateType?: string): Promise<ListingTemplate | null>;
    generateFromTemplate(id: string, productData: Record<string, unknown>, categoryName?: string, condition?: string): Promise<{
        renderedHtml: string;
        generation: ListingGenerationResult;
    }>;
    private resolveNestedKey;
}

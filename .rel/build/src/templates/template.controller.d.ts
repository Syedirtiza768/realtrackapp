import { TemplateService } from './template.service.js';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto, RenderPreviewDto } from './dto/template.dto.js';
export declare class TemplateController {
    private readonly templateService;
    constructor(templateService: TemplateService);
    findAll(query: TemplateQueryDto): Promise<import("./entities/listing-template.entity.js").ListingTemplate[]>;
    findOne(id: string): Promise<import("./entities/listing-template.entity.js").ListingTemplate>;
    create(dto: CreateTemplateDto): Promise<import("./entities/listing-template.entity.js").ListingTemplate>;
    update(id: string, dto: UpdateTemplateDto): Promise<import("./entities/listing-template.entity.js").ListingTemplate>;
    remove(id: string): Promise<void>;
    renderPreview(id: string, dto: RenderPreviewDto): Promise<{
        html: string;
        css: string | null;
    }>;
    generate(id: string, body: {
        productData: Record<string, unknown>;
        categoryName?: string;
        condition?: string;
    }): Promise<{
        renderedHtml: string;
        generation: import("../common/openai/pipelines/listing-generation.pipeline.js").ListingGenerationResult;
    }>;
}

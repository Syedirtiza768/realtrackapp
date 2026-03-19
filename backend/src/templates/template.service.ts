import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingTemplate } from './entities/listing-template.entity.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type { ListingGenerationResult } from '../common/openai/pipelines/listing-generation.pipeline.js';
import type {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateQueryDto,
  RenderPreviewDto,
} from './dto/template.dto.js';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(ListingTemplate)
    private readonly templateRepo: Repository<ListingTemplate>,
    private readonly listingPipeline: ListingGenerationPipeline,
  ) {}

  /* ─── CRUD ─── */

  async findAll(query?: TemplateQueryDto): Promise<ListingTemplate[]> {
    const qb = this.templateRepo.createQueryBuilder('t');

    if (query?.channel) {
      qb.andWhere('(t.channel = :channel OR t.channel IS NULL)', { channel: query.channel });
    }
    if (query?.templateType) {
      qb.andWhere('t.templateType = :templateType', { templateType: query.templateType });
    }
    if (query?.active === 'true' || query?.active === 'false') {
      qb.andWhere('t.active = :active', { active: query.active === 'true' });
    }

    return qb.orderBy('t.isDefault', 'DESC').addOrderBy('t.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<ListingTemplate> {
    const template = await this.templateRepo.findOneBy({ id });
    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async create(dto: CreateTemplateDto): Promise<ListingTemplate> {
    if (dto.isDefault) {
      // Unset other defaults for same channel/type
      await this.templateRepo.update(
        { channel: dto.channel ?? undefined, templateType: dto.templateType ?? 'description' as any, isDefault: true },
        { isDefault: false },
      );
    }
    const template = this.templateRepo.create(dto);
    const saved = await this.templateRepo.save(template);
    this.logger.log(`Created template: ${saved.name} (${saved.id})`);
    return saved;
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<ListingTemplate> {
    const template = await this.findOne(id);

    if (dto.isDefault && !template.isDefault) {
      await this.templateRepo.update(
        { channel: template.channel ?? undefined, templateType: template.templateType as any, isDefault: true },
        { isDefault: false },
      );
    }

    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepo.remove(template);
    this.logger.log(`Deleted template: ${template.name} (${id})`);
  }

  /* ─── Rendering ─── */

  /**
   * Render a template with provided variables using simple Handlebars-like substitution.
   * Uses {{variable}} syntax for now. Can be upgraded to full Handlebars in the future.
   */
  async renderPreview(id: string, dto: RenderPreviewDto): Promise<{ html: string; css: string | null }> {
    const template = await this.findOne(id);
    const html = this.renderContent(template.content, dto.variables);
    return { html, css: template.css };
  }

  /**
   * Render a template's content with given data.
   * Public so other services can use it (e.g., channel publish).
   */
  renderContent(content: string, variables: Record<string, unknown>): string {
    return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
      const value = this.resolveNestedKey(variables, key);
      return value != null ? String(value) : '';
    });
  }

  /**
   * Get the default template for a given channel and type.
   */
  async getDefault(channel: string | null, templateType = 'description'): Promise<ListingTemplate | null> {
    const where: any[] = [
      { templateType, isDefault: true, active: true },
    ];
    if (channel) {
      where.unshift({ channel, templateType, isDefault: true, active: true });
    }
    return this.templateRepo.findOne({
      where,
      order: { channel: 'DESC' }, // Prefer channel-specific over universal
    });
  }

  /* ─── AI Generation from Template ─── */

  /**
   * Render a template with product data, then feed the rendered context
   * into the OpenAI listing generation pipeline.
   *
   * Returns both the rendered template HTML and the AI-generated listing.
   */
  async generateFromTemplate(
    id: string,
    productData: Record<string, unknown>,
    categoryName?: string,
    condition?: string,
  ): Promise<{ renderedHtml: string; generation: ListingGenerationResult }> {
    const template = await this.findOne(id);
    const renderedHtml = this.renderContent(template.content, productData);

    // Include rendered template context in the product data for the AI
    const enrichedData = {
      ...productData,
      template_context: renderedHtml,
      template_name: template.name,
    };

    const generation = await this.listingPipeline.generate(
      enrichedData,
      categoryName ?? 'Auto Parts & Accessories',
      condition ?? (productData.condition as string) ?? 'NEW',
    );

    this.logger.log(
      `Generated listing from template "${template.name}": "${generation.title}"`,
    );

    return { renderedHtml, generation };
  }

  /* ─── Helpers ─── */

  private resolveNestedKey(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((acc, part) => {
      if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    }, obj);
  }
}

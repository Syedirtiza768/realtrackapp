"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TemplateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const listing_template_entity_js_1 = require("./entities/listing-template.entity.js");
const listing_generation_pipeline_js_1 = require("../common/openai/pipelines/listing-generation.pipeline.js");
let TemplateService = TemplateService_1 = class TemplateService {
    templateRepo;
    listingPipeline;
    logger = new common_1.Logger(TemplateService_1.name);
    constructor(templateRepo, listingPipeline) {
        this.templateRepo = templateRepo;
        this.listingPipeline = listingPipeline;
    }
    async findAll(query) {
        const qb = this.templateRepo.createQueryBuilder('t');
        if (query?.channel) {
            qb.andWhere('(t.channel = :channel OR t.channel IS NULL)', {
                channel: query.channel,
            });
        }
        if (query?.templateType) {
            qb.andWhere('t.templateType = :templateType', {
                templateType: query.templateType,
            });
        }
        if (query?.active === 'true' || query?.active === 'false') {
            qb.andWhere('t.active = :active', { active: query.active === 'true' });
        }
        return qb
            .orderBy('t.isDefault', 'DESC')
            .addOrderBy('t.name', 'ASC')
            .getMany();
    }
    async findOne(id) {
        const template = await this.templateRepo.findOneBy({ id });
        if (!template)
            throw new common_1.NotFoundException(`Template ${id} not found`);
        return template;
    }
    async create(dto) {
        if (dto.isDefault) {
            await this.templateRepo.update({
                channel: dto.channel ?? undefined,
                templateType: dto.templateType ?? 'description',
                isDefault: true,
            }, { isDefault: false });
        }
        const template = this.templateRepo.create(dto);
        const saved = await this.templateRepo.save(template);
        this.logger.log(`Created template: ${saved.name} (${saved.id})`);
        return saved;
    }
    async update(id, dto) {
        const template = await this.findOne(id);
        if (dto.isDefault && !template.isDefault) {
            await this.templateRepo.update({
                channel: template.channel ?? undefined,
                templateType: template.templateType,
                isDefault: true,
            }, { isDefault: false });
        }
        Object.assign(template, dto);
        return this.templateRepo.save(template);
    }
    async remove(id) {
        const template = await this.findOne(id);
        await this.templateRepo.remove(template);
        this.logger.log(`Deleted template: ${template.name} (${id})`);
    }
    async renderPreview(id, dto) {
        const template = await this.findOne(id);
        const html = this.renderContent(template.content, dto.variables);
        return { html, css: template.css };
    }
    renderContent(content, variables) {
        return content.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
            const value = this.resolveNestedKey(variables, key);
            return value != null ? String(value) : '';
        });
    }
    async getDefault(channel, templateType = 'description') {
        const where = [{ templateType, isDefault: true, active: true }];
        if (channel) {
            where.unshift({ channel, templateType, isDefault: true, active: true });
        }
        return this.templateRepo.findOne({
            where,
            order: { channel: 'DESC' },
        });
    }
    async generateFromTemplate(id, productData, categoryName, condition) {
        const template = await this.findOne(id);
        const renderedHtml = this.renderContent(template.content, productData);
        const enrichedData = {
            ...productData,
            template_context: renderedHtml,
            template_name: template.name,
        };
        const generation = await this.listingPipeline.generate(enrichedData, categoryName ?? 'Auto Parts & Accessories', condition ?? productData.condition ?? 'NEW');
        this.logger.log(`Generated listing from template "${template.name}": "${generation.title}"`);
        return { renderedHtml, generation };
    }
    resolveNestedKey(obj, key) {
        return key.split('.').reduce((acc, part) => {
            if (acc != null && typeof acc === 'object')
                return acc[part];
            return undefined;
        }, obj);
    }
};
exports.TemplateService = TemplateService;
exports.TemplateService = TemplateService = TemplateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(listing_template_entity_js_1.ListingTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        listing_generation_pipeline_js_1.ListingGenerationPipeline])
], TemplateService);
//# sourceMappingURL=template.service.js.map
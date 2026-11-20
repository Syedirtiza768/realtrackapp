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
var CrossReferencePipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossReferencePipeline = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const openai_service_js_1 = require("../openai.service.js");
const index_js_1 = require("../prompts/index.js");
const cross_reference_prompt_js_1 = require("../prompts/cross-reference.prompt.js");
const cross_reference_entity_js_1 = require("../../../listings/entities/cross-reference.entity.js");
let CrossReferencePipeline = CrossReferencePipeline_1 = class CrossReferencePipeline {
    openai;
    crossRefRepo;
    logger = new common_1.Logger(CrossReferencePipeline_1.name);
    constructor(openai, crossRefRepo) {
        this.openai = openai;
        this.crossRefRepo = crossRefRepo;
    }
    async processRawSupplierData(rawText, masterProductId) {
        this.logger.log(`Processing cross-reference data (${rawText.length} chars)${masterProductId ? ` for product ${masterProductId}` : ''}`);
        const { systemPrompt, userPrompt } = (0, index_js_1.renderPrompt)(cross_reference_prompt_js_1.CROSS_REFERENCE_PROMPT, {
            rawData: rawText,
        });
        const response = await this.openai.chat({
            systemPrompt,
            userPrompt,
            jsonMode: true,
            temperature: cross_reference_prompt_js_1.CROSS_REFERENCE_PROMPT.temperature,
            maxTokens: cross_reference_prompt_js_1.CROSS_REFERENCE_PROMPT.maxTokens,
        });
        const parsed = response.content;
        const rawParts = Array.isArray(parsed.parts)
            ? parsed.parts
            : [];
        const parts = rawParts.map((p) => ({
            oemNumbers: this.toStrArray(p.oem_numbers ?? p.oemNumbers),
            aftermarketNumbers: this.toStrArray(p.aftermarket_numbers ?? p.aftermarketNumbers),
            brand: this.str(p.brand),
            mpn: this.str(p.mpn),
            partType: this.str(p.part_type ?? p.partType),
            confidence: typeof p.confidence === 'number' ? p.confidence : 0,
        }));
        let upsertedCount = 0;
        for (const part of parts) {
            for (const oem of part.oemNumbers) {
                await this.upsertRef(masterProductId, 'oem', oem, part.brand, 'openai');
                upsertedCount++;
                for (const aftermarket of part.aftermarketNumbers) {
                    await this.upsertRef(masterProductId, 'alternate', aftermarket, part.brand, 'openai');
                    upsertedCount++;
                    await this.upsertRef(masterProductId, 'interchange', `${oem}↔${aftermarket}`, part.brand, 'openai');
                    upsertedCount++;
                }
            }
        }
        this.logger.log(`Cross-reference pipeline complete: ${parts.length} parts, ${upsertedCount} references upserted`);
        return {
            parts,
            totalOemNumbers: parts.reduce((s, p) => s + p.oemNumbers.length, 0),
            totalAftermarketNumbers: parts.reduce((s, p) => s + p.aftermarketNumbers.length, 0),
            totalCrossReferences: upsertedCount,
            upsertedCount,
            rawResponse: response,
        };
    }
    async processStructuredParts(parts, masterProductId) {
        let count = 0;
        for (const part of parts) {
            if (part.oemNumber) {
                await this.upsertRef(masterProductId, 'oem', part.oemNumber, part.brand ?? null, 'csv-import');
                count++;
            }
            if (part.aftermarketNumber) {
                await this.upsertRef(masterProductId, 'alternate', part.aftermarketNumber, part.brand ?? null, 'csv-import');
                count++;
            }
            if (part.oemNumber && part.aftermarketNumber) {
                await this.upsertRef(masterProductId, 'interchange', `${part.oemNumber}↔${part.aftermarketNumber}`, part.brand ?? null, 'csv-import');
                count++;
            }
        }
        return { upsertedCount: count };
    }
    async upsertRef(masterProductId, referenceType, partNumber, brand, source) {
        const existing = await this.crossRefRepo.findOne({
            where: {
                masterProductId,
                referenceType,
                partNumber,
            },
        });
        if (existing) {
            existing.brand = brand ?? existing.brand;
            existing.source = source;
            await this.crossRefRepo.save(existing);
        }
        else {
            const ref = this.crossRefRepo.create({
                masterProductId,
                referenceType,
                partNumber,
                brand,
                source,
            });
            await this.crossRefRepo.save(ref);
        }
    }
    str(v) {
        return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
    }
    toStrArray(v) {
        if (Array.isArray(v)) {
            return v
                .map((i) => (typeof i === 'string' ? i.trim() : ''))
                .filter(Boolean);
        }
        return [];
    }
};
exports.CrossReferencePipeline = CrossReferencePipeline;
exports.CrossReferencePipeline = CrossReferencePipeline = CrossReferencePipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(cross_reference_entity_js_1.CrossReference)),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService,
        typeorm_2.Repository])
], CrossReferencePipeline);
//# sourceMappingURL=cross-reference.pipeline.js.map
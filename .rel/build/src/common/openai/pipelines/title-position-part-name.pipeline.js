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
var TitlePositionPartNamePipeline_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TitlePositionPartNamePipeline = void 0;
const common_1 = require("@nestjs/common");
const openai_service_js_1 = require("../openai.service.js");
const title_position_part_name_prompt_js_1 = require("../prompts/title-position-part-name.prompt.js");
const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';
let TitlePositionPartNamePipeline = TitlePositionPartNamePipeline_1 = class TitlePositionPartNamePipeline {
    openai;
    logger = new common_1.Logger(TitlePositionPartNamePipeline_1.name);
    constructor(openai) {
        this.openai = openai;
    }
    async resolveBatch(items) {
        const results = new Map();
        for (const item of items) {
            results.set(item.id, {
                id: item.id,
                position: String(item.fallbackPosition ?? '').trim(),
                partName: String(item.fallbackPartName ?? '').trim(),
                source: 'fallback',
            });
        }
        if (items.length === 0)
            return results;
        const model = process.env.TITLE_POSITION_PART_NAME_MODEL ||
            process.env.PIPELINE_TITLE_SLOT_MODEL ||
            DEFAULT_MODEL;
        const batchSize = Math.max(1, Number(process.env.TITLE_POSITION_PART_NAME_BATCH_SIZE ?? '25') || 25);
        const concurrency = Math.max(1, Number(process.env.TITLE_POSITION_PART_NAME_CONCURRENCY ?? '5') || 5);
        const chunks = [];
        for (let i = 0; i < items.length; i += batchSize) {
            chunks.push(items.slice(i, i + batchSize));
        }
        this.logger.log(`Title position/partName: ${items.length} items, ${chunks.length} batches, model=${model}`);
        await this.mapWithConcurrency(chunks, concurrency, async (chunk) => {
            try {
                const payload = chunk.map((item) => ({
                    id: item.id,
                    description: String(item.rawDesc ?? '').slice(0, 500),
                    partNumber: item.partNumber ?? '',
                    make: item.make ?? '',
                    model: item.model ?? '',
                    year: item.year ?? '',
                    categoryName: item.categoryName ?? '',
                    hintPosition: item.fallbackPosition ?? '',
                    hintPartName: item.fallbackPartName ?? '',
                }));
                const response = await this.openai.chat({
                    systemPrompt: title_position_part_name_prompt_js_1.TITLE_POSITION_PART_NAME_PROMPT.systemPrompt,
                    userPrompt: `Extract position and partName for these ${payload.length} items:\n\n${JSON.stringify(payload)}\n\n${title_position_part_name_prompt_js_1.TITLE_POSITION_PART_NAME_PROMPT.userPrompt}`,
                    jsonMode: true,
                    temperature: title_position_part_name_prompt_js_1.TITLE_POSITION_PART_NAME_PROMPT.temperature,
                    maxTokens: title_position_part_name_prompt_js_1.TITLE_POSITION_PART_NAME_PROMPT.maxTokens,
                    model,
                    costLane: 'title-position-part-name',
                });
                const parsed = response.content;
                for (const row of parsed?.results ?? []) {
                    if (!row || typeof row.id !== 'string')
                        continue;
                    const existing = results.get(row.id);
                    if (!existing)
                        continue;
                    const position = this.sanitizeSlot(row.position, 28);
                    const partName = this.sanitizeSlot(row.partName, 48);
                    results.set(row.id, {
                        id: row.id,
                        position: position || existing.position,
                        partName: partName || existing.partName,
                        source: position || partName ? 'gemini' : existing.source,
                    });
                }
            }
            catch (err) {
                this.logger.warn(`Title position/partName batch of ${chunk.length} failed: ${String(err)} — using fallbacks`);
            }
        });
        return results;
    }
    sanitizeSlot(value, maxLen) {
        if (value == null)
            return '';
        let s = String(value)
            .replace(/[^A-Za-z0-9\s\-/&.,+]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (s.length > maxLen) {
            const cut = s.slice(0, maxLen);
            const lastSpace = cut.lastIndexOf(' ');
            s = (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
        }
        return s;
    }
    async mapWithConcurrency(items, concurrency, fn) {
        const results = new Array(items.length);
        let next = 0;
        const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
            while (next < items.length) {
                const i = next++;
                results[i] = await fn(items[i]);
            }
        });
        await Promise.all(workers);
        return results;
    }
};
exports.TitlePositionPartNamePipeline = TitlePositionPartNamePipeline;
exports.TitlePositionPartNamePipeline = TitlePositionPartNamePipeline = TitlePositionPartNamePipeline_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService])
], TitlePositionPartNamePipeline);
//# sourceMappingURL=title-position-part-name.pipeline.js.map
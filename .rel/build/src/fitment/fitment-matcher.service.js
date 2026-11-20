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
var FitmentMatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FitmentMatcherService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fitment_make_entity_js_1 = require("./entities/fitment-make.entity.js");
const fitment_model_entity_js_1 = require("./entities/fitment-model.entity.js");
const fitment_engine_entity_js_1 = require("./entities/fitment-engine.entity.js");
let FitmentMatcherService = FitmentMatcherService_1 = class FitmentMatcherService {
    makeRepo;
    modelRepo;
    engineRepo;
    logger = new common_1.Logger(FitmentMatcherService_1.name);
    constructor(makeRepo, modelRepo, engineRepo) {
        this.makeRepo = makeRepo;
        this.modelRepo = modelRepo;
        this.engineRepo = engineRepo;
    }
    async detectFromText(text) {
        const results = [];
        const yearRangePattern = /(\d{4})\s*[-–]\s*(\d{4})\s+([A-Za-z-]+)\s+([A-Za-z0-9 -]+?)(?:\s+(LE|SE|XLE|XSE|SR|SR5|TRD|Sport|Limited|Base|Premium|Touring|EX|LX|DX|SV|SL|S|LT|LS|RS|SS|GT|ST|SEL|Titanium))?(?:\s+(\d\.\d+L\s*(?:I\d|V\d|H\d|L\d)?))?/gi;
        let match;
        while ((match = yearRangePattern.exec(text)) !== null) {
            const yearStart = parseInt(match[1], 10);
            const yearEnd = parseInt(match[2], 10);
            const makeName = match[3];
            const modelName = match[4].trim();
            const submodel = match[5] || undefined;
            const engineCode = match[6] || undefined;
            const makeMatch = await this.fuzzyMatchMake(makeName);
            if (!makeMatch)
                continue;
            const modelMatch = await this.fuzzyMatchModel(makeMatch.id, modelName);
            if (!modelMatch)
                continue;
            results.push({
                makeSlug: makeMatch.slug,
                modelSlug: modelMatch.slug,
                submodel,
                yearStart,
                yearEnd,
                engineCode,
                confidence: this.calculateConfidence(makeMatch.name, makeName, modelMatch.name, modelName),
            });
        }
        const singleYearPattern = /\b(\d{4})\s+([A-Za-z-]+)\s+([A-Za-z0-9 -]+?)(?:\s+(LE|SE|XLE|XSE|SR|SR5|TRD|Sport|Limited|Base|Premium|Touring|EX|LX|DX|SV|SL|S|LT|LS|RS|SS|GT|ST|SEL|Titanium))?\b/gi;
        while ((match = singleYearPattern.exec(text)) !== null) {
            const year = parseInt(match[1], 10);
            const makeName = match[2];
            const modelName = match[3].trim();
            const submodel = match[4] || undefined;
            const makeMatch = await this.fuzzyMatchMake(makeName);
            if (!makeMatch)
                continue;
            const modelMatch = await this.fuzzyMatchModel(makeMatch.id, modelName);
            if (!modelMatch)
                continue;
            const alreadyFound = results.some((r) => r.makeSlug === makeMatch.slug && r.modelSlug === modelMatch.slug);
            if (alreadyFound)
                continue;
            results.push({
                makeSlug: makeMatch.slug,
                modelSlug: modelMatch.slug,
                submodel,
                yearStart: year,
                yearEnd: year,
                confidence: this.calculateConfidence(makeMatch.name, makeName, modelMatch.name, modelName) * 0.9,
            });
        }
        this.logger.log(`Detected ${results.length} fitment(s) from text`);
        return results;
    }
    async fuzzyMatchMake(name) {
        const exact = await this.makeRepo.findOne({
            where: { slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-') },
        });
        if (exact)
            return exact;
        const fuzzy = await this.makeRepo.find({
            where: { name: (0, typeorm_2.ILike)(`%${name}%`) },
            take: 1,
        });
        return fuzzy[0] ?? null;
    }
    async fuzzyMatchModel(makeId, name) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const exact = await this.modelRepo.findOne({
            where: { makeId, slug },
        });
        if (exact)
            return exact;
        const fuzzy = await this.modelRepo.find({
            where: { makeId, name: (0, typeorm_2.ILike)(`%${name}%`) },
            take: 1,
        });
        return fuzzy[0] ?? null;
    }
    calculateConfidence(dbMake, inputMake, dbModel, inputModel) {
        const makeScore = dbMake.toLowerCase() === inputMake.toLowerCase() ? 1.0 : 0.8;
        const modelScore = dbModel.toLowerCase() === inputModel.toLowerCase() ? 1.0 : 0.75;
        return (makeScore + modelScore) / 2;
    }
};
exports.FitmentMatcherService = FitmentMatcherService;
exports.FitmentMatcherService = FitmentMatcherService = FitmentMatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(fitment_make_entity_js_1.FitmentMake)),
    __param(1, (0, typeorm_1.InjectRepository)(fitment_model_entity_js_1.FitmentModel)),
    __param(2, (0, typeorm_1.InjectRepository)(fitment_engine_entity_js_1.FitmentEngine)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], FitmentMatcherService);
//# sourceMappingURL=fitment-matcher.service.js.map
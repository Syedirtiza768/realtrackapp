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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingQualityValidator = void 0;
exports.scoreItem = scoreItem;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ebay_taxonomy_truth_service_js_1 = require("./ebay-taxonomy-truth.service.js");
const platform_generation_util_js_1 = require("../../fitment/platform-generation.util.js");
const REQUIRED_SPECIFICS = [
    'Brand',
    'Manufacturer Part Number',
    'Type',
    'Placement on Vehicle',
];
const SOFT_SPECIFICS = new Set(['Placement on Vehicle']);
const TITLE_MAKE_PATTERN = /mercedes|bmw|toyota|lexus|ford|lincoln|honda|acura|audi|volkswagen|vw|porsche|jaguar|land\s*rover|range\s*rover|nissan|infiniti|chevrolet|chevy|gmc|cadillac|buick|dodge|chrysler|jeep|ram|hyundai|kia|genesis|mazda|subaru|mitsubishi|volvo|mini|bentley|tesla|fiat|alfa\s*romeo|maserati|smart|saab|suzuki|isuzu/i;
function scoreItem(item, srcPart) {
    const flags = [];
    const title = String(item.title || '');
    const titleWithinLimit = title.length > 0 && title.length <= 80;
    const titleScore = [
        titleWithinLimit,
        /\b(19|20)\d{2}\b/.test(title),
        TITLE_MAKE_PATTERN.test(title),
        /\bOEM\b|\bGenuine\b|\bUsed\b/i.test(title),
    ].filter(Boolean).length;
    const desc = String(item.description || '');
    const descScore = [
        /<h[34]>|<ul>|<li>/i.test(desc),
        /verify part number compatibility/i.test(desc),
        /compatib/i.test(desc),
        /used|removed|inspected|tested/i.test(desc),
        desc.length > 300,
    ].filter(Boolean).length;
    const sp = typeof item.itemSpecifics === 'object' && item.itemSpecifics
        ? item.itemSpecifics
        : {};
    const requiredSpecificsFilled = REQUIRED_SPECIFICS.filter((k) => sp[k] && String(sp[k]).trim()).length;
    const provided = String(srcPart.partNumber || '')
        .replace(/\s+/g, '')
        .toLowerCase();
    const mpn = String(item.mpn || sp['Manufacturer Part Number'] || '')
        .replace(/\s+/g, '')
        .toLowerCase();
    const mpnMatchesProvided = provided.length > 0 &&
        (mpn.includes(provided.slice(0, 8)) || mpn === provided);
    if (mpn && provided && !mpn.includes(provided.slice(0, 6))) {
        flags.push(`MPN_MISMATCH provided=${srcPart.partNumber} got=${item.mpn}`);
    }
    const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
    const fitmentRows = compat.length;
    const years = new Set(compat.map((c) => String(c.year)));
    const donorMake = (srcPart.donorMake || 'mercedes').toLowerCase();
    const fitmentAllMercedes = compat.length > 0 &&
        compat.every((c) => String(c.make || '')
            .toLowerCase()
            .includes(donorMake.split('-')[0]));
    const nonDonor = compat.filter((c) => c.make && !String(c.make).toLowerCase().includes(donorMake.split('-')[0]));
    if (nonDonor.length && donorMake.includes('mercedes')) {
        flags.push(`CROSS_MAKE x${nonDonor.length}: ${[...new Set(nonDonor.map((c) => c.make))].join(',')}`);
    }
    const badYears = [...years].filter((y) => Number(y) < 1995 || Number(y) > 2030);
    if (badYears.length)
        flags.push(`IMPLAUSIBLE_YEARS: ${badYears.join(',')}`);
    const composite = Math.round((titleScore / 4) * 25 +
        (descScore / 5) * 20 +
        (requiredSpecificsFilled / 4) * 20 +
        (Math.min(fitmentRows, 12) / 12) * 20 +
        (compat.some((c) => /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(String(c.chassisCode || c.submodel || c.model || ''))) ||
            /w20[0-9]|al\d{2}|xv\d{2}/i.test(title) ||
            (/\b(19|20)\d{2}\b/.test(title) && TITLE_MAKE_PATTERN.test(title))
            ? 10
            : 0) +
        (mpnMatchesProvided ? 5 : 0));
    return {
        composite,
        titleWithinLimit,
        mpnMatchesProvided,
        fitmentRows,
        fitmentAllMercedes,
        flags,
    };
}
let ListingQualityValidator = class ListingQualityValidator {
    config;
    taxonomyTruth;
    fitmentMinRows;
    constructor(config, taxonomyTruth) {
        this.config = config;
        this.taxonomyTruth = taxonomyTruth;
        this.fitmentMinRows = Number(this.config.get('AI_FITMENT_MIN_ROWS', '5'));
    }
    async validateWithTaxonomy(item, srcPart, options) {
        const base = this.validate(item, srcPart, {
            expectedBatchSize: options?.expectedBatchSize,
            actualBatchSize: options?.actualBatchSize,
            compactProfile: options?.compactProfile,
        });
        const ebayCategoryId = options?.ebayCategoryId ??
            (typeof item.ebayCategoryId === 'string' ? item.ebayCategoryId : null) ??
            (typeof item.categoryId === 'string' ? item.categoryId : null);
        const sp = typeof item.itemSpecifics === 'object' && item.itemSpecifics
            ? item.itemSpecifics
            : {};
        const taxonomy = await this.taxonomyTruth.validate(ebayCategoryId, sp);
        if (taxonomy.skipped)
            return base;
        const hardFails = [...base.hardFails, ...taxonomy.hardFails];
        const softFails = [...base.softFails, ...taxonomy.softFails];
        const pass = hardFails.length === 0;
        return {
            ...base,
            pass,
            hardFails,
            softFails,
            escalate: hardFails.length > 0,
        };
    }
    validate(item, srcPart, options) {
        const hardFails = [];
        const softFails = [];
        if (options?.expectedBatchSize != null &&
            options.actualBatchSize != null &&
            options.actualBatchSize !== options.expectedBatchSize) {
            hardFails.push(`WRONG_ITEM_COUNT expected=${options.expectedBatchSize} got=${options.actualBatchSize}`);
        }
        const score = scoreItem(item, srcPart);
        if (!score.mpnMatchesProvided) {
            hardFails.push('MPN_MISMATCH');
        }
        if (!score.titleWithinLimit) {
            hardFails.push('TITLE_OVER_80');
        }
        const sp = typeof item.itemSpecifics === 'object' && item.itemSpecifics
            ? item.itemSpecifics
            : {};
        const title = String(item.title || '');
        const titleMake = sp.Brand ||
            (typeof item.brand === 'string' ? item.brand : '') ||
            srcPart.donorMake ||
            '';
        const titleModel = sp.Model || (typeof item.model === 'string' ? item.model : '') || '';
        const donorYear = typeof srcPart.donorYear ===
            'number' ||
            typeof srcPart.donorYear === 'string'
            ? srcPart.donorYear
            : title.match(/\b(19|20)\d{2}\b/)?.[0];
        const generationMismatch = (0, platform_generation_util_js_1.detectTitleGenerationMismatch)(title, titleMake, titleModel, donorYear);
        if (generationMismatch) {
            hardFails.push(`GENERATION_YEAR_MISMATCH:${generationMismatch}`);
        }
        for (const key of REQUIRED_SPECIFICS) {
            if (!sp[key] || !String(sp[key]).trim()) {
                if (SOFT_SPECIFICS.has(key)) {
                    softFails.push(`MISSING_SPECIFIC:${key}`);
                }
                else {
                    hardFails.push(`MISSING_SPECIFIC:${key}`);
                }
            }
        }
        for (const flag of score.flags) {
            if (flag.startsWith('CROSS_MAKE'))
                hardFails.push(flag);
            if (flag.startsWith('IMPLAUSIBLE_YEARS'))
                hardFails.push(flag);
            if (flag.startsWith('MPN_MISMATCH'))
                hardFails.push(flag);
        }
        const compactProfile = options?.compactProfile === true;
        const fitmentMinRows = compactProfile ? 0 : this.fitmentMinRows;
        if (!compactProfile && score.fitmentRows < fitmentMinRows) {
            softFails.push(`FITMENT_ROWS_LOW:${score.fitmentRows}`);
        }
        const desc = String(item.description || '');
        if (!/<h[34]>|<ul>/i.test(desc)) {
            softFails.push('DESC_NO_HTML_STRUCTURE');
        }
        if (!compactProfile && !/compatib/i.test(desc)) {
            softFails.push('DESC_NO_COMPAT_SECTION');
        }
        const compat = Array.isArray(item.compatibility) ? item.compatibility : [];
        const hasChassisSignal = /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(title) ||
            compat.some((c) => /w20[0-9]|al\d{2}|xv\d{2}|xe\d{2}|xu\d{2}|f\d{1,2}x|e\d{2}/i.test(String(c.chassisCode || c.submodel || '')));
        if (!compactProfile && !hasChassisSignal) {
            softFails.push('NO_CHASSIS_CODE');
        }
        const pass = hardFails.length === 0;
        return {
            pass,
            score: score.composite,
            hardFails,
            softFails,
            escalate: hardFails.length > 0,
            fitmentRowCount: score.fitmentRows,
        };
    }
};
exports.ListingQualityValidator = ListingQualityValidator;
exports.ListingQualityValidator = ListingQualityValidator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ebay_taxonomy_truth_service_js_1.EbayTaxonomyTruthService])
], ListingQualityValidator);
//# sourceMappingURL=listing-quality.validator.js.map
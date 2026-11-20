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
var FashionVisionCheckService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FashionVisionCheckService = exports.VISION_PROMPT_VERSION = void 0;
exports.parseVisionVerdict = parseVisionVerdict;
exports.visionIssues = visionIssues;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const openai_service_js_1 = require("../common/openai/openai.service.js");
const storage_service_js_1 = require("../storage/storage.service.js");
const fashion_compliance_rules_js_1 = require("./fashion-compliance.rules.js");
const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite';
const DEFAULT_FALLBACK = 'google/gemma-4-31b-it';
const MAX_VISION_IMAGES = 8;
exports.VISION_PROMPT_VERSION = 'fashion-compliance-v1';
const SYSTEM_PROMPT = `You check second-hand fashion listings for counterfeit and eBay VeRO risk before they are published.
You receive the listing text and its photos (numbered from 0 in the order given).
Report only what is visible. Do not guess. Sub-brands and house lines count as the same brand
(e.g. "BOSS" = "Hugo Boss", "Polo Ralph Lauren" = "Ralph Lauren", "MICHAEL Michael Kors" = "Michael Kors").
A photo of a care label, size tag or brand tag of the same item is NOT a different product.
Return strict JSON only:
{
 "visibleBrands": [{"imageIndex": 0, "brand": "string", "where": "chest logo|label|hardware|print"}],
 "logoMatchesDeclaredBrand": true | false | null,   // null if no logo/label is legible
 "logoConcerns": [{"imageIndex": 0, "type": "mismatch|distorted|misspelled", "detail": "string"}],
 "images": [{"index": 0, "watermarkOrOtherSellerBranding": false, "stockOrCatalogPhoto": false,
   "showsDifferentProduct": false, "colorOrTypeMismatch": false, "collage": false,
   "heavyTextOverlay": false, "blurry": false, "note": "string"}],
 "suggestedFix": null | {"title": "string <= 80 chars or null", "brand": "string or null",
   "description": "string or null", "rationale": "string"}
}
Rules for suggestedFix: only when textIssues is non-empty. Make the listing accurate: remove comparisons
to other brands and replica-type wording, use only the brand the labels/logos actually show, keep the
item type, size, colour and material. Never add a brand that is not visible or declared. If the item
looks counterfeit, set suggestedFix to null.`;
let FashionVisionCheckService = FashionVisionCheckService_1 = class FashionVisionCheckService {
    openai;
    storage;
    config;
    logger = new common_1.Logger(FashionVisionCheckService_1.name);
    constructor(openai, storage, config) {
        this.openai = openai;
        this.storage = storage;
        this.config = config;
    }
    fingerprint(input) {
        return (0, node_crypto_1.createHash)('sha256')
            .update(JSON.stringify({
            v: exports.VISION_PROMPT_VERSION,
            t: input.title,
            b: input.brand,
            d: (input.description ?? '').slice(0, 1500),
            i: input.images.map((i) => i.hash),
            x: input.textIssues.map((i) => i.code).sort(),
        }))
            .digest('hex');
    }
    models() {
        const primary = this.config.get('FASHION_COMPLIANCE_MODEL')?.trim() ||
            this.config.get('FASHION_AI_MODEL')?.trim() ||
            DEFAULT_MODEL;
        const fb = this.config.get('FASHION_AI_FALLBACK_MODEL')?.trim() ||
            DEFAULT_FALLBACK;
        return [...new Set([primary, fb.toLowerCase() === 'none' ? null : fb])].filter((m) => !!m);
    }
    async check(input) {
        const selected = input.images.slice(0, MAX_VISION_IMAGES);
        if (!selected.length)
            throw new Error('No processed images to check');
        const imageUrls = await Promise.all(selected.map(async (img) => {
            const key = img.keys.small ?? img.keys.large;
            if (!key)
                throw new Error(`Image ${img.index} has no small variant`);
            const buf = await this.storage.getObjectBuffer(key);
            return `data:image/webp;base64,${buf.toString('base64')}`;
        }));
        const userPrompt = JSON.stringify({
            listing: {
                title: input.title,
                declaredBrand: input.brand,
                category: input.categoryName,
                color: input.color,
                description: (input.description ?? '').slice(0, 1500),
            },
            photoOrder: selected.map((img, i) => ({ photo: i, listingImageIndex: img.index })),
            textIssues: input.textIssues
                .filter((i) => i.severity === 'review' || i.severity === 'block')
                .map((i) => ({ code: i.code, message: i.message })),
        });
        const failures = [];
        for (const model of this.models()) {
            try {
                const res = await this.openai.chat({
                    model,
                    costLane: 'fashion-compliance',
                    systemPrompt: SYSTEM_PROMPT,
                    userPrompt,
                    imageUrls,
                    jsonMode: true,
                    temperature: 0,
                    maxTokens: 2000,
                });
                if (res.finishReason === 'length')
                    throw new Error('reply was cut off');
                const verdict = parseVisionVerdict(res.content, selected);
                verdict.model = res.model || model;
                return verdict;
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                failures.push(`${model}: ${msg}`);
                this.logger.warn(`Fashion compliance vision with ${model} failed: ${msg}`);
            }
        }
        throw new Error(`Vision check unavailable (${failures.join('; ')})`);
    }
};
exports.FashionVisionCheckService = FashionVisionCheckService;
exports.FashionVisionCheckService = FashionVisionCheckService = FashionVisionCheckService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_js_1.OpenAiService,
        storage_service_js_1.StorageService,
        config_1.ConfigService])
], FashionVisionCheckService);
function asObject(value) {
    if (typeof value === 'string') {
        try {
            return asObject(JSON.parse(value.replace(/^```(?:json)?|```$/g, '').trim()));
        }
        catch {
            return {};
        }
    }
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
const bool = (v) => v === true || v === 'true';
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function parseVisionVerdict(content, sent) {
    const raw = asObject(content);
    if (!Object.keys(raw).length)
        throw new Error('reply had no JSON');
    const toListingIndex = (n) => {
        const i = Number(n);
        return Number.isInteger(i) && i >= 0 && i < sent.length ? sent[i].index : null;
    };
    const visibleBrands = (Array.isArray(raw.visibleBrands) ? raw.visibleBrands : [])
        .map((b) => asObject(b))
        .map((b) => ({
        imageIndex: toListingIndex(b.imageIndex),
        brand: str(b.brand),
        where: str(b.where) ?? undefined,
    }))
        .filter((b) => b.imageIndex !== null && !!b.brand);
    const logoConcerns = (Array.isArray(raw.logoConcerns) ? raw.logoConcerns : [])
        .map((c) => asObject(c))
        .map((c) => ({
        imageIndex: toListingIndex(c.imageIndex),
        type: String(c.type ?? '').toLowerCase(),
        detail: str(c.detail) ?? undefined,
    }))
        .filter((c) => c.imageIndex !== null && ['mismatch', 'distorted', 'misspelled'].includes(c.type));
    const images = (Array.isArray(raw.images) ? raw.images : [])
        .map((i) => asObject(i))
        .map((i) => ({
        index: toListingIndex(i.index),
        watermarkOrOtherSellerBranding: bool(i.watermarkOrOtherSellerBranding),
        stockOrCatalogPhoto: bool(i.stockOrCatalogPhoto),
        showsDifferentProduct: bool(i.showsDifferentProduct),
        colorOrTypeMismatch: bool(i.colorOrTypeMismatch),
        collage: bool(i.collage),
        heavyTextOverlay: bool(i.heavyTextOverlay),
        blurry: bool(i.blurry),
        note: str(i.note) ?? undefined,
    }))
        .filter((i) => i.index !== null);
    const fix = asObject(raw.suggestedFix);
    const suggestedTitle = str(fix.title);
    const suggestedFix = Object.keys(fix).length && (suggestedTitle || str(fix.brand) || str(fix.description))
        ? {
            title: suggestedTitle ? suggestedTitle.slice(0, fashion_compliance_rules_js_1.EBAY_TITLE_MAX) : null,
            brand: str(fix.brand),
            description: str(fix.description),
            rationale: str(fix.rationale) ?? '',
        }
        : null;
    const lm = raw.logoMatchesDeclaredBrand;
    return {
        visibleBrands,
        logoMatchesDeclaredBrand: lm === true || lm === false ? lm : null,
        logoConcerns,
        images,
        suggestedFix,
    };
}
function visionIssues(verdict, images) {
    const issues = [];
    const drop = new Map();
    const usable = images.filter((i) => !i.excluded && !i.error);
    const mismatch = verdict.logoMatchesDeclaredBrand === false ||
        verdict.logoConcerns.some((c) => c.type === 'mismatch');
    if (mismatch) {
        const seen = verdict.visibleBrands.map((b) => b.brand).join(', ');
        issues.push({
            code: 'LOGO_BRAND_MISMATCH',
            severity: 'block',
            field: 'images',
            source: 'vision',
            evidence: seen || verdict.logoConcerns.find((c) => c.type === 'mismatch')?.detail,
            imageIndex: verdict.logoConcerns.find((c) => c.type === 'mismatch')?.imageIndex,
            message: `Visible logo/label (${seen || 'see photo'}) does not match the listing brand`,
        });
    }
    for (const c of verdict.logoConcerns.filter((x) => x.type !== 'mismatch')) {
        issues.push({
            code: c.type === 'misspelled' ? 'LOGO_MISSPELLED' : 'LOGO_DISTORTED',
            severity: 'review',
            field: 'images',
            source: 'vision',
            imageIndex: c.imageIndex,
            evidence: c.detail,
            message: `Logo looks ${c.type} in photo ${c.imageIndex + 1}${c.detail ? `: ${c.detail}` : ''}`,
        });
    }
    const autoDrop = [
        ['watermarkOrOtherSellerBranding', 'IMAGE_WATERMARK', 'watermark or another seller\'s branding'],
        ['showsDifferentProduct', 'IMAGE_OFF_PRODUCT', 'shows a different product'],
        ['colorOrTypeMismatch', 'IMAGE_OFF_PRODUCT', 'colour or item type differs from the title'],
        ['collage', 'IMAGE_COLLAGE', 'collage of several photos'],
        ['heavyTextOverlay', 'IMAGE_TEXT_OVERLAY', 'heavy text overlay'],
    ];
    for (const f of verdict.images) {
        const image = images.find((i) => i.index === f.index);
        if (!image || image.excluded || image.error)
            continue;
        for (const [key, code, label] of autoDrop) {
            if (!f[key] || drop.has(f.index))
                continue;
            drop.set(f.index, { code, reason: `Photo ${f.index + 1}: ${label}` });
        }
        if (f.stockOrCatalogPhoto) {
            issues.push({
                code: 'IMAGE_STOCK_PHOTO',
                severity: 'review',
                field: 'images',
                source: 'vision',
                imageIndex: f.index,
                message: `Photo ${f.index + 1} looks like a stock or catalog image, not a photo of this item`,
            });
        }
        if (f.blurry) {
            issues.push({
                code: 'IMAGE_BLURRY',
                severity: 'warn',
                field: 'images',
                source: 'vision',
                imageIndex: f.index,
                message: `Photo ${f.index + 1} is blurry`,
            });
        }
    }
    const remaining = usable.filter((i) => !drop.has(i.index));
    if (drop.size && !remaining.length) {
        for (const [index, d] of drop) {
            issues.push({
                code: d.code,
                severity: 'review',
                field: 'images',
                source: 'vision',
                imageIndex: index,
                message: `${d.reason} (every photo is affected, so none were removed)`,
            });
        }
        drop.clear();
    }
    else {
        for (const [index, d] of drop) {
            issues.push({
                code: d.code,
                severity: 'warn',
                field: 'images',
                source: 'vision',
                imageIndex: index,
                autoFixed: true,
                message: `${d.reason}; removed from the eBay photo set`,
            });
        }
    }
    return { issues, dropIndexes: drop };
}
//# sourceMappingURL=fashion-vision-check.service.js.map
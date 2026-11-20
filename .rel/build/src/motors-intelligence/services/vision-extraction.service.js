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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var VisionExtractionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionExtractionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
const openai_types_js_1 = require("../../common/openai/openai.types.js");
const entities_1 = require("../entities");
const MOTORS_VISION_PROMPT = `You are an expert eBay Motors parts identification system. Analyze the provided image(s) of an automotive part or its packaging.

Extract the following information in strict JSON format:

{
  "visible_text": ["all text visible in the image, line by line"],
  "brand": "manufacturer/brand name if visible",
  "mpn": "manufacturer part number if visible (stamped, printed, or on label)",
  "oem_number": "OEM/OE part number if visible",
  "product_type": "specific part type (e.g., Brake Caliper, Alternator, Wheel Hub)",
  "product_family": "broader category (e.g., Braking System, Electrical, Suspension)",
  "placement": "placement on vehicle if determinable (Front, Rear, Left, Right, Front Left, etc.)",
  "material": "material if identifiable (Cast Iron, Aluminum, Steel, Ceramic, etc.)",
  "finish": "surface finish if visible (Uncoated, Powder Coated, Chrome, Anodized, etc.)",
  "condition": "New, Remanufactured, Used - only if clearly determinable",
  "quantity": "quantity in package if visible (e.g., '1', '2', 'Pair', 'Set of 4')",
  "side_orientation": "Left, Right, or Both if determinable",
  "front_rear": "Front, Rear, or Both if determinable",
  "dimensions": {
    "length": "if visible with unit",
    "width": "if visible with unit",
    "height": "if visible with unit",
    "diameter": "if visible with unit",
    "weight": "if visible with unit"
  },
  "features": ["notable features visible (e.g., 'With Bracket', 'Hardware Included', 'Pre-loaded')"],
  "fitment_raw": [
    {
      "year_range": "year or year range if visible",
      "make": "vehicle make if visible",
      "model": "vehicle model if visible",
      "engine": "engine spec if visible"
    }
  ],
  "packaging_identifiers": ["barcodes, UPC/EAN numbers, catalog numbers visible on packaging"],
  "confidence": {
    "brand": 0.0,
    "mpn": 0.0,
    "product_type": 0.0,
    "placement": 0.0,
    "condition": 0.0,
    "overall": 0.0
  }
}

Rules:
- Only report what you can actually see or strongly infer from the image
- Confidence scores from 0.0 to 1.0
- Do not guess part numbers - only report clearly visible ones
- If a field is not determinable, use null
- For fitment, only include if visible on label/packaging
- Distinguish between stamped/molded part numbers and label-printed ones
- Note if the part appears to be aftermarket vs OEM
- Report ALL visible text, including small print`;
let VisionExtractionService = VisionExtractionService_1 = class VisionExtractionService {
    extractedAttrRepo;
    correctionRuleRepo;
    configService;
    logger = new common_1.Logger(VisionExtractionService_1.name);
    openai = null;
    constructor(extractedAttrRepo, correctionRuleRepo, configService) {
        this.extractedAttrRepo = extractedAttrRepo;
        this.correctionRuleRepo = correctionRuleRepo;
        this.configService = configService;
        const apiKey = this.configService.get('OPENAI_API_KEY');
        const baseURL = this.configService.get('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1');
        if (apiKey) {
            this.openai = new openai_1.default({
                apiKey,
                baseURL,
                defaultHeaders: {
                    'HTTP-Referer': 'https://app.omnicoreholding.com',
                    'X-Title': 'Omni Core',
                },
            });
        }
    }
    async extractFromImages(motorsProductId, imageUrls) {
        const startTime = Date.now();
        const model = this.configService.get('OPENAI_VISION_MODEL') ||
            'minimax/minimax-m3';
        if (!this.openai) {
            throw new Error('AI API key not configured');
        }
        const imageContent = imageUrls.map((url) => ({
            type: 'image_url',
            image_url: { url, detail: 'high' },
        }));
        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a precise automotive parts identification system. Always respond with valid JSON only.',
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: MOTORS_VISION_PROMPT },
                            ...imageContent,
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 4096,
                response_format: { type: 'json_object' },
            });
            const latencyMs = Date.now() - startTime;
            const choice = response.choices?.[0];
            if (!choice) {
                const upstreamError = response
                    ?.error?.message;
                throw new Error(`AI vision response missing choices (possible upstream refusal/error): ${upstreamError ?? 'empty choices array'}`);
            }
            const rawContent = choice.message?.content || '{}';
            const parsed = JSON.parse(rawContent);
            const usage = response.usage;
            const promptTokens = usage?.prompt_tokens ?? 0;
            const completionTokens = usage?.completion_tokens ?? 0;
            const tokensUsed = promptTokens + completionTokens;
            const costUsd = (0, openai_types_js_1.estimateCost)(model, promptTokens, completionTokens) +
                imageUrls.length * 0.025;
            const result = this.mapVisionResponse(parsed);
            const normalizedOutput = await this.applyCorrections(result);
            const extracted = this.extractedAttrRepo.create({
                motorsProductId,
                extractionSource: entities_1.ExtractionSource.VISION_AI,
                rawOcrText: (parsed.visible_text || []).join('\n'),
                rawModelOutput: parsed,
                extractedBrand: result.extractedBrand,
                extractedMpn: result.extractedMpn,
                extractedOemNumber: result.extractedOemNumber,
                extractedProductType: result.extractedProductType,
                extractedProductFamily: result.extractedProductFamily,
                extractedPlacement: result.extractedPlacement,
                extractedMaterial: result.extractedMaterial,
                extractedFinish: result.extractedFinish,
                extractedCondition: result.extractedCondition,
                extractedQuantity: result.extractedQuantity,
                extractedSideOrientation: result.extractedSideOrientation,
                extractedFrontRear: result.extractedFrontRear,
                extractedDimensions: result.extractedDimensions,
                extractedFeatures: result.extractedFeatures,
                extractedFitmentRaw: result.extractedFitmentRaw,
                visibleTextLines: result.visibleTextLines,
                packagingIdentifiers: result.packagingIdentifiers,
                confidenceScores: result.confidenceScores,
                normalizedOutput,
                aiProvider: 'minimax-m3',
                aiModel: model,
                tokensUsed,
                latencyMs,
                costUsd,
            });
            return this.extractedAttrRepo.save(extracted);
        }
        catch (error) {
            this.logger.error(`Vision extraction failed for ${motorsProductId}: ${error.message}`);
            throw error;
        }
    }
    async extractMpnFromText(motorsProductId, text) {
        const mpnPatterns = [
            /\b([A-Z]{1,5}[-.]?\d{3,10}[-.]?[A-Z0-9]{0,5})\b/gi,
            /\b(\d{5,12})\b/g,
            /\b([A-Z]{2,4}\d{4,8}[A-Z]?)\b/gi,
        ];
        const extractedMpns = [];
        for (const pattern of mpnPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                extractedMpns.push(...matches);
            }
        }
        const uniqueMpns = [...new Set(extractedMpns)];
        const primaryMpn = uniqueMpns.length > 0 ? uniqueMpns[0] : null;
        const extracted = this.extractedAttrRepo.create({
            motorsProductId,
            extractionSource: entities_1.ExtractionSource.REGEX,
            rawOcrText: text,
            extractedMpn: primaryMpn,
            visibleTextLines: text.split('\n').filter(Boolean),
            packagingIdentifiers: uniqueMpns,
            confidenceScores: {
                mpn: primaryMpn ? 0.7 : 0,
            },
        });
        return this.extractedAttrRepo.save(extracted);
    }
    async extractFromSupplierData(motorsProductId, supplierData) {
        const fieldMap = {
            brand: 'extractedBrand',
            manufacturer: 'extractedBrand',
            mpn: 'extractedMpn',
            part_number: 'extractedMpn',
            manufacturer_part_number: 'extractedMpn',
            oem: 'extractedOemNumber',
            oem_number: 'extractedOemNumber',
            oe_number: 'extractedOemNumber',
            type: 'extractedProductType',
            part_type: 'extractedProductType',
            product_type: 'extractedProductType',
            placement: 'extractedPlacement',
            position: 'extractedPlacement',
            material: 'extractedMaterial',
            finish: 'extractedFinish',
            condition: 'extractedCondition',
            quantity: 'extractedQuantity',
        };
        const extracted = {
            motorsProductId,
            extractionSource: entities_1.ExtractionSource.SUPPLIER_DATA,
            rawModelOutput: supplierData,
        };
        const confidenceScores = {};
        for (const [sourceKey, targetField] of Object.entries(fieldMap)) {
            const value = supplierData[sourceKey] || supplierData[sourceKey.toUpperCase()];
            if (value) {
                extracted[targetField] = String(value).trim();
                const fieldName = targetField.replace('extracted', '').toLowerCase();
                confidenceScores[fieldName] = 0.85;
            }
        }
        if (supplierData.features) {
            extracted.extractedFeatures = Array.isArray(supplierData.features)
                ? supplierData.features
                : String(supplierData.features)
                    .split(',')
                    .map((f) => f.trim());
        }
        if (supplierData.fitment ||
            supplierData.applications ||
            supplierData.compatibility) {
            const fitmentData = supplierData.fitment ||
                supplierData.applications ||
                supplierData.compatibility;
            extracted.extractedFitmentRaw = Array.isArray(fitmentData)
                ? fitmentData
                : [fitmentData];
        }
        extracted.confidenceScores = confidenceScores;
        const normalizedOutput = await this.applyCorrections(extracted);
        extracted.normalizedOutput = normalizedOutput;
        const entity = this.extractedAttrRepo.create(extracted);
        return this.extractedAttrRepo.save(entity);
    }
    async getExtractions(motorsProductId) {
        return this.extractedAttrRepo.find({
            where: { motorsProductId },
            order: { createdAt: 'DESC' },
        });
    }
    mapVisionResponse(parsed) {
        return {
            extractedBrand: parsed.brand || null,
            extractedMpn: parsed.mpn || null,
            extractedOemNumber: parsed.oem_number || null,
            extractedProductType: parsed.product_type || null,
            extractedProductFamily: parsed.product_family || null,
            extractedPlacement: parsed.placement || null,
            extractedMaterial: parsed.material || null,
            extractedFinish: parsed.finish || null,
            extractedCondition: parsed.condition || null,
            extractedQuantity: parsed.quantity || null,
            extractedSideOrientation: parsed.side_orientation || null,
            extractedFrontRear: parsed.front_rear || null,
            extractedDimensions: parsed.dimensions || null,
            extractedFeatures: parsed.features || null,
            extractedFitmentRaw: parsed.fitment_raw || null,
            visibleTextLines: parsed.visible_text || null,
            packagingIdentifiers: parsed.packaging_identifiers || null,
            confidenceScores: parsed.confidence || {},
            rawOcrText: (parsed.visible_text || []).join('\n'),
        };
    }
    async applyCorrections(result) {
        const rules = await this.correctionRuleRepo.find({
            where: { active: true },
            order: { priority: 'DESC' },
        });
        const output = {};
        if (result.extractedBrand) {
            output.brand = this.applyRulesToField(result.extractedBrand, rules.filter((r) => r.correctionType === entities_1.CorrectionType.BRAND_ALIAS));
        }
        if (result.extractedProductType) {
            output.productType = this.applyRulesToField(result.extractedProductType, rules.filter((r) => r.correctionType === entities_1.CorrectionType.PRODUCT_TYPE_ALIAS));
        }
        if (result.extractedMpn) {
            let mpn = result.extractedMpn;
            for (const rule of rules.filter((r) => r.correctionType === entities_1.CorrectionType.HYPHEN_NORMALIZATION)) {
                mpn = mpn.replace(new RegExp(this.escapeRegex(rule.inputPattern), 'g'), rule.correctedValue);
            }
            output.mpn = mpn;
        }
        const copyFields = [
            'extractedOemNumber',
            'extractedProductFamily',
            'extractedPlacement',
            'extractedMaterial',
            'extractedFinish',
            'extractedCondition',
            'extractedQuantity',
            'extractedSideOrientation',
            'extractedFrontRear',
            'extractedDimensions',
            'extractedFeatures',
            'extractedFitmentRaw',
        ];
        for (const field of copyFields) {
            const key = field.replace('extracted', '');
            const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
            if (result[field]) {
                output[normalizedKey] = result[field];
            }
        }
        return output;
    }
    applyRulesToField(value, rules) {
        let result = value;
        for (const rule of rules) {
            if (rule.isRegex) {
                const regex = new RegExp(rule.inputPattern, 'gi');
                if (regex.test(result)) {
                    result = result.replace(regex, rule.correctedValue);
                }
            }
            else {
                if (result.toUpperCase() === rule.inputPattern.toUpperCase()) {
                    result = rule.correctedValue;
                }
            }
        }
        return result;
    }
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
exports.VisionExtractionService = VisionExtractionService;
exports.VisionExtractionService = VisionExtractionService = VisionExtractionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ExtractedAttribute)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.CorrectionRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService])
], VisionExtractionService);
//# sourceMappingURL=vision-extraction.service.js.map
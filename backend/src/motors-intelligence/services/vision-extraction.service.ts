import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ExtractedAttribute,
  ExtractionSource,
  MotorsProduct,
  CorrectionRule,
  CorrectionType,
} from '../entities';

export interface VisionExtractionResult {
  extractedBrand: string | null;
  extractedMpn: string | null;
  extractedOemNumber: string | null;
  extractedProductType: string | null;
  extractedProductFamily: string | null;
  extractedPlacement: string | null;
  extractedMaterial: string | null;
  extractedFinish: string | null;
  extractedCondition: string | null;
  extractedQuantity: string | null;
  extractedSideOrientation: string | null;
  extractedFrontRear: string | null;
  extractedDimensions: Record<string, any> | null;
  extractedFeatures: string[] | null;
  extractedFitmentRaw: any[] | null;
  visibleTextLines: string[] | null;
  packagingIdentifiers: string[] | null;
  confidenceScores: Record<string, number>;
  rawOcrText: string | null;
}

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

@Injectable()
export class VisionExtractionService {
  private readonly logger = new Logger(VisionExtractionService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(ExtractedAttribute)
    private readonly extractedAttrRepo: Repository<ExtractedAttribute>,
    @InjectRepository(CorrectionRule)
    private readonly correctionRuleRepo: Repository<CorrectionRule>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async extractFromImages(
    motorsProductId: string,
    imageUrls: string[],
  ): Promise<ExtractedAttribute> {
    const startTime = Date.now();
    const model = this.configService.get<string>('OPENAI_VISION_MODEL') || 'gpt-4o';

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const },
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
      const rawContent = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);
      const tokensUsed = response.usage?.total_tokens || 0;
      const costUsd = this.estimateCost(tokensUsed, imageUrls.length);

      const result = this.mapVisionResponse(parsed);

      // Apply correction rules
      const normalizedOutput = await this.applyCorrections(result);

      const extracted = this.extractedAttrRepo.create({
        motorsProductId,
        extractionSource: ExtractionSource.VISION_AI,
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
        aiProvider: 'openai',
        aiModel: model,
        tokensUsed,
        latencyMs,
        costUsd,
      });

      return this.extractedAttrRepo.save(extracted);
    } catch (error) {
      this.logger.error(`Vision extraction failed for ${motorsProductId}: ${error.message}`);
      throw error;
    }
  }

  async extractMpnFromText(
    motorsProductId: string,
    text: string,
  ): Promise<ExtractedAttribute> {
    const mpnPatterns = [
      // Common MPN patterns: alphanumeric with hyphens/dots
      /\b([A-Z]{1,5}[-.]?\d{3,10}[-.]?[A-Z0-9]{0,5})\b/gi,
      // OEM-style: longer numeric with optional prefix
      /\b(\d{5,12})\b/g,
      // Bracket-prefixed: many brands use specific formats
      /\b([A-Z]{2,4}\d{4,8}[A-Z]?)\b/gi,
    ];

    const extractedMpns: string[] = [];
    for (const pattern of mpnPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        extractedMpns.push(...matches);
      }
    }

    // Deduplicate
    const uniqueMpns = [...new Set(extractedMpns)];
    const primaryMpn = uniqueMpns.length > 0 ? uniqueMpns[0] : null;

    const extracted = this.extractedAttrRepo.create({
      motorsProductId,
      extractionSource: ExtractionSource.REGEX,
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

  async extractFromSupplierData(
    motorsProductId: string,
    supplierData: Record<string, any>,
  ): Promise<ExtractedAttribute> {
    const fieldMap: Record<string, string> = {
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

    const extracted: Partial<ExtractedAttribute> = {
      motorsProductId,
      extractionSource: ExtractionSource.SUPPLIER_DATA,
      rawModelOutput: supplierData,
    };

    const confidenceScores: Record<string, number> = {};

    for (const [sourceKey, targetField] of Object.entries(fieldMap)) {
      const value = supplierData[sourceKey] || supplierData[sourceKey.toUpperCase()];
      if (value) {
        (extracted as any)[targetField] = String(value).trim();
        const fieldName = targetField.replace('extracted', '').toLowerCase();
        confidenceScores[fieldName] = 0.85; // supplier data is reasonably trusted
      }
    }

    // Handle features
    if (supplierData.features) {
      extracted.extractedFeatures = Array.isArray(supplierData.features)
        ? supplierData.features
        : String(supplierData.features).split(',').map(f => f.trim());
    }

    // Handle fitment
    if (supplierData.fitment || supplierData.applications || supplierData.compatibility) {
      const fitmentData = supplierData.fitment || supplierData.applications || supplierData.compatibility;
      extracted.extractedFitmentRaw = Array.isArray(fitmentData) ? fitmentData : [fitmentData];
    }

    extracted.confidenceScores = confidenceScores;

    // Apply corrections
    const normalizedOutput = await this.applyCorrections(extracted as any);
    extracted.normalizedOutput = normalizedOutput;

    const entity = this.extractedAttrRepo.create(extracted);
    return this.extractedAttrRepo.save(entity);
  }

  async getExtractions(motorsProductId: string): Promise<ExtractedAttribute[]> {
    return this.extractedAttrRepo.find({
      where: { motorsProductId },
      order: { createdAt: 'DESC' },
    });
  }

  private mapVisionResponse(parsed: any): VisionExtractionResult {
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

  private async applyCorrections(
    result: Partial<VisionExtractionResult>,
  ): Promise<Record<string, any>> {
    const rules = await this.correctionRuleRepo.find({
      where: { active: true },
      order: { priority: 'DESC' },
    });

    const output: Record<string, any> = {};

    // Apply brand alias corrections
    if (result.extractedBrand) {
      output.brand = this.applyRulesToField(
        result.extractedBrand,
        rules.filter(r => r.correctionType === CorrectionType.BRAND_ALIAS),
      );
    }

    // Apply product type alias
    if (result.extractedProductType) {
      output.productType = this.applyRulesToField(
        result.extractedProductType,
        rules.filter(r => r.correctionType === CorrectionType.PRODUCT_TYPE_ALIAS),
      );
    }

    // Apply MPN corrections (char substitution, hyphen normalization)
    if (result.extractedMpn) {
      let mpn = result.extractedMpn;
      // Hyphen normalization
      for (const rule of rules.filter(r => r.correctionType === CorrectionType.HYPHEN_NORMALIZATION)) {
        mpn = mpn.replace(new RegExp(this.escapeRegex(rule.inputPattern), 'g'), rule.correctedValue);
      }
      output.mpn = mpn;
    }

    // Copy remaining fields
    const copyFields = [
      'extractedOemNumber', 'extractedProductFamily', 'extractedPlacement',
      'extractedMaterial', 'extractedFinish', 'extractedCondition',
      'extractedQuantity', 'extractedSideOrientation', 'extractedFrontRear',
      'extractedDimensions', 'extractedFeatures', 'extractedFitmentRaw',
    ];

    for (const field of copyFields) {
      const key = field.replace('extracted', '');
      const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
      if ((result as any)[field]) {
        output[normalizedKey] = (result as any)[field];
      }
    }

    return output;
  }

  private applyRulesToField(value: string, rules: CorrectionRule[]): string {
    let result = value;
    for (const rule of rules) {
      if (rule.isRegex) {
        const regex = new RegExp(rule.inputPattern, 'gi');
        if (regex.test(result)) {
          result = result.replace(regex, rule.correctedValue);
        }
      } else {
        if (result.toUpperCase() === rule.inputPattern.toUpperCase()) {
          result = rule.correctedValue;
        }
      }
    }
    return result;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private estimateCost(tokens: number, imageCount: number): number {
    // Approximate cost: $0.025 per image + $0.01 per 1K tokens
    return (imageCount * 0.025) + (tokens / 1000 * 0.01);
  }
}

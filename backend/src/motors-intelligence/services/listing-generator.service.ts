import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  MotorsProduct,
  ListingGeneration,
  ListingGenerationStatus,
  EbayCategoryMapping,
  EbayAspectRequirement,
  AspectRequirementLevel,
} from '../entities';

export interface ListingGenerationInput {
  brand: string;
  mpn: string;
  productType: string;
  placement?: string;
  material?: string;
  finish?: string;
  includes?: string[];
  features?: string[];
  condition: string;
  compatibleVehicleSummary?: string;
  categoryId: string;
  requiredAspects: Record<string, any>;
  recommendedAspects?: Record<string, any>;
  forbiddenClaims: string[];
  titleCharLimit: number;
  dimensions?: Record<string, any>;
  quantityPerPack?: string;
  sideOrientation?: string;
  frontRear?: string;
  oemPartNumber?: string;
}

export interface ListingGenerationOutput {
  title: string;
  itemSpecifics: Record<string, string>;
  bulletFeatures: string[];
  htmlDescription: string;
  keywordRationale: string;
  searchTags: string[];
  titleQualityScore: number;
  descriptionQualityScore: number;
}

// Product family templates for common Motors categories
const PRODUCT_TEMPLATES: Record<string, ProductTemplate> = {
  'Brake Pad': {
    titlePattern: '{brand} {position} {productType} {material} {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Type', 'Placement on Vehicle', 'Material', 'Pad Material'],
    bulletTemplate: [
      'Direct fit replacement for {fitment}',
      '{material} compound for optimal stopping power',
      'Includes {includes}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs', 'warranty'],
  },
  'Brake Caliper': {
    titlePattern: '{brand} {position} Brake Caliper {bracketInfo} {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Type', 'Placement on Vehicle', 'Bracket Included', 'Material'],
    bulletTemplate: [
      'Premium replacement brake caliper for {fitment}',
      '{material} construction for durability',
      '{bracketInfo}',
      'Position: {position}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs', 'installation'],
  },
  'Alternator': {
    titlePattern: '{brand} Alternator {amperage} {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Amperage', 'Voltage', 'Type'],
    bulletTemplate: [
      'Direct fit alternator for {fitment}',
      'Output: {amperage}',
      'Premium quality {condition} unit',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs', 'warranty'],
  },
  'Headlight': {
    titlePattern: '{brand} {position} Headlight Assembly {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Placement on Vehicle', 'Bulb Type', 'Lens Color'],
    bulletTemplate: [
      'OE-style replacement headlight assembly',
      'Position: {position}',
      '{bulbType} compatible',
      'DOT/SAE compliant',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'compliance', 'installation'],
  },
  'Mirror': {
    titlePattern: '{brand} {position} {mirrorType} Mirror {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Placement on Vehicle', 'Power/Manual', 'Heated'],
    bulletTemplate: [
      'Replacement side mirror for {fitment}',
      '{mirrorType} operation',
      'Position: {position}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs'],
  },
  'Control Arm': {
    titlePattern: '{brand} {position} Control Arm {bushingInfo} {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Placement on Vehicle', 'Ball Joint Included', 'Bushing Included'],
    bulletTemplate: [
      'Premium control arm assembly for {fitment}',
      'Position: {position}',
      '{material} construction',
      '{bushingInfo}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs', 'installation'],
  },
  'Wheel Hub': {
    titlePattern: '{brand} {position} Wheel Hub Bearing Assembly {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Placement on Vehicle', 'ABS Sensor Included', 'Number of Bolts'],
    bulletTemplate: [
      'Complete wheel hub and bearing assembly for {fitment}',
      'Position: {position}',
      '{absInfo}',
      'Pre-assembled for easy installation',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs', 'installation'],
  },
  'Radiator': {
    titlePattern: '{brand} Radiator {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Material', 'Core Style', 'Transmission Oil Cooler'],
    bulletTemplate: [
      'Replacement radiator for {fitment}',
      '{material} core construction',
      '{coolerInfo}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs'],
  },
  'Sensor': {
    titlePattern: '{brand} {sensorType} Sensor {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Sensor Type', 'Placement on Vehicle', 'Connector Type'],
    bulletTemplate: [
      'OE-spec {sensorType} sensor for {fitment}',
      'Direct plug-and-play installation',
      '{connectorInfo}',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs'],
  },
  'Ignition Coil': {
    titlePattern: '{brand} Ignition Coil {mpn} for {fitment}',
    keyAspects: ['Brand', 'Manufacturer Part Number', 'Type', 'Coil Style'],
    bulletTemplate: [
      'Premium ignition coil for {fitment}',
      'Direct OE replacement',
      'Delivers consistent spark energy',
      'Brand: {brand} | MPN: {mpn}',
    ],
    descriptionSections: ['overview', 'features', 'fitment', 'specs'],
  },
};

interface ProductTemplate {
  titlePattern: string;
  keyAspects: string[];
  bulletTemplate: string[];
  descriptionSections: string[];
}

const LISTING_GENERATION_PROMPT = `You are an expert eBay Motors listing copywriter. Generate listing content from the validated product data below.

Product Data:
{productData}

Required Aspects for this category:
{requiredAspects}

Rules:
1. Title MUST be under {titleCharLimit} characters
2. Title must include: buyer-intent keyword, brand, product type, key differentiator, MPN, validated fitment hook
3. NEVER invent hard facts - only use the provided data
4. NEVER invent fitment - use only what's provided
5. NEVER add unsupported marketing claims
6. No spam repetition, no ALL CAPS, no junk filler words
7. Use fitment in title ONLY if provided and validated
8. HTML description must be clean, simple, and eBay-safe (no JavaScript, no external CSS, no iframes)
9. Item specifics must satisfy the required aspects listed

Forbidden claims: {forbiddenClaims}

Respond in strict JSON format:
{
  "title": "optimized eBay title under {titleCharLimit} chars",
  "item_specifics": {
    "Brand": "...",
    "Manufacturer Part Number": "...",
    // all required + available recommended aspects
  },
  "bullet_features": ["feature 1", "feature 2", "feature 3", "feature 4"],
  "html_description": "<div>...</div>",
  "keyword_rationale": "Brief explanation of keyword choices in the title",
  "search_tags": ["tag1", "tag2", "tag3"],
  "quality_assessment": {
    "title_score": 0.0,
    "description_score": 0.0
  }
}`;

@Injectable()
export class ListingGeneratorService {
  private readonly logger = new Logger(ListingGeneratorService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(ListingGeneration)
    private readonly listingGenRepo: Repository<ListingGeneration>,
    @InjectRepository(EbayCategoryMapping)
    private readonly categoryMappingRepo: Repository<EbayCategoryMapping>,
    @InjectRepository(EbayAspectRequirement)
    private readonly aspectRequirementRepo: Repository<EbayAspectRequirement>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateListing(
    motorsProductId: string,
    input: ListingGenerationInput,
  ): Promise<ListingGeneration> {
    const startTime = Date.now();
    const model = this.configService.get<string>('OPENAI_LISTING_MODEL') || 'gpt-4o';

    // Get category aspects
    const aspects = await this.aspectRequirementRepo.find({
      where: { ebayCategoryId: input.categoryId },
    });

    const requiredAspects = aspects.filter(
      a => a.requirementLevel === AspectRequirementLevel.REQUIRED,
    );
    const recommendedAspects = aspects.filter(
      a => a.requirementLevel === AspectRequirementLevel.RECOMMENDED,
    );

    // Try template-based generation first
    const template = PRODUCT_TEMPLATES[input.productType];
    let generation: ListingGeneration;

    if (template && this.canUseTemplate(input, template)) {
      generation = await this.generateFromTemplate(
        motorsProductId,
        input,
        template,
        requiredAspects,
        recommendedAspects,
      );
    } else {
      generation = await this.generateWithAI(
        motorsProductId,
        input,
        requiredAspects,
        recommendedAspects,
        model,
        startTime,
      );
    }

    return this.listingGenRepo.save(generation);
  }

  private canUseTemplate(input: ListingGenerationInput, template: ProductTemplate): boolean {
    // Template can be used if we have all the key data points
    return !!(input.brand && input.mpn && input.productType);
  }

  private async generateFromTemplate(
    motorsProductId: string,
    input: ListingGenerationInput,
    template: ProductTemplate,
    requiredAspects: EbayAspectRequirement[],
    recommendedAspects: EbayAspectRequirement[],
  ): Promise<ListingGeneration> {
    // Build title from template
    const position = this.buildPositionString(input);
    const fitmentHook = input.compatibleVehicleSummary || '';
    const bracketInfo = input.includes?.includes('Bracket') ? 'w/ Bracket' : '';

    let title = template.titlePattern
      .replace('{brand}', input.brand || '')
      .replace('{position}', position)
      .replace('{productType}', input.productType)
      .replace('{material}', input.material || '')
      .replace('{mpn}', input.mpn || '')
      .replace('{fitment}', fitmentHook)
      .replace('{bracketInfo}', bracketInfo)
      .replace('{amperage}', input.dimensions?.amperage || '')
      .replace('{sensorType}', '')
      .replace('{mirrorType}', '')
      .replace('{bulbType}', '')
      .replace('{bushingInfo}', '')
      .replace('{absInfo}', '')
      .replace('{coolerInfo}', '')
      .replace('{connectorInfo}', '')
      .replace(/\s+/g, ' ')
      .trim();

    // Enforce title character limit
    if (title.length > input.titleCharLimit) {
      title = this.truncateTitle(title, input.titleCharLimit);
    }

    // Build item specifics
    const itemSpecifics: Record<string, string> = {};
    if (input.brand) itemSpecifics['Brand'] = input.brand;
    if (input.mpn) itemSpecifics['Manufacturer Part Number'] = input.mpn;
    if (input.productType) itemSpecifics['Type'] = input.productType;
    if (position) itemSpecifics['Placement on Vehicle'] = position;
    if (input.material) itemSpecifics['Material'] = input.material;
    if (input.finish) itemSpecifics['Finish'] = input.finish;
    if (input.condition) itemSpecifics['Condition'] = input.condition;
    if (input.oemPartNumber) itemSpecifics['OE/OEM Part Number'] = input.oemPartNumber;
    if (input.quantityPerPack) itemSpecifics['Quantity'] = input.quantityPerPack;
    if (bracketInfo) itemSpecifics['Bracket Included'] = 'Yes';

    // Build bullets
    const bullets = this.buildBullets(input, template);

    // Build HTML description
    const htmlDescription = this.buildHtmlDescription(input, bullets, title);

    return this.listingGenRepo.create({
      motorsProductId,
      version: 1,
      status: ListingGenerationStatus.GENERATED,
      inputContract: input as any,
      generatedTitle: title,
      generatedItemSpecifics: itemSpecifics,
      generatedBulletFeatures: bullets,
      generatedHtmlDescription: htmlDescription,
      keywordRationale: `Template-based title: prioritized brand (${input.brand}), product type (${input.productType}), position (${position}), MPN (${input.mpn}), and fitment hook.`,
      searchTags: [
        input.brand,
        input.productType,
        input.mpn,
        position,
        input.oemPartNumber,
      ].filter(Boolean) as string[],
      titleQualityScore: 0.85,
      descriptionQualityScore: 0.85,
      overallQualityScore: 0.85,
    });
  }

  private async generateWithAI(
    motorsProductId: string,
    input: ListingGenerationInput,
    requiredAspects: EbayAspectRequirement[],
    recommendedAspects: EbayAspectRequirement[],
    model: string,
    startTime: number,
  ): Promise<ListingGeneration> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = LISTING_GENERATION_PROMPT
      .replace('{productData}', JSON.stringify(input, null, 2))
      .replace('{requiredAspects}', JSON.stringify(
        requiredAspects.map(a => ({
          name: a.aspectName,
          required: true,
          allowedValues: a.allowedValues,
          maxLength: a.maxLength,
        })),
        null,
        2,
      ))
      .replace(/\{titleCharLimit\}/g, String(input.titleCharLimit))
      .replace('{forbiddenClaims}', JSON.stringify(input.forbiddenClaims));

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional eBay Motors listing copywriter. Always respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);
      const tokensUsed = response.usage?.total_tokens || 0;

      // Validate title length
      let title = parsed.title || '';
      if (title.length > input.titleCharLimit) {
        title = this.truncateTitle(title, input.titleCharLimit);
      }

      return this.listingGenRepo.create({
        motorsProductId,
        version: 1,
        status: ListingGenerationStatus.GENERATED,
        inputContract: input as any,
        generatedTitle: title,
        generatedItemSpecifics: parsed.item_specifics || {},
        generatedBulletFeatures: parsed.bullet_features || [],
        generatedHtmlDescription: parsed.html_description || '',
        keywordRationale: parsed.keyword_rationale || '',
        searchTags: parsed.search_tags || [],
        aiProvider: 'openai',
        aiModel: model,
        aiRawResponse: parsed,
        tokensUsed,
        latencyMs,
        costUsd: (tokensUsed / 1000) * 0.01,
        titleQualityScore: parsed.quality_assessment?.title_score || null,
        descriptionQualityScore: parsed.quality_assessment?.description_score || null,
        overallQualityScore:
          parsed.quality_assessment
            ? (parsed.quality_assessment.title_score + parsed.quality_assessment.description_score) / 2
            : null,
      });
    } catch (error) {
      this.logger.error(`AI listing generation failed: ${error.message}`);
      throw error;
    }
  }

  private buildPositionString(input: ListingGenerationInput): string {
    const parts: string[] = [];
    if (input.frontRear) parts.push(input.frontRear);
    if (input.sideOrientation) parts.push(input.sideOrientation);
    if (input.placement && parts.length === 0) {
      return input.placement;
    }
    return parts.join(' ');
  }

  private buildBullets(input: ListingGenerationInput, template: ProductTemplate): string[] {
    const fitment = input.compatibleVehicleSummary || 'See compatibility';
    return template.bulletTemplate.map(bullet =>
      bullet
        .replace('{brand}', input.brand || '')
        .replace('{mpn}', input.mpn || '')
        .replace('{fitment}', fitment)
        .replace('{material}', input.material || 'premium')
        .replace('{position}', this.buildPositionString(input) || 'N/A')
        .replace('{includes}', (input.includes || []).join(', ') || 'mounting hardware')
        .replace('{bracketInfo}', input.includes?.includes('Bracket') ? 'Includes mounting bracket' : '')
        .replace('{condition}', input.condition || 'New')
        .replace('{amperage}', input.dimensions?.amperage || '')
        .replace('{sensorType}', '')
        .replace('{mirrorType}', '')
        .replace('{bulbType}', '')
        .replace('{bushingInfo}', '')
        .replace('{absInfo}', '')
        .replace('{coolerInfo}', '')
        .replace('{connectorInfo}', '')
        .trim(),
    ).filter(b => b.length > 0 && !b.includes('{'));
  }

  private buildHtmlDescription(input: ListingGenerationInput, bullets: string[], title: string): string {
    const position = this.buildPositionString(input);
    const fitment = input.compatibleVehicleSummary || '';

    return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
  <h1 style="font-size: 22px; color: #0654ba; border-bottom: 2px solid #0654ba; padding-bottom: 10px;">${this.escapeHtml(title)}</h1>
  
  <div style="margin: 20px 0;">
    <h2 style="font-size: 18px; color: #333;">Product Details</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f5f5f5;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Brand</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(input.brand || '')}</td></tr>
      <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Part Number</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(input.mpn || '')}</td></tr>
      <tr style="background: #f5f5f5;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Type</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(input.productType || '')}</td></tr>
      ${position ? `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Position</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(position)}</td></tr>` : ''}
      ${input.material ? `<tr style="background: #f5f5f5;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Material</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(input.material)}</td></tr>` : ''}
      <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Condition</td><td style="padding: 8px; border: 1px solid #ddd;">${this.escapeHtml(input.condition || 'New')}</td></tr>
    </table>
  </div>

  <div style="margin: 20px 0;">
    <h2 style="font-size: 18px; color: #333;">Key Features</h2>
    <ul style="padding-left: 20px;">
      ${bullets.map(b => `<li style="margin-bottom: 6px;">${this.escapeHtml(b)}</li>`).join('\n      ')}
    </ul>
  </div>

  ${fitment ? `<div style="margin: 20px 0; background: #f0f7ff; padding: 15px; border-radius: 4px;">
    <h2 style="font-size: 18px; color: #0654ba;">Vehicle Compatibility</h2>
    <p>${this.escapeHtml(fitment)}</p>
    <p style="font-size: 12px; color: #666;"><em>Please verify compatibility with your specific vehicle before purchasing. Check the compatibility table above for detailed fitment information.</em></p>
  </div>` : ''}

  ${input.includes && input.includes.length > 0 ? `<div style="margin: 20px 0;">
    <h2 style="font-size: 18px; color: #333;">What's Included</h2>
    <ul style="padding-left: 20px;">
      ${input.includes.map(i => `<li>${this.escapeHtml(i)}</li>`).join('\n      ')}
    </ul>
  </div>` : ''}

  <div style="margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 4px; font-size: 13px;">
    <strong>Important:</strong> Please verify fitment with your vehicle's year, make, model, and engine before purchasing. 
    If you have any questions about compatibility, please contact us before buying.
  </div>
</div>`;
  }

  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title;
    // Try to cut at word boundary
    const truncated = title.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace);
    }
    return truncated;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async getGenerations(motorsProductId: string): Promise<ListingGeneration[]> {
    return this.listingGenRepo.find({
      where: { motorsProductId },
      order: { version: 'DESC' },
    });
  }
}

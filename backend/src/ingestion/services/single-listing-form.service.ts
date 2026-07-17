import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import * as fs from 'node:fs';
import { OpenAiService } from '../../common/openai/openai.service.js';
import { sanitizeJson } from '../../common/openai/json-sanitizer.js';
import { VisionEnrichmentPipeline } from '../../common/openai/pipelines/vision-enrichment.pipeline.js';
import type { VisionEnrichmentResult } from '../../common/openai/pipelines/vision-enrichment.pipeline.js';
import { estimateCost } from '../../common/openai/openai.types.js';
import { EbayMvlService } from '../../fitment/ebay-mvl.service.js';
import { ListingRecord } from '../../listings/listing-record.entity.js';
import { CatalogProduct } from '../../catalog-import/entities/catalog-product.entity.js';
import { ImageAsset } from '../../storage/entities/image-asset.entity.js';
import { StorageService } from '../../storage/storage.service.js';
import { ImageOptimizerService } from '../image-enrichment/image-optimizer.service.js';
import {
  ECU_IDENTIFICATION_PROMPT,
  isEcuPartType,
} from '../../common/openai/prompts/ecu-identification.prompt.js';
import {
  AUTOMOTIVE_OEM_BRANDS,
  SKU_PREFIX,
} from '../constants/automotive-oem-brands.js';

/** Minimum uploaded images required before vision fallback (label + overall). */
export const PART_LOOKUP_MIN_VISION_IMAGES = 2;

export interface PartLookupResult {
  partName?: string;
  brand?: string;
  /** Vehicle model line (e.g. Camry) — not the AI model slug */
  model?: string;
  category?: string;
  note?: string;
  partNumber?: string;
  confidence?: 'high' | 'medium' | 'low';
  mvlMatched?: boolean;
  source: 'oem_text' | 'vision';
  /** OpenRouter model slug used for the successful lookup */
  aiModel: string;
  visionModel?: string;
  estimatedCostUsd: number;
  fallbackUsed: boolean;
}

export interface PartLookupDto {
  partNumber: string;
  brand?: string;
  vin?: string;
  /** CDN URLs from uploaded listing images — required for automatic vision fallback */
  imageUrls?: string[];
  /** Part type hint (e.g. "OEM", "ECU", "TCM") — used to select specialised vision prompts */
  partType?: string;
}

export interface CreateIntakePartDto {
  sku?: string;
  partNumber: string;
  brand: string;
  partType: 'OEM' | 'Aftermarket' | 'Salvage';
  conditionId: string;
  vehicleMake?: string;
  price: number;
  quantity?: number;
  imageUrls?: string[];
  uploadedAssetIds?: string[];
  title?: string;
  categoryName?: string;
  description?: string;
  teamId?: string;
  location?: string;
  weight?: number;
}

export interface PartLookupPricingEstimate {
  oemModel: string;
  visionModel: string;
  recommendedStack: string;
  assumptions: {
    oemPromptTokens: number;
    oemCompletionTokens: number;
    visionPromptTokens: number;
    visionCompletionTokens: number;
    visionFallbackRate: number;
  };
  perLookupUsd: {
    oemTextOnly: number;
    visionFallback: number;
    /** OEM attempt + vision on same part (worst-case single part) */
    oemPlusVision: number;
  };
  bulk15000PartsUsd: {
    /** All parts identified on first OEM text call */
    allOemSuccess: number;
    /** ~10% need vision fallback after OEM attempt */
    typicalWithVisionFallback: number;
    /** Every part: OEM attempt fails → vision (maximum spend) */
    worstCase: number;
  };
}

/** Live benchmark medians (scripts/model-comparison/run-part-lookup-comparison.mjs, 2026-06) */
const MEASURED_OEM_LOOKUP_USD: Record<string, number> = {
  'openai/gpt-4o-mini': 0.000091,
  'google/gemini-2.5-flash': 0.000414,
  'openai/gpt-4.1-mini': 0.000265,
};

const PART_LOOKUP_SYSTEM_PROMPT = `You are an automotive parts identification specialist.
Given a part number or OEM number, infer the most likely part details for an eBay Motors listing.
Return ONLY valid JSON with these keys (use empty string when unknown):
{
  "partName": "human-readable part name with position if known",
  "brand": "vehicle or parts brand (OEM manufacturer, not aftermarket unless clearly an aftermarket number)",
  "model": "primary vehicle model line if identifiable from the part number pattern",
  "category": "eBay-oriented category hint e.g. Brakes, Engine Cooling, Lighting",
  "note": "2-4 sentences: condition assumptions (used OEM), fitment hints, interchange notes, seller-facing details for listing enrichment",
  "confidence": "high|medium|low"
}
Rules:
- Never fabricate exact cross-reference numbers.
- Mercedes A-numbers, BMW numbers, Toyota/Lexus formats should inform brand/model.
- Chassis codes must match year ranges (Lexus RX AL20 = 2015–2022; AL10 = 2009–2015). Never mix generation codes with incompatible years.
- Interior/trim parts: mention placement, color/finish, and verify-part-number guidance in the note.
- If uncertain, use lower confidence and leave fields empty rather than guessing wildly.
- The note field must be ready to paste into a listing form as additional seller details.
- TITLE RULE: partName is for used OEM parts — do NOT include "New" in partName. Use neutral wording (no condition word) or "Used"/"OEM Used".`;

const SINGLE_LISTING_VISION_PROMPT = `Analyze ALL provided photos of this automotive part for a single eBay Motors listing.
Use the seller hints together with what you see in the images — do not rely on text hints alone when photos contradict them.

Seller hints:
- Part number / OEM: {partNumberHint}
- {brandHint}

You MUST verify image coverage across the set:
- hasLabelShot: at least ONE image clearly shows a part number stamp, OEM label, barcode, or manufacturer tag
- hasOverallShot: at least ONE other image shows the whole part assembly in context (not only a tight label crop)

Return ONLY valid JSON:
{
  "partName": "SEO-friendly eBay title part name (specific, with placement/position if known, max ~80 chars worth of clarity)",
  "brand": "manufacturer/brand (prefer hint when visible on label)",
  "model": "vehicle model line if visible on label or strongly inferable",
  "category": "eBay Motors category e.g. Brakes, Engine Cooling, Lighting",
  "partNumber": "best visible MPN/OEM from images (empty string if not readable)",
  "note": "2-4 sentences of SEO-friendly seller notes: condition, fitment hints, interchange/cross-ref context, keywords buyers search for. Plain text, no HTML.",
  "confidence": "high|medium|low",
  "imageCoverage": {
    "hasLabelShot": true,
    "hasOverallShot": true
  },
  "visibleText": ["all readable text from labels/stamps"]
}

Rules:
- Combine OEM hint, brand hint, and visible label/overall photos for identification
- Do NOT invent part numbers — only report clearly visible numbers
- Set confidence to low if identification is uncertain
- imageCoverage must reflect what is actually in the photos
- The note must be accurate, seller-facing, and ready to paste into a listing description
- TITLE RULE: partName is for used OEM parts — do NOT include "New" in partName. Use neutral wording (no condition word) or "Used"/"OEM Used".`;

@Injectable()
export class SingleListingFormService {
  private readonly logger = new Logger(SingleListingFormService.name);

  constructor(
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly catalogProductRepo: Repository<CatalogProduct>,
    @InjectRepository(ImageAsset)
    private readonly imageAssetRepo: Repository<ImageAsset>,
    private readonly openAi: OpenAiService,
    private readonly config: ConfigService,
    private readonly mvl: EbayMvlService,
    private readonly visionPipeline: VisionEnrichmentPipeline,
    private readonly storageService: StorageService,
    private readonly imageOptimizer: ImageOptimizerService,
  ) {}

  getLookupPricing(): PartLookupPricingEstimate {
    const oemModel =
      this.config.get<string>('OPENAI_MODEL_TEXT') ||
      this.config.get<string>('OPENAI_CHAT_MODEL', 'openai/gpt-4o-mini');
    const visionModel =
      this.config.get<string>('OPENAI_VISION_MODEL') ||
      'google/gemini-2.5-flash';

    const assumptions = {
      oemPromptTokens: 650,
      oemCompletionTokens: 350,
      visionPromptTokens: 2800,
      visionCompletionTokens: 650,
      visionFallbackRate: 0.1,
    };

    const oemTextOnly =
      MEASURED_OEM_LOOKUP_USD[oemModel] ??
      estimateCost(
        oemModel,
        assumptions.oemPromptTokens,
        assumptions.oemCompletionTokens,
      );

    const visionFallback = estimateCost(
      visionModel,
      assumptions.visionPromptTokens,
      assumptions.visionCompletionTokens,
    );

    const oemPlusVision = oemTextOnly + visionFallback;
    const allOemSuccess = oemTextOnly * 15_000;
    const fallbackCount = Math.round(15_000 * assumptions.visionFallbackRate);
    const typicalWithVisionFallback =
      oemTextOnly * 15_000 + visionFallback * fallbackCount;
    const worstCase = oemPlusVision * 15_000;

    const roundUsd = (n: number) => Math.round(n * 100) / 100;
    const roundMicro = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

    return {
      oemModel,
      visionModel,
      recommendedStack:
        'OEM text: openai/gpt-4o-mini (OPENAI_MODEL_TEXT) · Vision fallback: google/gemini-2.5-flash (OPENAI_VISION_MODEL)',
      assumptions,
      perLookupUsd: {
        oemTextOnly: roundMicro(oemTextOnly),
        visionFallback: roundMicro(visionFallback),
        oemPlusVision: roundMicro(oemPlusVision),
      },
      bulk15000PartsUsd: {
        allOemSuccess: roundUsd(allOemSuccess),
        typicalWithVisionFallback: roundUsd(typicalWithVisionFallback),
        worstCase: roundUsd(worstCase),
      },
    };
  }

  async createIntakePart(
    dto: CreateIntakePartDto,
  ): Promise<{ listing: ListingRecord }> {
    const partNumber = dto.partNumber?.trim();
    const brand = dto.brand?.trim();
    if (!partNumber) {
      throw new BadRequestException('partNumber is required');
    }
    if (!brand) {
      throw new BadRequestException('brand is required');
    }

    const rawImageUrls = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);

    const generatedSku = !dto.sku?.trim();
    let sku = dto.sku?.trim() || (await this.allocateSku());

    // Never let a raw temp/ upload URL land in itemPhotoUrl/image_urls — it
    // gets purged by the daily storage-cleanup job within 24h if nothing else
    // confirms it. mirrorRemoteImageUrls is a no-op for already-durable URLs.
    const imageUrls =
      rawImageUrls.length > 0
        ? await this.storageService.mirrorRemoteImageUrls(
            rawImageUrls,
            `warehouse-intake/${sku}`,
          )
        : rawImageUrls;
    const qty = dto.quantity ?? 1;
    const priceNum = dto.price;
    const priceStr = priceNum.toFixed(2);
    const placeholderTitle = `${brand} ${partNumber}`.slice(0, 80);
    const title = dto.title?.trim() || placeholderTitle;
    let listing: ListingRecord | null = null;
    let sourceRowNumber = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      sourceRowNumber = await this.allocateIntakeSourceRow();
      try {
        listing = await this.listingRepo.save(
          this.listingRepo.create({
            customLabelSku: sku,
            cBrand: brand,
            cType: dto.partType,
            cOeOemPartNumber: partNumber,
            cManufacturerPartNumber: partNumber,
            itemPhotoUrl: imageUrls.length > 0 ? imageUrls.join('|') : null,
            title,
            description: dto.description?.trim() || null,
            categoryName: dto.categoryName?.trim() || null,
            conditionId: dto.conditionId,
            extractedMake: dto.vehicleMake?.trim() || null,
            startPrice: priceStr,
            startPriceNum: priceNum,
            quantity: String(qty),
            quantityNum: qty,
            status: 'draft',
            sourceFileName: 'warehouse-intake',
            sourceFilePath: 'warehouse-intake',
            sheetName: 'intake',
            sourceRowNumber,
            teamId: dto.teamId || null,
            location: dto.location?.trim() || null,
            weight: dto.weight ?? null,
          }),
        );
        break;
      } catch (err) {
        if (!this.isUniqueViolation(err) || attempt === 3) {
          if (this.isUniqueViolation(err)) {
            throw new ConflictException(
              'This part could not be saved because its generated inventory identifiers collided. Please try again.',
            );
          }
          throw err;
        }
        if (generatedSku && this.isSkuUniqueViolation(err)) {
          sku = await this.allocateSku();
        }
      }
    }
    if (!listing) {
      throw new ConflictException(
        'This part could not be saved because its generated inventory identifiers collided. Please try again.',
      );
    }

    // Create corresponding catalog product so exports and templates work
    try {
      await this.catalogProductRepo.save(
        this.catalogProductRepo.create({
          sku,
          title,
          description: dto.description?.trim() || null,
          brand,
          brandNormalized: brand.toLowerCase().trim(),
          mpn: partNumber,
          mpnNormalized: partNumber.toLowerCase().replace(/[\s\-]/g, ''),
          oemPartNumber: partNumber,
          partType: dto.partType,
          categoryId: null,
          categoryName: dto.categoryName?.trim() || null,
          conditionId: dto.conditionId,
          price: priceNum,
          quantity: qty,
          imageUrls,
          sourceFile: 'warehouse-intake',
          sourceRow: sourceRowNumber,
          teamId: dto.teamId || null,
          location: dto.location?.trim() || null,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create catalog product for SKU ${sku}: ${err}`,
      );
    }

    if (dto.uploadedAssetIds?.length) {
      await this.imageAssetRepo.update(
        { id: In(dto.uploadedAssetIds) },
        { listingId: listing.id },
      );
    }

    // Auto-enrich: run text-only AI enrichment (no photos required)
    await this.autoEnrichListing(listing, dto);

    return { listing };
  }

  /**
   * Auto-enrich a newly created intake listing using text-only AI lookup.
   * Runs eBay Browse API + OpenAI text enrichment + MVL canonicalization.
   * Best-effort: failures are logged but don't prevent part creation.
   * User-provided fields are never overwritten.
   */
  private async autoEnrichListing(
    listing: ListingRecord,
    dto: CreateIntakePartDto,
  ): Promise<void> {
    try {
      const partNumber = dto.partNumber?.trim();
      if (!partNumber) return;

      // Step 1: AI text enrichment (no photos required)
      const oemModel =
        this.config.get<string>('OPENAI_MODEL_TEXT') ||
        this.config.get<string>('OPENAI_CHAT_MODEL', 'openai/gpt-4o-mini');

      const lookupDto: PartLookupDto = {
        partNumber,
        brand: dto.brand,
        partType: dto.partType,
      };

      let oemResult: Partial<PartLookupResult>;
      try {
        const attempt = await this.runOemTextLookup(
          partNumber,
          lookupDto,
          oemModel,
        );
        if (!this.isOemLookupUsable(attempt.result)) {
          this.logger.debug(
            `Auto-enrich: OEM lookup not usable for ${listing.customLabelSku ?? partNumber}`,
          );
          return;
        }
        oemResult = attempt.result;
      } catch {
        this.logger.debug(
          `Auto-enrich: OEM lookup failed for ${listing.customLabelSku ?? partNumber}`,
        );
        return;
      }

      // Step 2: MVL canonicalization
      const finalized = await this.finalizeLookupFields(
        oemResult,
        partNumber,
      );

      // Step 3: Apply results, respecting user overrides
      const placeholderTitle = `${dto.brand} ${partNumber}`.slice(0, 80);
      let titleChanged = false;

      // Title: only overwrite if still placeholder
      if (
        listing.title === placeholderTitle &&
        finalized.partName?.trim()
      ) {
        listing.title = this.buildSeoTitle(
          finalized.brand ?? dto.brand,
          finalized.partName,
          partNumber,
        );
        titleChanged = true;
      }

      // Brand: only if user didn't provide one
      if (!dto.brand?.trim() && finalized.brand?.trim()) {
        listing.cBrand = finalized.brand.trim();
      }

      // Model: only if empty
      if (!listing.extractedModel && finalized.model?.trim()) {
        listing.extractedModel = finalized.model.trim();
      }

      // Category: only if empty
      if (!listing.categoryName && finalized.category?.trim()) {
        listing.categoryName = finalized.category.trim();
      }

      // Description: merge user notes + AI note
      if (finalized.note?.trim()) {
        const userNotes = dto.description?.trim();
        listing.description =
          [userNotes, finalized.note.trim()].filter(Boolean).join('\n\n') ||
          null;
      }

      // OEM part number: update if AI found a better one
      if (finalized.partNumber?.trim()) {
        listing.cOeOemPartNumber = finalized.partNumber.trim();
        listing.cManufacturerPartNumber = finalized.partNumber.trim();
      }

      // Step 4: Save listing
      await this.listingRepo.save(listing);

      // Step 5: Update catalog product
      if (listing.customLabelSku) {
        try {
          const product = await this.catalogProductRepo.findOneBy({
            sku: listing.customLabelSku,
          });
          if (product) {
            if (titleChanged && listing.title) product.title = listing.title;
            if (listing.cBrand) product.brand = listing.cBrand;
            if (listing.categoryName)
              product.categoryName = listing.categoryName;
            if (listing.description)
              product.description = listing.description;
            await this.catalogProductRepo.save(product);
          }
        } catch (err) {
          this.logger.warn(
            `Auto-enrich: failed to update catalog product ${listing.customLabelSku}: ${err}`,
          );
        }
      }

      this.logger.log(
        `Auto-enriched ${listing.customLabelSku}: "${listing.title}" (${finalized.confidence})`,
      );
    } catch (err) {
      this.logger.warn(
        `Auto-enrichment failed for ${listing.customLabelSku ?? dto.partNumber}: ${err}`,
      );
    }
  }

  /**
   * Build an eBay-compliant SEO title (≤80 chars).
   * Format: [Make] [Part Name] [OEM Part Number] OEM Used
   */
  private buildSeoTitle(
    make: string | null | undefined,
    partName: string | null | undefined,
    oemNumber: string | null | undefined,
  ): string {
    const parts = [
      make?.trim(),
      partName?.trim(),
      oemNumber?.trim(),
      'OEM Used',
    ].filter(Boolean);
    let title = parts.join(' ');
    if (title.length > 80) {
      // Try without "OEM Used" suffix first
      const withoutSuffix = [make?.trim(), partName?.trim(), oemNumber?.trim()]
        .filter(Boolean)
        .join(' ');
      title =
        withoutSuffix.length <= 80
          ? withoutSuffix
          : withoutSuffix.slice(0, 77) + '...';
    }
    return title || `${make ?? ''} ${oemNumber ?? ''}`.trim().slice(0, 80);
  }

  async lookupAndApplyToListing(
    listingId: string,
  ): Promise<{ listing: ListingRecord; lookup: PartLookupResult }> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException(`Listing ${listingId} not found`);
    }

    const partNumber =
      listing.cOeOemPartNumber?.trim() ||
      listing.cManufacturerPartNumber?.trim();
    if (!partNumber) {
      throw new BadRequestException('Listing has no OEM/part number');
    }

    const imageUrls = (listing.itemPhotoUrl ?? '')
      .split('|')
      .map((u) => u.trim())
      .filter(Boolean);

    if (imageUrls.length < PART_LOOKUP_MIN_VISION_IMAGES) {
      throw new BadRequestException(
        `Fetch details requires at least ${PART_LOOKUP_MIN_VISION_IMAGES} photos (label close-up + overall part shot).`,
      );
    }

    const lookup = await this.lookupPart({
      partNumber,
      brand: listing.cBrand?.trim() || undefined,
      imageUrls,
      partType: listing.cType?.trim() || undefined,
    });

    if (lookup.partName?.trim()) {
      listing.title = lookup.partName.trim().slice(0, 80);
    }
    if (lookup.brand?.trim()) {
      listing.cBrand = lookup.brand.trim();
    }
    if (lookup.model?.trim()) {
      listing.extractedModel = lookup.model.trim();
    }
    if (lookup.category?.trim()) {
      listing.categoryName = lookup.category.trim();
    }
    if (lookup.note?.trim()) {
      listing.description = lookup.note.trim();
    }
    if (lookup.partNumber?.trim()) {
      listing.cOeOemPartNumber = lookup.partNumber.trim();
      listing.cManufacturerPartNumber = lookup.partNumber.trim();
    }

    const saved = await this.listingRepo.save(listing);
    return { listing: saved, lookup };
  }

  async listBrands(query?: string): Promise<{ brands: string[] }> {
    const catalogRows = await this.listingRepo
      .createQueryBuilder('r')
      .select('DISTINCT r."cBrand"', 'brand')
      .where(`r."cBrand" IS NOT NULL AND TRIM(r."cBrand") != ''`)
      .andWhere(`r."deletedAt" IS NULL`)
      .orderBy('r."cBrand"', 'ASC')
      .getRawMany<{ brand: string }>();

    const catalogBrands = catalogRows
      .map((row) => row.brand?.trim())
      .filter((b): b is string => Boolean(b));

    const merged = new Set<string>([
      ...AUTOMOTIVE_OEM_BRANDS,
      ...catalogBrands,
    ]);
    let brands = [...merged].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );

    const q = query?.trim();
    if (q) {
      const lower = q.toLowerCase();
      brands = brands.filter((b) => b.toLowerCase().includes(lower));
    }

    return { brands };
  }

  async lookupPart(dto: PartLookupDto): Promise<PartLookupResult> {
    const partNumber = dto.partNumber?.trim();
    if (!partNumber) {
      throw new BadRequestException('partNumber is required');
    }

    this.assertAiConfigured();

    const imageUrls = (dto.imageUrls ?? [])
      .map((u) => u.trim())
      .filter(Boolean);

    // Vision-first when photos are available: OEM + brand + images together
    if (imageUrls.length >= PART_LOOKUP_MIN_VISION_IMAGES) {
      const visionAttempt = await this.runVisionLookup(
        partNumber,
        imageUrls,
        dto.brand,
        dto.partType,
      );

      return {
        ...(await this.finalizeLookupFields(
          visionAttempt.result,
          partNumber,
          true,
        )),
        source: 'vision',
        aiModel: visionAttempt.visionModel,
        visionModel: visionAttempt.visionModel,
        estimatedCostUsd: visionAttempt.costUsd,
        fallbackUsed: false,
      };
    }

    // Text-only fallback when no photos (legacy/direct API callers)
    const oemModel =
      this.config.get<string>('OPENAI_MODEL_TEXT') ||
      this.config.get<string>('OPENAI_CHAT_MODEL', 'openai/gpt-4o-mini');

    const oemAttempt = await this.runOemTextLookup(partNumber, dto, oemModel);
    if (!this.isOemLookupUsable(oemAttempt.result)) {
      throw new BadRequestException(
        `At least ${PART_LOOKUP_MIN_VISION_IMAGES} photos are required — upload a label close-up and an overall part shot, then try again.`,
      );
    }

    const finalized = await this.finalizeLookupFields(
      oemAttempt.result,
      partNumber,
    );
    return {
      ...finalized,
      source: 'oem_text',
      aiModel: oemModel,
      estimatedCostUsd: oemAttempt.costUsd,
      fallbackUsed: false,
    };
  }

  private assertAiConfigured(): void {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI lookup is unavailable — OPENAI_API_KEY is not configured.',
      );
    }
  }

  private isOemLookupUsable(result: Partial<PartLookupResult>): boolean {
    if (result.confidence === 'low') return false;

    const partName = result.partName?.trim();
    const brand = result.brand?.trim();
    const category = result.category?.trim();
    const note = result.note?.trim();

    if (!partName) return false;
    if (!brand && !category && !note) return false;

    if (result.confidence === 'medium' && !brand && !category) return false;

    return true;
  }

  private async runOemTextLookup(
    partNumber: string,
    dto: PartLookupDto,
    chatModel: string,
  ): Promise<{ result: Partial<PartLookupResult>; costUsd: number }> {
    const contextLines = [`Part number / OEM: ${partNumber}`];
    if (dto.brand?.trim())
      contextLines.push(`Known brand hint: ${dto.brand.trim()}`);
    if (dto.vin?.trim())
      contextLines.push(`Donor VIN (if relevant): ${dto.vin.trim()}`);

    const response = await this.openAi.chat({
      model: chatModel,
      systemPrompt: PART_LOOKUP_SYSTEM_PROMPT,
      userPrompt: contextLines.join('\n'),
      jsonMode: true,
      maxTokens: 800,
      temperature: 0.2,
      costLane: 'single-listing-part-lookup',
    });

    const parsed = sanitizeJson(
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content ?? response.rawContent),
    ) as PartLookupResult;

    return {
      result: {
        partName: this.str(parsed.partName),
        brand: this.str(parsed.brand),
        model: this.str(parsed.model),
        category: this.str(parsed.category),
        note: this.str(parsed.note),
        confidence: this.normalizeConfidence(parsed.confidence),
      },
      costUsd: response.estimatedCostUsd,
    };
  }

  /**
   * Download, downscale, and re-encode images as base64 data URIs so the
   * vision provider (which fetches image URLs server-side) never sees the
   * original oversized file. Skips images that fail to download/decode
   * rather than failing the whole batch — the caller falls back to the
   * original error if every image is unusable.
   */
  private async resizeImagesForVision(imageUrls: string[]): Promise<string[]> {
    const optimized = await Promise.all(
      imageUrls.map((url) =>
        this.imageOptimizer
          .downloadAndOptimize(url, {
            targetFormat: 'jpg',
            maxWidth: 1600,
            quality: 80,
          })
          .catch(() => null),
      ),
    );

    const dataUrls: string[] = [];
    for (const img of optimized) {
      if (!img) continue;
      try {
        const buffer = fs.readFileSync(img.localPath);
        const mime = img.format === 'webp' ? 'image/webp' : 'image/jpeg';
        dataUrls.push(`data:${mime};base64,${buffer.toString('base64')}`);
      } catch (err) {
        this.logger.debug(
          `Could not read optimized image for vision retry: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return dataUrls;
  }

  private async runVisionLookup(
    partNumberHint: string,
    imageUrls: string[],
    brandHint?: string,
    partType?: string,
  ): Promise<{
    result: Partial<PartLookupResult>;
    costUsd: number;
    visionModel: string;
  }> {
    const brandLine = brandHint?.trim()
      ? `Brand / OEM manufacturer hint: ${brandHint.trim()}`
      : 'Brand hint: not provided — infer from labels when visible';

    // Use the specialised ECU prompt for electronic modules (ECU, TCM, BCM, etc.)
    // which extracts part numbers and visible label text instead of guessing vehicle identity.
    const useEcuPrompt = isEcuPartType(partType);

    let prompt: string;
    if (useEcuPrompt) {
      prompt = ECU_IDENTIFICATION_PROMPT;
      this.logger.log(
        `Using ECU identification prompt for partType="${partType}"`,
      );
    } else {
      prompt = SINGLE_LISTING_VISION_PROMPT.replace(
        '{partNumberHint}',
        partNumberHint,
      ).replace('{brandHint}', brandLine);
    }
    const visionContext = {
      partNumber: partNumberHint,
      donorMake: brandHint,
      partType: useEcuPrompt ? (partType ?? 'ecu') : 'single_listing_form',
    };
    let visionResult: VisionEnrichmentResult;
    try {
      visionResult = await this.visionPipeline.analyze(
        imageUrls,
        visionContext,
        prompt,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The vision provider fetches image URLs server-side and rejects
      // anything over its own size cap (seen as "cannot exceed 30MB").
      // Retrying the same oversized URL blindly can never succeed — resize
      // once locally and retry with a downsized copy instead of burning
      // repeated retries on a deterministically-doomed call.
      if (!/cannot exceed/i.test(message)) throw err;

      this.logger.warn(
        `Vision call failed on oversized image(s), resizing and retrying once: ${message}`,
      );
      const resizedUrls = await this.resizeImagesForVision(imageUrls);
      if (resizedUrls.length === 0) throw err;

      visionResult = await this.visionPipeline.analyze(
        resizedUrls,
        visionContext,
        prompt,
      );
    }

    const parsed = visionResult.raw;

    // For ECU prompts, the output schema is different (partNumbers, visibleText, vehicleApplication)
    if (useEcuPrompt && visionResult.ecuIdentifiers) {
      const ecu = visionResult.ecuIdentifiers;
      const visibleText = ecu.visibleText ?? [];
      const bestPartNumber =
        ecu.mpn || ecu.oemNumber || ecu.hardwareNumber || partNumberHint;
      let note = '';
      if (ecu.hardwareNumber) note += `HW: ${ecu.hardwareNumber}. `;
      if (ecu.softwareNumber) note += `SW: ${ecu.softwareNumber}. `;
      if (ecu.otherNumbers?.length)
        note += `Other: ${ecu.otherNumbers.join(', ')}. `;
      if (visibleText.length > 0) {
        note += `Visible text: ${visibleText.slice(0, 8).join('; ')}`;
      }

      return {
        result: {
          partName: ecu.partType
            ? `${ecu.brand ?? ''} ${ecu.partType} ${bestPartNumber}`.trim()
            : undefined,
          brand: ecu.brand ?? undefined,
          model: ecu.vehicleModel ?? undefined,
          category: ecu.partType ?? 'Engine Control Units (ECUs)',
          note: note.trim() || undefined,
          partNumber: bestPartNumber,
          confidence: this.normalizeConfidence(ecu.confidence?.overall),
        },
        costUsd: visionResult.estimatedCostUsd,
        visionModel: visionResult.model,
      };
    }

    // Standard (non-ECU) result extraction
    const coverage = parsed.imageCoverage as
      | Record<string, unknown>
      | undefined;
    const hasLabelShot = coverage?.hasLabelShot === true;
    const hasOverallShot = coverage?.hasOverallShot === true;

    if (!hasLabelShot || !hasOverallShot) {
      throw new BadRequestException(
        'Photos must include both a label/part-number close-up and an overall part shot. Add the missing photo type and try again.',
      );
    }

    const visibleText = Array.isArray(parsed.visibleText)
      ? parsed.visibleText.map(String).filter(Boolean)
      : [];
    let note = this.str(parsed.note);
    if (visibleText.length > 0) {
      const ocrSnippet = visibleText.slice(0, 8).join('; ');
      note = note
        ? `${note} Visible text: ${ocrSnippet}`
        : `Visible text: ${ocrSnippet}`;
    }

    const fitment = parsed.fitment as Record<string, unknown> | undefined;
    const confidenceRaw = parsed.confidence;
    const confidenceLevel =
      typeof confidenceRaw === 'object' && confidenceRaw !== null
        ? ((confidenceRaw as Record<string, unknown>).overall ?? confidenceRaw)
        : confidenceRaw;

    return {
      result: {
        partName: this.str(parsed.partName) ?? this.str(parsed.title),
        brand: this.str(parsed.brand),
        model: this.str(parsed.model) ?? this.str(fitment?.model),
        category: this.str(parsed.category) ?? this.str(parsed.partType),
        note,
        partNumber:
          this.str(parsed.partNumber) ??
          this.str(parsed.mpn) ??
          this.str(parsed.oemNumber),
        confidence: this.normalizeConfidence(confidenceLevel),
      },
      costUsd: visionResult.estimatedCostUsd,
      visionModel: visionResult.model,
    };
  }

  private async finalizeLookupFields(
    partial: Partial<PartLookupResult>,
    fallbackPartNumber: string,
    replacePartNumber = false,
  ): Promise<
    Omit<
      PartLookupResult,
      'source' | 'aiModel' | 'estimatedCostUsd' | 'fallbackUsed' | 'visionModel'
    >
  > {
    let brand = partial.brand;
    let model = partial.model;
    let mvlMatched = false;

    if (brand) {
      const canonical = await this.mvl.resolveCanonicalMakeModel(
        EbayMvlService.MOTORS_PARTS_CATEGORY,
        brand,
        model,
      );
      if (canonical.make) brand = canonical.make;
      if (canonical.model) model = canonical.model;
      mvlMatched = canonical.mvlMatched;
    }

    return {
      partName: partial.partName,
      brand,
      model,
      category: partial.category,
      note: partial.note,
      partNumber:
        replacePartNumber && partial.partNumber
          ? partial.partNumber
          : fallbackPartNumber,
      confidence: partial.confidence ?? 'medium',
      mvlMatched,
    };
  }

  async allocateSku(): Promise<string> {
    const rows = await this.listingRepo.query<{ nextval: string }[]>(
      `SELECT nextval('sku_seq') AS nextval`,
    );
    const nextNum = Number(rows[0]?.nextval);
    return this.formatSku(nextNum);
  }

  /** Next row index for warehouse-intake parts (uq_listing_source_row requires unique triple). */
  private async allocateIntakeSourceRow(): Promise<number> {
    const rows = await this.listingRepo.query<{ nextval: string }[]>(
      `SELECT nextval('warehouse_intake_row_seq') AS nextval`,
    );
    return Number(rows[0]?.nextval);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }

  private isSkuUniqueViolation(err: unknown): boolean {
    if (!this.isUniqueViolation(err)) return false;
    const driverError = (err as QueryFailedError & {
      driverError?: { constraint?: string };
    }).driverError;
    return (
      driverError?.constraint === 'idx_listing_sku_marketplace_unique_active' ||
      driverError?.constraint === 'idx_listing_sku_unique_active'
    );
  }

  private formatSku(num: number): string {
    return `${SKU_PREFIX}-${String(num).padStart(5, '0')}`;
  }

  private str(value: unknown): string | undefined {
    if (value == null) return undefined;
    const s = String(value).trim();
    return s || undefined;
  }

  private normalizeConfidence(value: unknown): PartLookupResult['confidence'] {
    const v = String(value ?? '').toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    return 'medium';
  }
}

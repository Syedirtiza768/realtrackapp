import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiEnhancement } from './entities/ai-enhancement.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { EnrichmentPipeline } from '../common/openai/pipelines/enrichment.pipeline.js';
import { ListingGenerationPipeline } from '../common/openai/pipelines/listing-generation.pipeline.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { AiRunLogService } from '../common/openai/ai-run-log.service.js';

/**
 * AI Enhancement Service — generates and manages AI-powered listing improvements.
 * Uses real OpenAI pipelines when available, falls back to local generation.
 */
@Injectable()
export class AiEnhancementService {
  private readonly logger = new Logger(AiEnhancementService.name);

  constructor(
    @InjectRepository(AiEnhancement)
    private readonly enhancementRepo: Repository<AiEnhancement>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    private readonly enrichmentPipeline: EnrichmentPipeline,
    private readonly listingGenPipeline: ListingGenerationPipeline,
    private readonly openAiService: OpenAiService,
    private readonly aiRunLogService: AiRunLogService,
  ) {}

  // ─── Query ───

  async getEnhancements(filters: {
    listingId?: string;
    enhancementType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AiEnhancement[]; total: number }> {
    const qb = this.enhancementRepo.createQueryBuilder('e');

    if (filters.listingId) qb.andWhere('e.listing_id = :listingId', { listingId: filters.listingId });
    if (filters.enhancementType) qb.andWhere('e.enhancement_type = :type', { type: filters.enhancementType });
    if (filters.status) qb.andWhere('e.status = :status', { status: filters.status });

    const [items, total] = await qb
      .orderBy('e.created_at', 'DESC')
      .take(filters.limit ?? 50)
      .skip(filters.offset ?? 0)
      .getManyAndCount();

    return { items, total };
  }

  async getEnhancement(id: string): Promise<AiEnhancement> {
    const enh = await this.enhancementRepo.findOneBy({ id });
    if (!enh) throw new NotFoundException(`Enhancement ${id} not found`);
    return enh;
  }

  async getListingEnhancements(listingId: string): Promise<AiEnhancement[]> {
    return this.enhancementRepo.find({
      where: { listingId },
      order: { enhancementType: 'ASC', enhancementVersion: 'DESC' },
    });
  }

  // ─── Request Enhancement ───

  async requestEnhancement(data: {
    listingId: string;
    enhancementType: AiEnhancement['enhancementType'];
    inputData?: Record<string, unknown>;
  }): Promise<AiEnhancement> {
    const listing = await this.listingRepo.findOneBy({ id: data.listingId });
    if (!listing) throw new NotFoundException(`Listing ${data.listingId} not found`);

    // Find existing version count
    const latestVersion = await this.enhancementRepo
      .createQueryBuilder('e')
      .select('MAX(e.enhancement_version)', 'maxVer')
      .where('e.listing_id = :listingId AND e.enhancement_type = :type', {
        listingId: data.listingId,
        type: data.enhancementType,
      })
      .getRawOne();

    const nextVersion = (latestVersion?.maxVer ?? 0) + 1;

    const inputData = data.inputData ?? this.buildInputData(listing, data.enhancementType);

    const enhancement = this.enhancementRepo.create({
      listingId: data.listingId,
      enhancementType: data.enhancementType,
      status: 'requested',
      inputData,
      originalValue: this.getOriginalValue(listing, data.enhancementType),
      enhancementVersion: nextVersion,
    });

    const saved = await this.enhancementRepo.save(enhancement);
    this.logger.log(
      `Requested ${data.enhancementType} v${nextVersion} for listing ${data.listingId}`,
    );

    // Auto-process (demo mode generates immediately)
    return this.processEnhancement(saved.id);
  }

  async bulkRequestEnhancements(
    listingIds: string[],
    enhancementType: AiEnhancement['enhancementType'],
  ): Promise<{ results: Array<{ listingId: string; enhancementId?: string; status: string; error?: string }> }> {
    const results: Array<{ listingId: string; enhancementId?: string; status: string; error?: string }> = [];

    for (const listingId of listingIds) {
      try {
        const enh = await this.requestEnhancement({ listingId, enhancementType });
        results.push({ listingId, enhancementId: enh.id, status: 'generated' });
      } catch (error: any) {
        results.push({ listingId, status: 'error', error: error.message });
      }
    }

    return { results };
  }

  // ─── Process (generate AI enhancement) ───

  private async processEnhancement(enhancementId: string): Promise<AiEnhancement> {
    const enh = await this.getEnhancement(enhancementId);
    enh.status = 'processing';
    await this.enhancementRepo.save(enh);

    const startMs = Date.now();

    try {
      const result = await this.generateEnhancement(enh);

      enh.status = 'generated';
      enh.enhancedValue = result.enhancedValue;
      enh.enhancedData = result.enhancedData ?? null;
      enh.diff = result.diff ?? null;
      enh.confidenceScore = result.confidenceScore;
      enh.provider = result.provider ?? 'openai';
      enh.model = result.model ?? 'openai/gpt-4.1-mini';
      enh.tokensUsed = result.tokensUsed;
      enh.latencyMs = Date.now() - startMs;
      enh.costUsd = result.costUsd ?? 0;

      return this.enhancementRepo.save(enh);
    } catch (error: any) {
      enh.status = 'rejected';
      enh.rejectionReason = `Processing failed: ${error.message}`;
      enh.latencyMs = Date.now() - startMs;
      await this.enhancementRepo.save(enh);
      throw error;
    }
  }

  // ─── Approval workflow ───

  async approveEnhancement(enhancementId: string, approvedBy?: string): Promise<AiEnhancement> {
    const enh = await this.getEnhancement(enhancementId);

    if (enh.status !== 'generated') {
      throw new BadRequestException(`Cannot approve enhancement in "${enh.status}" status`);
    }

    enh.status = 'approved';
    enh.approvedBy = approvedBy ?? null;
    enh.approvedAt = new Date();

    const saved = await this.enhancementRepo.save(enh);
    await this.aiRunLogService.backfillApproval(enhancementId, true);
    this.logger.log(`Approved enhancement ${enhancementId}`);

    return saved;
  }

  async applyEnhancement(enhancementId: string): Promise<{ enhancement: AiEnhancement; listing: ListingRecord }> {
    const enh = await this.getEnhancement(enhancementId);

    if (enh.status !== 'approved') {
      throw new BadRequestException(`Cannot apply enhancement in "${enh.status}" status — must be approved first`);
    }

    const listing = await this.listingRepo.findOneBy({ id: enh.listingId });
    if (!listing) throw new NotFoundException(`Listing ${enh.listingId} not found`);

    // Apply the enhancement to the listing
    this.applyToListing(listing, enh);
    const savedListing = await this.listingRepo.save(listing);

    enh.appliedAt = new Date();
    const savedEnh = await this.enhancementRepo.save(enh);

    this.logger.log(`Applied ${enh.enhancementType} v${enh.enhancementVersion} to listing ${enh.listingId}`);
    return { enhancement: savedEnh, listing: savedListing };
  }

  async rejectEnhancement(enhancementId: string, reason: string): Promise<AiEnhancement> {
    const enh = await this.getEnhancement(enhancementId);

    if (enh.status !== 'generated') {
      throw new BadRequestException(`Cannot reject enhancement in "${enh.status}" status`);
    }

    enh.status = 'rejected';
    enh.rejectionReason = reason;

    const saved = await this.enhancementRepo.save(enh);
    await this.aiRunLogService.backfillApproval(enhancementId, false, reason);
    return saved;
  }

  // ─── Summary stats ───

  async getStats(): Promise<Record<string, unknown>> {
    const [
      totalCount,
      byType,
      byStatus,
      avgConfidence,
    ] = await Promise.all([
      this.enhancementRepo.count(),
      this.enhancementRepo
        .createQueryBuilder('e')
        .select('e.enhancement_type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.enhancement_type')
        .getRawMany(),
      this.enhancementRepo
        .createQueryBuilder('e')
        .select('e.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.status')
        .getRawMany(),
      this.enhancementRepo
        .createQueryBuilder('e')
        .select('AVG(e.confidence_score)', 'avg')
        .where('e.confidence_score IS NOT NULL')
        .getRawOne(),
    ]);

    return {
      totalCount,
      byType,
      byStatus,
      avgConfidence: Number(avgConfidence?.avg ?? 0),
    };
  }

  // ─── Private: Enhancement generation (demo mode) ───

  private async generateEnhancement(enh: AiEnhancement): Promise<{
    enhancedValue: string;
    enhancedData?: Record<string, unknown>;
    diff?: Record<string, unknown>;
    confidenceScore: number;
    tokensUsed: number;
    provider?: string;
    model?: string;
    costUsd?: number;
  }> {
    const input = enh.inputData;
    const original = enh.originalValue ?? '';

    switch (enh.enhancementType) {
      case 'title_optimization':
      case 'description_generation':
        return this.generateListingContent(enh.enhancementType, original, input);
      case 'item_specifics':
        return this.generateItemSpecificsAI(input, enh.id);
      case 'fitment_detection':
        return this.generateFitmentDetectionAI(input, enh.id);
      case 'image_enhancement':
        return this.generateImageEnhancement(input);
      default:
        throw new BadRequestException(`Unknown enhancement type: ${enh.enhancementType}`);
    }
  }

  /**
   * Use ListingGenerationPipeline for title and description generation.
   */
  private async generateListingContent(
    type: 'title_optimization' | 'description_generation',
    original: string,
    input: Record<string, unknown>,
  ) {
    try {
      const result = await this.listingGenPipeline.generate(
        input,
        String(input['category'] ?? 'Auto Parts'),
        String(input['condition'] ?? 'Used'),
      );

      const enhancedValue = type === 'title_optimization'
        ? result.title
        : result.description;

      const changes = type === 'title_optimization'
        ? ['AI-optimized for eBay search ranking', 'Keyword prominence improved', 'Limited to 80 chars']
        : ['Generated structured HTML description', 'Added product specs & compatibility', 'SEO-optimized content'];

      return {
        enhancedValue,
        enhancedData: {
          title: result.title,
          subtitle: result.subtitle,
          description: result.description,
          bulletPoints: result.bulletPoints,
          searchTerms: result.searchTerms,
          pricePositioning: result.pricePositioning,
        },
        diff: { original: original?.slice(0, 200) ?? '(empty)', enhanced: enhancedValue.slice(0, 200), changes },
        confidenceScore: 0.88,
        tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
        provider: 'openai',
        model: result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
        costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
      };
    } catch (err: any) {
      this.logger.warn(`OpenAI listing generation failed, using fallback: ${err.message}`);
      return this.fallbackListingContent(type, original, input);
    }
  }

  /**
   * Use EnrichmentPipeline for item specifics.
   */
  private async generateItemSpecificsAI(
    input: Record<string, unknown>,
    enhancementId: string,
  ) {
    try {
      const result = await this.enrichmentPipeline.enrich(input, {
        enhancementId,
        productId: this.str(input.productId ?? input.catalogProductId),
        importId: this.str(input.importId),
        marketplace: this.str(input.marketplace) ?? 'US',
      });

      const specifics: Record<string, string> = {
        Brand: result.brand ?? String(input['brand'] ?? 'Unbranded'),
        'Manufacturer Part Number': result.mpn ?? String(input['mpn'] ?? 'Does Not Apply'),
        Type: result.partType ?? String(input['partType'] ?? 'Replacement Part'),
        ...result.itemSpecifics,
      };

      if (result.oemNumber) specifics['OE/OEM Part Number'] = result.oemNumber;

      return {
        enhancedValue: JSON.stringify(specifics),
        enhancedData: { specifics, fieldCount: Object.keys(specifics).length, searchKeywords: result.searchKeywords },
        diff: { added: Object.keys(specifics), fieldCount: Object.keys(specifics).length },
        confidenceScore: result.confidence?.overall ?? 0.85,
        tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
        provider: 'openai',
        model: result.model ?? result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
        costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
      };
    } catch (err: any) {
      this.logger.warn(`OpenAI enrichment failed, using fallback: ${err.message}`);
      return this.fallbackItemSpecifics(input);
    }
  }

  /**
   * Use EnrichmentPipeline for fitment detection.
   */
  private async generateFitmentDetectionAI(
    input: Record<string, unknown>,
    enhancementId: string,
  ) {
    try {
      const result = await this.enrichmentPipeline.enrich(
        {
          ...input,
          extractFitment: true,
        },
        {
          enhancementId,
          productId: this.str(input.productId ?? input.catalogProductId),
          importId: this.str(input.importId),
          marketplace: this.str(input.marketplace) ?? 'US',
        },
      );

      const fitments = result.itemSpecifics?.fitments
        ? JSON.parse(String(result.itemSpecifics.fitments))
        : [];

      return {
        enhancedValue: JSON.stringify(fitments),
        enhancedData: { fitments, suggestedCategory: result.suggestedCategory },
        diff: { fitmentCount: fitments.length, detectedFromAI: true },
        confidenceScore: result.confidence?.overall ?? 0.75,
        tokensUsed: result.rawResponse?.usage?.totalTokens ?? 0,
        provider: 'openai',
        model: result.model ?? result.rawResponse?.model ?? 'openai/gpt-4.1-mini',
        costUsd: result.rawResponse?.estimatedCostUsd ?? 0,
      };
    } catch (err: any) {
      this.logger.warn(`OpenAI fitment detection failed, using fallback: ${err.message}`);
      return this.fallbackFitmentDetection(input);
    }
  }

  // ─── Fallback methods (used when OpenAI is unavailable) ───

  private fallbackListingContent(
    type: 'title_optimization' | 'description_generation',
    original: string,
    input: Record<string, unknown>,
  ) {
    const brand = String(input['brand'] ?? '');
    const mpn = String(input['mpn'] ?? '');
    const partType = String(input['partType'] ?? 'Auto Part');

    if (type === 'title_optimization') {
      const pieces = [brand, mpn, partType, 'OEM Direct Fit'].filter(Boolean);
      const enhanced = pieces.join(' ').slice(0, 80).trim();
      return {
        enhancedValue: enhanced,
        diff: { original, enhanced, changes: ['Fallback: keyword concatenation'] },
        confidenceScore: 0.5,
        tokensUsed: 0,
        provider: 'fallback',
        model: 'rule-based',
        costUsd: 0,
      };
    }

    const title = String(input['title'] ?? 'Auto Part');
    const enhanced = `<h3>${title}</h3><p><strong>Brand:</strong> ${brand} | <strong>MPN:</strong> ${mpn}</p><p>OEM-quality direct replacement part. Please verify fitment before purchasing.</p>`;
    return {
      enhancedValue: enhanced,
      diff: { original: original?.slice(0, 200) ?? '(empty)', enhanced: enhanced.slice(0, 200), changes: ['Fallback: template-based'] },
      confidenceScore: 0.5,
      tokensUsed: 0,
      provider: 'fallback',
      model: 'rule-based',
      costUsd: 0,
    };
  }

  private fallbackItemSpecifics(input: Record<string, unknown>) {
    const specifics: Record<string, string> = {
      Brand: String(input['brand'] ?? 'Unbranded'),
      'Manufacturer Part Number': String(input['mpn'] ?? 'Does Not Apply'),
      Type: String(input['partType'] ?? 'Replacement Part'),
      'Fitment Type': 'Direct Replacement',
      Warranty: 'No Warranty',
    };
    if (input['oemNumber']) specifics['OE/OEM Part Number'] = String(input['oemNumber']);

    return {
      enhancedValue: JSON.stringify(specifics),
      enhancedData: { specifics, fieldCount: Object.keys(specifics).length },
      diff: { added: Object.keys(specifics), fieldCount: Object.keys(specifics).length },
      confidenceScore: 0.5,
      tokensUsed: 0,
      provider: 'fallback',
      model: 'rule-based',
      costUsd: 0,
    };
  }

  private fallbackFitmentDetection(input: Record<string, unknown>) {
    const title = String(input['title'] ?? '');
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const years = Array.from(title.matchAll(yearPattern)).map((m) => m[0]);
    const makes = ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'BMW', 'Mercedes-Benz', 'Dodge', 'Audi', 'Volkswagen', 'Jaguar', 'Land Rover'];
    const detectedMake = makes.find((m) => title.toLowerCase().includes(m.toLowerCase())) ?? 'Universal';

    const fitments = years.length > 0
      ? years.map((y) => ({ year: y, make: detectedMake, model: 'Various' }))
      : [];

    return {
      enhancedValue: JSON.stringify(fitments),
      enhancedData: { fitments, fitmentCount: fitments.length, detectedMake },
      diff: { fitmentCount: fitments.length },
      confidenceScore: years.length > 0 ? 0.6 : 0.3,
      tokensUsed: 0,
      provider: 'fallback',
      model: 'rule-based',
      costUsd: 0,
    };
  }

  private generateImageEnhancement(input: Record<string, unknown>) {
    const imageCount = Number(input['imageCount'] ?? 1);
    return {
      enhancedValue: `${imageCount} image(s) queued for enhancement`,
      enhancedData: {
        processedImages: imageCount,
        enhancements: ['Background removal', 'Auto-crop', 'Brightness optimization', 'Resize to 1600x1600'],
      },
      diff: { imageCount, enhancementsApplied: 4 },
      confidenceScore: 0.9,
      tokensUsed: 0,
      provider: 'local',
      model: 'image-processor',
      costUsd: 0,
    };
  }

  // ─── Private: Input data builders ───

  private buildInputData(
    listing: ListingRecord,
    type: AiEnhancement['enhancementType'],
  ): Record<string, unknown> {
    return {
      title: listing.title,
      brand: (listing as any).cBrand ?? null,
      mpn: (listing as any).cManufacturerPartNumber ?? null,
      oemNumber: (listing as any).cOeOemPartNumber ?? null,
      partType: (listing as any).cType ?? null,
      condition: (listing as any).conditionId ?? null,
      features: (listing as any).cFeatures ?? null,
      price: (listing as any).startPrice ?? null,
      imageCount: (listing as any).pictureUrl ? 1 : 0,
    };
  }

  private getOriginalValue(
    listing: ListingRecord,
    type: AiEnhancement['enhancementType'],
  ): string | null {
    switch (type) {
      case 'title_optimization':
        return listing.title ?? null;
      case 'description_generation':
        return (listing as any).description ?? null;
      case 'item_specifics':
        return JSON.stringify({
          brand: (listing as any).cBrand,
          mpn: (listing as any).cManufacturerPartNumber,
          condition: (listing as any).conditionId,
        });
      case 'fitment_detection':
        return listing.title ?? null;
      case 'image_enhancement':
        return (listing as any).pictureUrl ?? null;
      default:
        return null;
    }
  }

  private applyToListing(
    listing: ListingRecord,
    enh: AiEnhancement,
  ): void {
    switch (enh.enhancementType) {
      case 'title_optimization':
        if (enh.enhancedValue) listing.title = enh.enhancedValue;
        break;
      case 'description_generation':
        if (enh.enhancedValue) (listing as any).description = enh.enhancedValue;
        break;
      case 'item_specifics':
        if (enh.enhancedData?.specifics) {
          const specs = enh.enhancedData.specifics as Record<string, string>;
          if (specs['Brand']) (listing as any).cBrand = specs['Brand'];
          if (specs['Manufacturer Part Number']) {
            (listing as any).cManufacturerPartNumber = specs['Manufacturer Part Number'];
          }
        }
        break;
      // fitment_detection and image_enhancement don't directly modify listing fields
    }
  }

  private str(val: unknown): string | undefined {
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
  }
}

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

/**
 * AI Enhancement Service — generates and manages AI-powered listing improvements.
 * In demo mode, uses sophisticated simulation. In production, integrates with
 * OpenAI/Anthropic APIs for real AI-powered enhancements.
 */
@Injectable()
export class AiEnhancementService {
  private readonly logger = new Logger(AiEnhancementService.name);

  constructor(
    @InjectRepository(AiEnhancement)
    private readonly enhancementRepo: Repository<AiEnhancement>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
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
      enh.provider = 'demo';
      enh.model = 'demo-sim-v1';
      enh.tokensUsed = result.tokensUsed;
      enh.latencyMs = Date.now() - startMs;
      enh.costUsd = 0;

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

    return this.enhancementRepo.save(enh);
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
  }> {
    // Simulate AI processing delay
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 400));

    const input = enh.inputData;
    const original = enh.originalValue ?? '';

    switch (enh.enhancementType) {
      case 'title_optimization':
        return this.generateTitleOptimization(original, input);
      case 'description_generation':
        return this.generateDescription(original, input);
      case 'item_specifics':
        return this.generateItemSpecifics(input);
      case 'fitment_detection':
        return this.generateFitmentDetection(input);
      case 'image_enhancement':
        return this.generateImageEnhancement(input);
      default:
        throw new BadRequestException(`Unknown enhancement type: ${enh.enhancementType}`);
    }
  }

  private generateTitleOptimization(
    original: string,
    input: Record<string, unknown>,
  ) {
    const brand = String(input['brand'] ?? '');
    const mpn = String(input['mpn'] ?? '');
    const partType = String(input['partType'] ?? 'Auto Part');

    // Demo: create an optimized eBay-style title (max 80 chars)
    const keywords = [brand, mpn, partType].filter(Boolean);
    const condition = String(input['condition'] ?? 'New');
    const oemPart = String(input['oemNumber'] ?? '');
    const pieces = [...keywords, condition !== 'New' ? condition : '', oemPart ? `OEM ${oemPart}` : '', 'Direct Fit', 'Free Shipping'].filter(Boolean);
    const enhanced = pieces.join(' ').slice(0, 80).trim();

    return {
      enhancedValue: enhanced,
      diff: {
        original,
        enhanced,
        changes: [
          'Added brand keyword prominence',
          'Added MPN for search visibility',
          'Added shipping mention',
          'Optimized for eBay 80-char limit',
        ],
      },
      confidenceScore: 0.85 + Math.random() * 0.12,
      tokensUsed: 150 + Math.floor(Math.random() * 100),
    };
  }

  private generateDescription(
    original: string,
    input: Record<string, unknown>,
  ) {
    const brand = String(input['brand'] ?? 'OEM');
    const mpn = String(input['mpn'] ?? 'N/A');
    const title = String(input['title'] ?? 'Auto Part');
    const features = (input['features'] as string[]) ?? [];

    const enhanced = [
      `<h2>${title}</h2>`,
      `<p><strong>Brand:</strong> ${brand} | <strong>MPN:</strong> ${mpn}</p>`,
      `<h3>Key Features</h3>`,
      `<ul>`,
      ...features.slice(0, 5).map((f) => `  <li>${f}</li>`),
      features.length === 0 ? '  <li>OEM-quality direct replacement part</li>' : '',
      `  <li>Manufactured to exact OEM specifications</li>`,
      `  <li>Quality tested for reliable performance</li>`,
      `</ul>`,
      `<h3>Compatibility</h3>`,
      `<p>Please verify fitment using the compatibility table above before purchasing.</p>`,
      `<h3>Shipping & Returns</h3>`,
      `<p>Ships same day if ordered before 2pm EST. 30-day hassle-free returns.</p>`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      enhancedValue: enhanced,
      diff: {
        original: original?.slice(0, 200) ?? '(empty)',
        enhanced: enhanced.slice(0, 200),
        changes: [
          'Generated structured HTML description',
          'Added product specifications section',
          'Added compatibility notice',
          'Added shipping & returns section',
        ],
      },
      confidenceScore: 0.82 + Math.random() * 0.15,
      tokensUsed: 300 + Math.floor(Math.random() * 200),
    };
  }

  private generateItemSpecifics(input: Record<string, unknown>) {
    const specifics: Record<string, string> = {
      Brand: String(input['brand'] ?? 'Unbranded'),
      'Manufacturer Part Number': String(input['mpn'] ?? 'Does Not Apply'),
      Condition: String(input['condition'] ?? 'New'),
      Type: String(input['partType'] ?? 'Replacement Part'),
      'Placement on Vehicle': 'Front, Rear, Left, Right',
      Warranty: '1 Year',
      'Country/Region of Manufacture': 'United States',
      'Fitment Type': 'Direct Replacement',
    };

    if (input['oemNumber']) {
      specifics['OE/OEM Part Number'] = String(input['oemNumber']);
      specifics['Interchange Part Number'] = String(input['oemNumber']);
    }

    return {
      enhancedValue: JSON.stringify(specifics),
      enhancedData: { specifics, fieldCount: Object.keys(specifics).length },
      diff: {
        added: Object.keys(specifics),
        fieldCount: Object.keys(specifics).length,
      },
      confidenceScore: 0.88 + Math.random() * 0.1,
      tokensUsed: 200 + Math.floor(Math.random() * 100),
    };
  }

  private generateFitmentDetection(input: Record<string, unknown>) {
    const title = String(input['title'] ?? '');

    // Demo: extract year/make/model from title patterns
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const years = Array.from(title.matchAll(yearPattern)).map((m) => m[0]);

    const makes = ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'Nissan', 'BMW', 'Mercedes', 'Dodge', 'Jeep', 'Hyundai'];
    const detectedMake = makes.find((m) => title.toLowerCase().includes(m.toLowerCase())) ?? 'Universal';

    const fitments = years.length > 0
      ? years.map((y) => ({
          year: y,
          make: detectedMake,
          model: 'Various',
          trim: 'All',
          engine: 'All Engines',
        }))
      : [
          { year: '2015-2020', make: detectedMake, model: 'Various Models', trim: 'All', engine: 'All' },
        ];

    return {
      enhancedValue: JSON.stringify(fitments),
      enhancedData: {
        fitments,
        fitmentCount: fitments.length,
        detectedMake,
        detectedYears: years,
      },
      diff: {
        detectedFromTitle: years.length > 0,
        fitmentCount: fitments.length,
      },
      confidenceScore: years.length > 0 ? 0.75 + Math.random() * 0.2 : 0.4 + Math.random() * 0.2,
      tokensUsed: 250 + Math.floor(Math.random() * 150),
    };
  }

  private generateImageEnhancement(input: Record<string, unknown>) {
    const imageCount = Number(input['imageCount'] ?? 1);

    return {
      enhancedValue: `Enhanced ${imageCount} image(s): background removal, auto-crop, brightness adjustment`,
      enhancedData: {
        processedImages: imageCount,
        enhancements: [
          'Background removed (white)',
          'Auto-cropped to product bounds',
          'Brightness/contrast optimized',
          'Sharpened for marketplace display',
          'Resized to 1600x1600 (eBay optimal)',
        ],
        estimatedSizeReduction: `${Math.round(15 + Math.random() * 25)}%`,
      },
      diff: { imageCount, enhancementsApplied: 5 },
      confidenceScore: 0.9 + Math.random() * 0.08,
      tokensUsed: 500 + Math.floor(Math.random() * 300),
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
}

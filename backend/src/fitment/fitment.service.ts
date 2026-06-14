import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ILike, Repository } from 'typeorm';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
import { PartFitment } from './entities/part-fitment.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import type { CreateFitmentDto } from './dto/create-fitment.dto.js';
import type { SearchFitmentDto } from './dto/search-fitment.dto.js';
import { VinDecodeService } from './vin-decode.service.js';

@Injectable()
export class FitmentService {
  private readonly logger = new Logger(FitmentService.name);

  constructor(
    @InjectRepository(FitmentMake)
    private readonly makeRepo: Repository<FitmentMake>,
    @InjectRepository(FitmentModel)
    private readonly modelRepo: Repository<FitmentModel>,
    @InjectRepository(FitmentSubmodel)
    private readonly submodelRepo: Repository<FitmentSubmodel>,
    @InjectRepository(FitmentEngine)
    private readonly engineRepo: Repository<FitmentEngine>,
    @InjectRepository(PartFitment)
    private readonly fitmentRepo: Repository<PartFitment>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    private readonly vinDecodeService: VinDecodeService,
  ) {}

  // ─── Reference data lookups ───

  async getMakes(q?: string): Promise<FitmentMake[]> {
    if (q) {
      return this.makeRepo.find({
        where: { name: ILike(`%${q}%`) },
        order: { name: 'ASC' },
        take: 50,
      });
    }
    return this.makeRepo.find({ order: { name: 'ASC' } });
  }

  async getModels(makeId: number): Promise<FitmentModel[]> {
    return this.modelRepo.find({
      where: { makeId },
      order: { name: 'ASC' },
    });
  }

  async getSubmodels(modelId: number): Promise<FitmentSubmodel[]> {
    return this.submodelRepo.find({
      where: { modelId },
      order: { name: 'ASC' },
    });
  }

  async getEngines(q?: string): Promise<FitmentEngine[]> {
    if (q) {
      return this.engineRepo.find({
        where: { code: ILike(`%${q}%`) },
        order: { code: 'ASC' },
        take: 50,
      });
    }
    return this.engineRepo.find({ order: { code: 'ASC' } });
  }

  // ─── Part fitment CRUD ───

  async getListingFitments(listingId: string): Promise<PartFitment[]> {
    return this.fitmentRepo.find({
      where: { listingId },
      relations: ['make', 'model', 'submodel', 'engine'],
      order: { yearStart: 'ASC' },
    });
  }

  async createFitment(
    listingId: string,
    dto: CreateFitmentDto,
  ): Promise<PartFitment> {
    // Validate year range
    if (dto.yearStart > dto.yearEnd) {
      throw new Error('yearStart must be <= yearEnd');
    }
    if (dto.yearEnd - dto.yearStart > 50) {
      throw new Error('Year range cannot exceed 50 years');
    }

    const fitment = this.fitmentRepo.create({
      listingId,
      makeId: dto.makeId,
      modelId: dto.modelId,
      submodelId: dto.submodelId ?? null,
      yearStart: dto.yearStart,
      yearEnd: dto.yearEnd,
      engineId: dto.engineId ?? null,
      source: (dto.source as PartFitment['source']) ?? 'manual',
      confidence: dto.confidence ?? null,
      notes: dto.notes ?? null,
    });

    const saved = await this.fitmentRepo.save(fitment);
    this.logger.log(
      `Created fitment ${saved.id} for listing=${listingId}`,
    );
    return saved;
  }

  async deleteFitment(fitmentId: string): Promise<void> {
    const result = await this.fitmentRepo.delete(fitmentId);
    if (result.affected === 0) {
      throw new NotFoundException(`Fitment ${fitmentId} not found`);
    }
  }

  async verifyFitment(
    fitmentId: string,
    verified: boolean,
    userId?: string,
  ): Promise<PartFitment> {
    const fitment = await this.fitmentRepo.findOneBy({ id: fitmentId });
    if (!fitment) {
      throw new NotFoundException(`Fitment ${fitmentId} not found`);
    }

    fitment.verified = verified;
    fitment.verifiedBy = userId ?? null;
    fitment.verifiedAt = verified ? new Date() : null;
    return this.fitmentRepo.save(fitment);
  }

  // ─── Search by vehicle ───

  async searchByVehicle(
    dto: SearchFitmentDto,
  ): Promise<{ fitments: PartFitment[]; total: number }> {
    const qb = this.fitmentRepo
      .createQueryBuilder('pf')
      .leftJoinAndSelect('pf.make', 'make')
      .leftJoinAndSelect('pf.model', 'model')
      .leftJoinAndSelect('pf.submodel', 'submodel')
      .leftJoinAndSelect('pf.engine', 'engine');

    if (dto.make) {
      qb.andWhere('make.slug = :makeSlug', { makeSlug: dto.make.toLowerCase() });
    }
    if (dto.model) {
      qb.andWhere('model.slug = :modelSlug', { modelSlug: dto.model.toLowerCase() });
    }
    if (dto.yearStart) {
      qb.andWhere('pf.year_end >= :yearStart', { yearStart: dto.yearStart });
    }
    if (dto.yearEnd) {
      qb.andWhere('pf.year_start <= :yearEnd', { yearEnd: dto.yearEnd });
    }
    if (dto.engine) {
      qb.andWhere('engine.code ILIKE :engineCode', {
        engineCode: `%${dto.engine}%`,
      });
    }

    qb.orderBy('pf.year_start', 'ASC')
      .take(dto.limit ?? 50)
      .skip(dto.offset ?? 0);

    const [fitments, total] = await qb.getManyAndCount();
    return { fitments, total };
  }

  /**
   * Find all listings that fit a vehicle identified by VIN.
   * Uses decoded VIN → make/model/year to resolve fitments, then
   * returns the unique listing records attached to those fitments.
   * When AI enrichment is available, uses enhanced data for broader matching.
   */
  async findListingsByVin(vin: string) {
    const decoded = await this.vinDecodeService.decode(vin);
    const year = parseInt(decoded.year, 10);
    const makeSlug = this.slugify(decoded.make);
    const modelSlug = this.slugify(decoded.model);

    const qb = this.fitmentRepo
      .createQueryBuilder('pf')
      .leftJoinAndSelect('pf.make', 'make')
      .leftJoinAndSelect('pf.model', 'model')
      .leftJoinAndSelect('pf.submodel', 'submodel')
      .leftJoinAndSelect('pf.engine', 'engine')
      .leftJoinAndSelect('pf.listing', 'listing');

    if (makeSlug) {
      qb.andWhere('make.slug = :makeSlug', { makeSlug });
    }
    if (modelSlug) {
      qb.andWhere('model.slug = :modelSlug', { modelSlug });
    }
    if (!Number.isNaN(year)) {
      qb.andWhere('pf.year_start <= :year AND pf.year_end >= :year', {
        year,
      });
    }

    const fitments = await qb.getMany();

    const listingsMap = new Map<string, unknown>();
    for (const f of fitments) {
      const listing: any = f.listing;
      if (listing?.id && !listingsMap.has(listing.id)) {
        listingsMap.set(listing.id, listing);
      }
    }

    let listings = Array.from(listingsMap.values());
    let matchStrategy: 'fitment' | 'fallback_text' | 'ai_enriched' = 'fitment';

    // Fallback for datasets where explicit fitment rows are missing
    if (listings.length === 0) {
      listings = await this.findListingsByVehicleText(decoded.make, decoded.model, year);
      matchStrategy = 'fallback_text';
    }

    // Enhanced search using AI-enriched data: try knownFitment vehicles and commonParts
    if (listings.length === 0 && decoded.aiEnriched && decoded.aiData) {
      const aiListings = await this.findListingsByAiEnrichment(decoded);
      if (aiListings.length > 0) {
        listings = aiListings;
        matchStrategy = 'ai_enriched';
      }
    }

    return {
      vin: decoded.vin,
      vehicle: decoded,
      totalFitments: fitments.length,
      totalListings: listings.length,
      matchStrategy,
      listings,
    };
  }

  /**
   * Search listings using AI-enriched data: knownFitment vehicles and commonParts keywords.
   */
  private async findListingsByAiEnrichment(decoded: any): Promise<ListingRecord[]> {
    const aiData = decoded.aiData;
    const listingsMap = new Map<string, ListingRecord>();

    // Search by known compatible vehicles (e.g. "2015-2020 Lexus NX 200t")
    if (aiData.knownFitment?.length) {
      for (const fitment of aiData.knownFitment.slice(0, 5)) {
        const parts = fitment.match(/(\d{4})?[-–]?(\d{4})?\s+(\w+)\s+(\w[\w\s]*)/);
        if (parts) {
          const [, yrStart, yrEnd, make, model] = parts;
          const results = await this.findListingsByVehicleText(
            make,
            model?.trim(),
            yrStart ? parseInt(yrStart, 10) : NaN,
          );
          for (const r of results) {
            if (!listingsMap.has(r.id)) listingsMap.set(r.id, r);
          }
        }
      }
    }

    // Search by common parts keywords combined with make/model
    if (listingsMap.size === 0 && aiData.commonParts?.length) {
      const searchTerms = [
        `${decoded.make} ${decoded.model}`,
        ...aiData.commonParts.slice(0, 5),
      ];
      for (const term of searchTerms) {
        const qb = this.listingRepo
          .createQueryBuilder('r')
          .select([
            'r.id', 'r.customLabelSku', 'r.title', 'r.cBrand', 'r.cType',
            'r.categoryId', 'r.categoryName', 'r.startPrice', 'r.quantity',
            'r.conditionId', 'r.itemPhotoUrl', 'r.cManufacturerPartNumber',
            'r.cOeOemPartNumber', 'r.location', 'r.format', 'r.sourceFileName',
            'r.importedAt', 'r.extractedMake', 'r.extractedModel',
          ])
          .where('r.title ILIKE :term', { term: `%${term}%` })
          .orderBy('r.importedAt', 'DESC')
          .limit(50);
        const results = await qb.getMany();
        for (const r of results) {
          if (!listingsMap.has(r.id)) listingsMap.set(r.id, r);
        }
        if (listingsMap.size >= 100) break;
      }
    }

    return Array.from(listingsMap.values());
  }

  private async findListingsByVehicleText(
    make: string,
    model: string,
    year: number,
  ): Promise<ListingRecord[]> {
    const normalizedMake = make?.trim();
    const normalizedModel = model?.trim();

    if (!normalizedMake || !normalizedModel) {
      return [];
    }

    const qb = this.listingRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.customLabelSku',
        'r.title',
        'r.cBrand',
        'r.cType',
        'r.categoryId',
        'r.categoryName',
        'r.startPrice',
        'r.quantity',
        'r.conditionId',
        'r.itemPhotoUrl',
        'r.cManufacturerPartNumber',
        'r.cOeOemPartNumber',
        'r.location',
        'r.format',
        'r.sourceFileName',
        'r.importedAt',
        'r.extractedMake',
        'r.extractedModel',
      ])
      .where(
        new Brackets((whereQb) => {
          whereQb
            .where('r.extractedMake ILIKE :make', { make: normalizedMake })
            .orWhere(
              '(r.title ILIKE :makeLike AND r.title ILIKE :modelLike)',
              {
                makeLike: `%${normalizedMake}%`,
                modelLike: `%${normalizedModel}%`,
              },
            )
            .orWhere(
              '(r.description ILIKE :makeLike2 AND r.description ILIKE :modelLike2)',
              {
                makeLike2: `%${normalizedMake}%`,
                modelLike2: `%${normalizedModel}%`,
              },
            );
        }),
      )
      .orderBy('r.importedAt', 'DESC')
      .addOrderBy('r.id', 'ASC')
      .limit(300);

    if (!Number.isNaN(year)) {
      qb.andWhere(
        new Brackets((yearQb) => {
          yearQb
            .where('r.title ILIKE :yearStr', { yearStr: `%${year}%` })
            .orWhere('r.description ILIKE :yearStr2', { yearStr2: `%${year}%` });
        }),
      );
    }

    return qb.getMany();
  }

  private slugify(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-');
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentSubmodel } from './entities/fitment-submodel.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';
import { PartFitment } from './entities/part-fitment.entity.js';
import type { CreateFitmentDto } from './dto/create-fitment.dto.js';
import type { SearchFitmentDto } from './dto/search-fitment.dto.js';

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
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FitmentMake } from './entities/fitment-make.entity.js';
import { FitmentModel } from './entities/fitment-model.entity.js';
import { FitmentEngine } from './entities/fitment-engine.entity.js';

export interface DetectedFitment {
  makeSlug: string;
  modelSlug: string;
  submodel?: string;
  yearStart: number;
  yearEnd: number;
  engineCode?: string;
  confidence: number;
}

/**
 * Takes raw AI output like "Fits 2015-2020 Toyota Camry LE 2.5L"
 * and resolves to structured fitment records.
 */
@Injectable()
export class FitmentMatcherService {
  private readonly logger = new Logger(FitmentMatcherService.name);

  constructor(
    @InjectRepository(FitmentMake)
    private readonly makeRepo: Repository<FitmentMake>,
    @InjectRepository(FitmentModel)
    private readonly modelRepo: Repository<FitmentModel>,
    @InjectRepository(FitmentEngine)
    private readonly engineRepo: Repository<FitmentEngine>,
  ) {}

  /**
   * Parse a raw fitment string into structured DetectedFitment objects.
   */
  async detectFromText(text: string): Promise<DetectedFitment[]> {
    const results: DetectedFitment[] = [];

    // Pattern: "2015-2020 Toyota Camry" or "Fits 2015-2020 Toyota Camry LE 2.5L"
    const yearRangePattern =
      /(\d{4})\s*[-–]\s*(\d{4})\s+([A-Za-z-]+)\s+([A-Za-z0-9 -]+?)(?:\s+(LE|SE|XLE|XSE|SR|SR5|TRD|Sport|Limited|Base|Premium|Touring|EX|LX|DX|SV|SL|S|LT|LS|RS|SS|GT|ST|SEL|Titanium))?(?:\s+(\d\.\d+L\s*(?:I\d|V\d|H\d|L\d)?))?/gi;

    let match: RegExpExecArray | null;
    while ((match = yearRangePattern.exec(text)) !== null) {
      const yearStart = parseInt(match[1], 10);
      const yearEnd = parseInt(match[2], 10);
      const makeName = match[3];
      const modelName = match[4].trim();
      const submodel = match[5] || undefined;
      const engineCode = match[6] || undefined;

      // Fuzzy match make
      const makeMatch = await this.fuzzyMatchMake(makeName);
      if (!makeMatch) continue;

      // Fuzzy match model
      const modelMatch = await this.fuzzyMatchModel(makeMatch.id, modelName);
      if (!modelMatch) continue;

      results.push({
        makeSlug: makeMatch.slug,
        modelSlug: modelMatch.slug,
        submodel,
        yearStart,
        yearEnd,
        engineCode,
        confidence: this.calculateConfidence(makeMatch.name, makeName, modelMatch.name, modelName),
      });
    }

    // Also try single-year patterns: "2018 Toyota Camry"
    const singleYearPattern =
      /\b(\d{4})\s+([A-Za-z-]+)\s+([A-Za-z0-9 -]+?)(?:\s+(LE|SE|XLE|XSE|SR|SR5|TRD|Sport|Limited|Base|Premium|Touring|EX|LX|DX|SV|SL|S|LT|LS|RS|SS|GT|ST|SEL|Titanium))?\b/gi;

    while ((match = singleYearPattern.exec(text)) !== null) {
      const year = parseInt(match[1], 10);
      const makeName = match[2];
      const modelName = match[3].trim();
      const submodel = match[4] || undefined;

      // Skip if already found this make+model combo
      const makeMatch = await this.fuzzyMatchMake(makeName);
      if (!makeMatch) continue;
      const modelMatch = await this.fuzzyMatchModel(makeMatch.id, modelName);
      if (!modelMatch) continue;

      const alreadyFound = results.some(
        (r) => r.makeSlug === makeMatch.slug && r.modelSlug === modelMatch.slug,
      );
      if (alreadyFound) continue;

      results.push({
        makeSlug: makeMatch.slug,
        modelSlug: modelMatch.slug,
        submodel,
        yearStart: year,
        yearEnd: year,
        confidence: this.calculateConfidence(makeMatch.name, makeName, modelMatch.name, modelName) * 0.9,
      });
    }

    this.logger.log(`Detected ${results.length} fitment(s) from text`);
    return results;
  }

  private async fuzzyMatchMake(name: string): Promise<FitmentMake | null> {
    // Try exact match first
    const exact = await this.makeRepo.findOne({
      where: { slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-') },
    });
    if (exact) return exact;

    // Fuzzy match
    const fuzzy = await this.makeRepo.find({
      where: { name: ILike(`%${name}%`) },
      take: 1,
    });
    return fuzzy[0] ?? null;
  }

  private async fuzzyMatchModel(
    makeId: number,
    name: string,
  ): Promise<FitmentModel | null> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const exact = await this.modelRepo.findOne({
      where: { makeId, slug },
    });
    if (exact) return exact;

    const fuzzy = await this.modelRepo.find({
      where: { makeId, name: ILike(`%${name}%`) },
      take: 1,
    });
    return fuzzy[0] ?? null;
  }

  private calculateConfidence(
    dbMake: string,
    inputMake: string,
    dbModel: string,
    inputModel: string,
  ): number {
    const makeScore =
      dbMake.toLowerCase() === inputMake.toLowerCase() ? 1.0 : 0.8;
    const modelScore =
      dbModel.toLowerCase() === inputModel.toLowerCase() ? 1.0 : 0.75;
    return (makeScore + modelScore) / 2;
  }
}

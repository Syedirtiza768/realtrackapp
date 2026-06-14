import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinCache } from './entities/vin-cache.entity.js';
import { OpenAiService } from '../common/openai/openai.service.js';

/* ── Types ── */

export interface VinDecodeResult {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  bodyClass: string;
  driveType: string;
  engineCylinders: string;
  engineDisplacementL: string;
  fuelType: string;
  plantCountry: string;
  vehicleType: string;
  raw: Record<string, string>;
  aiEnriched?: boolean;
  aiData?: {
    engineDescription?: string;
    transmission?: string;
    mpg?: string;
    horsepower?: string;
    torque?: string;
    seatingCapacity?: string;
    wheelbase?: string;
    curbWeight?: string;
    commonParts?: string[];
    knownFitment?: string[];
    description?: string;
  };
}

/**
 * VinDecodeService — Decode VINs using NHTSA vPIC + AI enrichment.
 *
 * NHTSA provides free baseline decode. When the response is incomplete
 * (missing model, trim, engine, etc.), OpenRouter AI fills in the gaps
 * using VIN pattern analysis and automotive knowledge.
 *
 * Results are cached in a `vin_cache` table (30-day TTL).
 */
@Injectable()
export class VinDecodeService {
  private readonly logger = new Logger(VinDecodeService.name);

  /** NHTSA vPIC base URL */
  private static readonly NHTSA_BASE =
    'https://vpic.nhtsa.dot.gov/api/vehicles';

  /** VIN regex: exactly 17 alphanumeric characters (excluding I, O, Q) */
  private static readonly VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

  constructor(
    @InjectRepository(VinCache)
    private readonly cacheRepo: Repository<VinCache>,
    private readonly openai: OpenAiService,
  ) {}

  /**
   * Decode a VIN to structured vehicle data.
   * Returns cached result if available, otherwise calls NHTSA + AI enrichment.
   */
  async decode(vin: string): Promise<VinDecodeResult> {
    const normalizedVin = vin.trim().toUpperCase();

    if (!VinDecodeService.VIN_REGEX.test(normalizedVin)) {
      throw new BadRequestException(
        `Invalid VIN format: "${vin}". Must be 17 alphanumeric characters.`,
      );
    }

    // Check cache first
    const cached = await this.cacheRepo.findOne({
      where: { vin: normalizedVin },
    });

    if (cached && !this.isExpired(cached.fetchedAt)) {
      this.logger.debug(`VIN cache hit: ${normalizedVin}`);
      return cached.decodedData as unknown as VinDecodeResult;
    }

    // Call NHTSA API
    this.logger.log(`Decoding VIN via NHTSA: ${normalizedVin}`);
    const url = `${VinDecodeService.NHTSA_BASE}/DecodeVin/${normalizedVin}?format=json`;

    const { data } = await axios.get(url, { timeout: 15_000 });
    const results: Array<{ Variable: string; Value: string | null }> =
      data?.Results ?? [];

    const raw = this.buildRawMap(results);
    let decoded = this.normalize(normalizedVin, raw);

    // AI enrichment when NHTSA returns incomplete data
    const isIncomplete = !decoded.model || !decoded.trim || !decoded.engineCylinders;
    if (isIncomplete) {
      try {
        this.logger.log(`NHTSA decode incomplete for ${normalizedVin}, enriching via AI...`);
        decoded = await this.enrichWithAI(decoded);
      } catch (err: any) {
        this.logger.warn(`AI enrichment failed for ${normalizedVin}: ${err.message}`);
      }
    }

    // Upsert cache
    await this.cacheRepo.upsert(
      {
        vin: normalizedVin,
        decodedData: decoded as any,
        fetchedAt: new Date(),
      },
      ['vin'],
    );

    return decoded;
  }

  /**
   * Map decoded VIN to an eBay compatibility filter object.
   * Suitable for passing directly to EbayMvlService.getPropertyValues().
   */
  async toEbayCompatibilityFilter(
    vin: string,
  ): Promise<Record<string, string>> {
    const decoded = await this.decode(vin);
    const filter: Record<string, string> = {};

    if (decoded.make) filter['Make'] = decoded.make;
    if (decoded.model) filter['Model'] = decoded.model;
    if (decoded.year) filter['Year'] = decoded.year;
    if (decoded.trim) filter['Trim'] = decoded.trim;

    return filter;
  }

  /* ─── AI Enrichment ─── */

  /**
   * Use OpenRouter AI to fill in missing vehicle data from VIN pattern.
   */
  private async enrichWithAI(decoded: VinDecodeResult): Promise<VinDecodeResult> {
    const nhtsaSummary = [
      decoded.year && `Year: ${decoded.year}`,
      decoded.make && `Make: ${decoded.make}`,
      decoded.model && `Model: ${decoded.model}`,
      decoded.trim && `Trim: ${decoded.trim}`,
      decoded.bodyClass && `Body: ${decoded.bodyClass}`,
      decoded.driveType && `Drive: ${decoded.driveType}`,
      decoded.engineCylinders && `Cylinders: ${decoded.engineCylinders}`,
      decoded.engineDisplacementL && `Displacement: ${decoded.engineDisplacementL}L`,
      decoded.fuelType && `Fuel: ${decoded.fuelType}`,
      decoded.vehicleType && `Type: ${decoded.vehicleType}`,
    ]
      .filter(Boolean)
      .join(', ');

    const systemPrompt = `You are an automotive VIN decoder expert. Given a VIN and any partial NHTSA decode data, return a JSON object with comprehensive vehicle information.

Return ONLY valid JSON with this exact structure:
{
  "make": "string",
  "model": "string",
  "trim": "string",
  "year": "string",
  "bodyClass": "string (e.g. SUV, Sedan, Pickup, Coupe)",
  "driveType": "string (e.g. AWD, FWD, RWD, 4WD)",
  "engineCylinders": "string (e.g. 4, 6, 8)",
  "engineDisplacementL": "string (e.g. 2.0, 3.5)",
  "engineDescription": "string (e.g. 2.0L Turbo I-4)",
  "fuelType": "string (e.g. Gasoline, Diesel, Hybrid)",
  "transmission": "string (e.g. 8-speed Automatic, CVT, 6-speed Manual)",
  "mpg": "string (e.g. 24 city / 30 highway)",
  "horsepower": "string (e.g. 235 hp)",
  "torque": "string (e.g. 258 lb-ft)",
  "seatingCapacity": "string",
  "wheelbase": "string (e.g. 105.1 in)",
  "curbWeight": "string (e.g. 3,940 lbs)",
  "plantCountry": "string",
  "vehicleType": "string",
  "commonParts": ["string array of 5-10 common aftermarket parts for this vehicle"],
  "knownFitment": ["string array of known compatible vehicle years/models sharing parts"],
  "description": "brief 1-2 sentence description of this vehicle"
}

Be precise. Use real specifications. If unsure about a field, use an empty string.`;

    const userPrompt = `Decode this VIN comprehensively:
VIN: ${decoded.vin}
Partial NHTSA data: ${nhtsaSummary || 'No data available'}

Provide the full vehicle specification.`;

    const response = await this.openai.chat({
      systemPrompt,
      userPrompt,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1500,
      costLane: 'vin-enrichment',
    });

    let aiData: any;
    try {
      aiData = typeof response.content === 'string'
        ? JSON.parse(response.content)
        : response.content;
    } catch {
      this.logger.warn('Failed to parse AI VIN enrichment response');
      return decoded;
    }

    if (!aiData || typeof aiData !== 'object') {
      return decoded;
    }

    // Merge AI data into decoded result, preferring AI values for empty fields
    const enriched: VinDecodeResult = {
      ...decoded,
      year: decoded.year || aiData.year || '',
      make: decoded.make || aiData.make || '',
      model: decoded.model || aiData.model || '',
      trim: decoded.trim || aiData.trim || '',
      bodyClass: decoded.bodyClass || aiData.bodyClass || '',
      driveType: decoded.driveType || aiData.driveType || '',
      engineCylinders: decoded.engineCylinders || aiData.engineCylinders || '',
      engineDisplacementL: decoded.engineDisplacementL || aiData.engineDisplacementL || '',
      fuelType: decoded.fuelType || aiData.fuelType || '',
      plantCountry: decoded.plantCountry || aiData.plantCountry || '',
      vehicleType: decoded.vehicleType || aiData.vehicleType || '',
      aiEnriched: true,
      aiData: {
        engineDescription: aiData.engineDescription || '',
        transmission: aiData.transmission || '',
        mpg: aiData.mpg || '',
        horsepower: aiData.horsepower || '',
        torque: aiData.torque || '',
        seatingCapacity: aiData.seatingCapacity || '',
        wheelbase: aiData.wheelbase || '',
        curbWeight: aiData.curbWeight || '',
        commonParts: aiData.commonParts || [],
        knownFitment: aiData.knownFitment || [],
        description: aiData.description || '',
      },
    };

    this.logger.log(
      `AI enriched VIN ${decoded.vin}: ${enriched.make} ${enriched.model} ${enriched.trim} ${enriched.year}`,
    );

    return enriched;
  }

  /* ─── Private helpers ─── */

  private buildRawMap(
    results: Array<{ Variable: string; Value: string | null }>,
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const r of results) {
      if (r.Value && r.Value.trim() !== '') {
        map[r.Variable] = r.Value.trim();
      }
    }
    return map;
  }

  private normalize(
    vin: string,
    raw: Record<string, string>,
  ): VinDecodeResult {
    return {
      vin,
      year: raw['Model Year'] ?? '',
      make: raw['Make'] ?? '',
      model: raw['Model'] ?? '',
      trim: raw['Trim'] ?? '',
      bodyClass: raw['Body Class'] ?? '',
      driveType: raw['Drive Type'] ?? '',
      engineCylinders: raw['Engine Number of Cylinders'] ?? '',
      engineDisplacementL: raw['Displacement (L)'] ?? '',
      fuelType: raw['Fuel Type - Primary'] ?? '',
      plantCountry: raw['Plant Country'] ?? '',
      vehicleType: raw['Vehicle Type'] ?? '',
      raw,
    };
  }

  /** Cache entries expire after 30 days */
  private isExpired(fetchedAt: Date): boolean {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - fetchedAt.getTime() > thirtyDays;
  }
}

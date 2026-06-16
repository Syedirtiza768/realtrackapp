import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinCache } from './entities/vin-cache.entity.js';
import { OpenAiService } from '../common/openai/openai.service.js';
import { BrandVinDecoderRegistry } from './vin-decoders/brand-decoder.registry.js';
import { getBrandContext } from './vin-decoders/brand-knowledge.js';
import { sanitizeJson } from '../common/openai/json-sanitizer.js';

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

export interface RecallInfo {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
}

/**
 * VinDecodeService — Decode VINs using NHTSA vPIC + Brand Decoders + AI enrichment.
 *
 * Three-tier decode strategy:
 *   Tier 1: NHTSA vPIC API (free, authoritative, often incomplete)
 *   Tier 2: Brand-specific decoder (deterministic, no AI cost, handles positions 4-8)
 *   Tier 3: AI enrichment (only for remaining gaps, brand-aware prompts)
 *
 * Results are cached in a `vin_cache` table (30-day TTL).
 */
@Injectable()
export class VinDecodeService {
  private readonly logger = new Logger(VinDecodeService.name);

  /** NHTSA vPIC base URL */
  private static readonly NHTSA_BASE =
    'https://vpic.nhtsa.dot.gov/api/vehicles';

  /** NHTSA recall API base URL */
  private static readonly NHTSA_RECALL_BASE =
    'https://api.nhtsa.gov/recalls';

  /** VIN regex: exactly 17 alphanumeric characters (excluding I, O, Q) */
  private static readonly VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

  constructor(
    @InjectRepository(VinCache)
    private readonly cacheRepo: Repository<VinCache>,
    private readonly openai: OpenAiService,
    private readonly brandRegistry: BrandVinDecoderRegistry,
  ) {}

  /**
   * Decode a VIN to structured vehicle data.
   * Three-tier resolution: NHTSA → Brand Decoder → AI Enrichment.
   * Returns cached result if available.
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

    // ── Tier 1: NHTSA vPIC API ──
    this.logger.log(`[Tier 1] Decoding VIN via NHTSA: ${normalizedVin}`);
    const url = `${VinDecodeService.NHTSA_BASE}/DecodeVin/${normalizedVin}?format=json`;

    const { data } = await axios.get(url, { timeout: 15_000 });
    const results: Array<{ Variable: string; Value: string | null }> =
      data?.Results ?? [];

    const raw = this.buildRawMap(results);
    let decoded = this.normalize(normalizedVin, raw);

    // ── Tier 2: Brand-specific VIN decoder ──
    const brandDecoder = this.brandRegistry.getDecoder(
      decoded.make || normalizedVin,
    );

    if (brandDecoder) {
      this.logger.log(
        `[Tier 2] Applying ${brandDecoder.brand} VIN decoder for ${normalizedVin}`,
      );
      try {
        const vds = brandDecoder.decodeVds(normalizedVin);
        const plantCode = normalizedVin.charAt(10);
        const plant = brandDecoder.decodePlant(plantCode);

        // Merge brand decoder results — fill gaps only
        decoded = {
          ...decoded,
          model: decoded.model || vds.model || '',
          trim: decoded.trim || vds.trim || '',
          bodyClass: decoded.bodyClass || vds.bodyStyle || '',
          driveType: decoded.driveType || vds.drivetrain || '',
          engineCylinders: decoded.engineCylinders || '',
          engineDisplacementL: decoded.engineDisplacementL || '',
        };

        // Store brand-specific data for AI enrichment context
        if (vds.engineCode) {
          (decoded as any)._brandEngineCode = vds.engineCode;
        }
        if (plant) {
          decoded.plantCountry = decoded.plantCountry || plant.country;
          (decoded as any)._plantName = plant.plantName;
          (decoded as any)._plantCity = plant.city;
        }
      } catch (err: any) {
        this.logger.warn(
          `Brand decoder failed for ${normalizedVin}: ${err.message}`,
        );
      }
    }

    // ── Tier 3: AI enrichment (only for remaining gaps) ──
    const isIncomplete =
      !decoded.model || !decoded.trim || !decoded.engineCylinders;
    if (isIncomplete) {
      try {
        this.logger.log(
          `[Tier 3] NHTSA+Brand decode incomplete for ${normalizedVin}, enriching via AI...`,
        );
        decoded = await this.enrichWithAI(decoded, brandDecoder?.brand);
      } catch (err: any) {
        this.logger.warn(
          `AI enrichment failed for ${normalizedVin}: ${err.message}`,
        );
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

  /**
   * Fetch NHTSA recalls for a specific vehicle.
   */
  async getRecalls(make: string, model: string, year: string): Promise<RecallInfo[]> {
    try {
      const url = `${VinDecodeService.NHTSA_RECALL_BASE}/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
      const { data } = await axios.get(url, { timeout: 10_000 });
      return (data?.results || []).map((r: any) => ({
        campaignNumber: r.NHTSACampaignNumber || '',
        component: r.Component || '',
        summary: r.Summary || '',
        consequence: r.Consequence || '',
        remedy: r.Remedy || '',
      }));
    } catch (err: any) {
      this.logger.warn(`Failed to fetch recalls for ${year} ${make} ${model}: ${err.message}`);
      return [];
    }
  }

  /* ─── AI Enrichment (Brand-Aware) ─── */

  /**
   * Use OpenRouter AI to fill in missing vehicle data from VIN pattern.
   * Now brand-aware: injects brand-specific VIN knowledge into the prompt.
   */
  private async enrichWithAI(decoded: VinDecodeResult, brand?: string): Promise<VinDecodeResult> {
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
      (decoded as any)._brandEngineCode && `Brand Engine Code: ${(decoded as any)._brandEngineCode}`,
      (decoded as any)._plantName && `Plant: ${(decoded as any)._plantName}`,
    ]
      .filter(Boolean)
      .join(', ');

    // Build brand-specific context for the prompt
    const brandContext = brand ? getBrandContext(brand) : '';

    const systemPrompt = `You are an automotive VIN decoder expert. Given a VIN and any partial NHTSA decode data, return a JSON object with comprehensive vehicle information.
${brand ? `\nBRAND-SPECIFIC KNOWLEDGE:\n${brandContext}\n` : ''}
Return ONLY valid JSON with this exact structure (no trailing commas):
{
  "make": "string",
  "model": "string",
  "trim": "string",
  "year": "string",
  "bodyClass": "string (e.g. SUV, Sedan, Pickup, Coupe, Hatchback, Crossover)",
  "driveType": "string (e.g. AWD, FWD, RWD, 4WD)",
  "engineCylinders": "string (e.g. 4, 6, 8)",
  "engineDisplacementL": "string (e.g. 2.0, 3.5)",
  "engineDescription": "string (e.g. 2.0L Turbo I-4 DOHC 16V Valvematic)",
  "engineCode": "string (e.g. 3ZR-FAE, N20, B48)",
  "fuelType": "string (e.g. Gasoline, Diesel, Hybrid, Electric)",
  "transmission": "string (e.g. 8-speed Automatic, CVT, 6-speed Manual)",
  "mpg": "string (e.g. 24 city / 30 highway)",
  "horsepower": "string (e.g. 235 hp)",
  "torque": "string (e.g. 258 lb-ft)",
  "seatingCapacity": "string",
  "wheelbase": "string (e.g. 105.1 in)",
  "curbWeight": "string (e.g. 3,940 lbs)",
  "plantCountry": "string",
  "vehicleType": "string",
  "commonParts": ["5-10 common aftermarket parts for this exact vehicle"],
  "knownFitment": ["compatible vehicles sharing parts (include year ranges)"],
  "description": "brief 1-2 sentence description"
}

Rules:
- Be precise. Use real specifications.
- If unsure about a field, use empty string.
- Do NOT hallucinate. If you cannot determine the model from this VIN, say so.
- commonParts should list actual part types (e.g. "Front Brake Pads", "Oil Filter"), not part numbers.
- knownFitment should list vehicles that share the same OEM parts (e.g. "2019-2022 Toyota Corolla — shares brake pads").`;

    const userPrompt = `Decode this VIN comprehensively:
VIN: ${decoded.vin}
Partial NHTSA data: ${nhtsaSummary || 'No data available'}
${(decoded as any)._brandEngineCode ? `Brand decoder suggests engine code: ${(decoded as any)._brandEngineCode}` : ''}

Provide the full vehicle specification. Return ONLY valid JSON — no trailing commas, no markdown fences.`;

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
        ? sanitizeJson(response.content)
        : response.content;
    } catch {
      this.logger.warn('Failed to parse AI VIN enrichment response');
      return decoded;
    }

    if (!aiData || typeof aiData !== 'object') {
      return decoded;
    }

    // Merge AI data into decoded result, preferring existing non-empty values
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

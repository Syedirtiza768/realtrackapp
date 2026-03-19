import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VinCache } from './entities/vin-cache.entity.js';

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
}

/**
 * VinDecodeService — Decode VINs using the free NHTSA vPIC API.
 *
 * Results are cached in a `vin_cache` table to avoid repeated API calls.
 * No API key required.
 *
 * @see https://vpic.nhtsa.dot.gov/api/
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
  ) {}

  /**
   * Decode a VIN to structured vehicle data.
   * Returns cached result if available, otherwise calls NHTSA.
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
    const decoded = this.normalize(normalizedVin, raw);

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

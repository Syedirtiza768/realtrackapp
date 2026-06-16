import { Injectable } from '@nestjs/common';
import type { BrandVinDecoder, DecodedVds, DecodedPlant, PlatformDefinition } from './brand-decoder.types.js';
import { ToyotaVinDecoder } from './brands/toyota.decoder.js';

/**
 * BrandVinDecoderRegistry
 *
 * Maintains a registry of brand-specific VIN decoders. Given a VIN,
 * finds the appropriate decoder by WMI (first 3 characters) and
 * delegates VDS/plant decoding to it.
 *
 * Usage:
 *   const registry = new BrandVinDecoderRegistry();
 *   const decoder = registry.getDecoder('JTNB29HK8K3019731');
 *   const vds = decoder?.decodeVds(vin);
 */
@Injectable()
export class BrandVinDecoderRegistry {
  private readonly decoders: BrandVinDecoder[] = [];
  private readonly wmiIndex: Map<string, BrandVinDecoder> = new Map();

  constructor() {
    // Register all brand decoders
    this.register(new ToyotaVinDecoder());
    // TODO: Register additional brand decoders as they are implemented:
    // this.register(new BmwVinDecoder());
    // this.register(new MercedesVinDecoder());
    // this.register(new FordVinDecoder());
    // this.register(new GmVinDecoder());
    // this.register(new VwAudiVinDecoder());
    // this.register(new HondaVinDecoder());
    // this.register(new NissanVinDecoder());
    // this.register(new HyundaiKiaVinDecoder());
  }

  /**
   * Register a brand decoder. Indexes all its WMI codes for fast lookup.
   */
  register(decoder: BrandVinDecoder): void {
    this.decoders.push(decoder);
    for (const wmi of decoder.wmi) {
      this.wmiIndex.set(wmi.toUpperCase(), decoder);
    }
  }

  /**
   * Find the appropriate decoder for a VIN based on its WMI (positions 1-3).
   * Returns null if no brand decoder is registered for this WMI.
   */
  getDecoder(vinOrMake: string): BrandVinDecoder | null {
    // Try WMI lookup first (first 3 chars of VIN)
    const wmi = vinOrMake.substring(0, 3).toUpperCase();
    const byWmi = this.wmiIndex.get(wmi);
    if (byWmi) return byWmi;

    // Try partial WMI (first 2 chars — covers some manufacturer variations)
    const partialWmi = vinOrMake.substring(0, 2).toUpperCase();
    for (const [key, decoder] of this.wmiIndex) {
      if (key.startsWith(partialWmi)) return decoder;
    }

    // Try by brand name (for cases where we have make from NHTSA but not WMI)
    const normalizedMake = vinOrMake.trim().toLowerCase();
    for (const decoder of this.decoders) {
      if (decoder.brand.toLowerCase() === normalizedMake) return decoder;
      // Handle brand aliases
      if (normalizedMake === 'lexus' && decoder.brand === 'Toyota') return decoder;
      if (normalizedMake === 'scion' && decoder.brand === 'Toyota') return decoder;
      if (normalizedMake === 'lincoln' && decoder.brand === 'Ford') return decoder;
      if (normalizedMake === 'acura' && decoder.brand === 'Honda') return decoder;
      if (normalizedMake === 'infiniti' && decoder.brand === 'Nissan') return decoder;
      if (normalizedMake === 'genesis' && decoder.brand === 'Hyundai') return decoder;
    }

    return null;
  }

  /**
   * Get all registered brands.
   */
  getRegisteredBrands(): string[] {
    return [...new Set(this.decoders.map(d => d.brand))];
  }

  /**
   * Get all known platforms across all brands.
   */
  getAllPlatforms(): PlatformDefinition[] {
    return this.decoders.flatMap(d => d.knownPlatforms);
  }

  /**
   * Find platform sharing info for a specific vehicle.
   */
  findPlatformForVehicle(
    make: string,
    model: string,
    year: number,
  ): PlatformDefinition | null {
    for (const platform of this.getAllPlatforms()) {
      for (const vehicle of platform.vehicles) {
        if (
          vehicle.make.toLowerCase() === make.toLowerCase() &&
          vehicle.model.toLowerCase() === model.toLowerCase()
        ) {
          // Check if year is in range
          const [startStr, endStr] = vehicle.years.split('-');
          const startYear = parseInt(startStr, 10);
          const endYear = endStr === 'present' ? 2099 : parseInt(endStr, 10);
          if (year >= startYear && year <= endYear) {
            return platform;
          }
        }
      }
    }
    return null;
  }
}

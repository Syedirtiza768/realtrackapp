/**
 * Brand VIN Decoder Registry
 *
 * Each brand decoder knows how to interpret positions 4-8 of the VIN,
 * which are manufacturer-specific. NHTSA often returns null for these
 * because each OEM encodes differently.
 */

export interface DecodedVds {
  model?: string;
  trim?: string;
  engine?: string;
  engineCode?: string;
  bodyStyle?: string;
  drivetrain?: string;
  transmission?: string;
  series?: string;
}

export interface DecodedPlant {
  plantName: string;
  city: string;
  state?: string;
  country: string;
}

export interface PlatformDefinition {
  platformCode: string;
  vehicles: Array<{
    make: string;
    model: string;
    years: string;
    engines: string[];
  }>;
  shareableComponents: string[];
  nonShareableComponents: string[];
}

export interface BrandVinDecoder {
  brand: string;
  /** World Manufacturer Identifiers — first 3 chars of VIN */
  wmi: string[];
  /** Decode positions 4-8 (Vehicle Descriptor Section) */
  decodeVds(vin: string): DecodedVds;
  /** Decode position 11 (plant code) */
  decodePlant(code: string): DecodedPlant | null;
  /** Known platforms for this brand */
  knownPlatforms: PlatformDefinition[];
}

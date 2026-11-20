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
    wmi: string[];
    decodeVds(vin: string): DecodedVds;
    decodePlant(code: string): DecodedPlant | null;
    knownPlatforms: PlatformDefinition[];
}

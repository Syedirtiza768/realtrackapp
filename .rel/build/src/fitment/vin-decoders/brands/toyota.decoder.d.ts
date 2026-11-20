import type { BrandVinDecoder, DecodedVds, DecodedPlant, PlatformDefinition } from '../brand-decoder.types.js';
export declare class ToyotaVinDecoder implements BrandVinDecoder {
    readonly brand = "Toyota";
    readonly wmi: string[];
    decodeVds(vin: string): DecodedVds;
    decodePlant(code: string): DecodedPlant | null;
    readonly knownPlatforms: PlatformDefinition[];
    private decodeModel;
    private decodeBodyType;
    private decodeEngine;
    private decodeEngineCode;
    private decodeTrim;
}

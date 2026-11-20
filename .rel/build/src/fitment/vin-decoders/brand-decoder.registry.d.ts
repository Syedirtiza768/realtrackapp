import type { BrandVinDecoder, PlatformDefinition } from './brand-decoder.types.js';
export declare class BrandVinDecoderRegistry {
    private readonly decoders;
    private readonly wmiIndex;
    constructor();
    register(decoder: BrandVinDecoder): void;
    getDecoder(vinOrMake: string): BrandVinDecoder | null;
    getRegisteredBrands(): string[];
    getAllPlatforms(): PlatformDefinition[];
    findPlatformForVehicle(make: string, model: string, year: number): PlatformDefinition | null;
}

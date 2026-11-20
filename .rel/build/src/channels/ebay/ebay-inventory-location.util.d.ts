import type { ConfigService } from '@nestjs/config';
import type { Store } from '../entities/store.entity.js';
import type { EbayLocation } from './ebay-api.types.js';
export declare const DEFAULT_MERCHANT_LOCATION_KEY = "AE_Dubai";
export interface InventoryLocationAddress {
    addressLine1?: string;
    city: string;
    stateOrProvince?: string;
    postalCode?: string;
    country: string;
}
export interface InventoryLocationCandidate {
    merchantLocationKey: string;
    name?: string;
    location?: {
        address?: {
            city?: string;
            country?: string;
            postalCode?: string;
        };
    };
}
export declare function isLegacyDefaultMerchantLocationKey(value?: string | null): boolean;
export declare function isUaeInventoryLocation(location: InventoryLocationCandidate): boolean;
export declare function resolveInventoryLocationAddress(config: ConfigService, store?: Pick<Store, 'storeName' | 'config'> | null): InventoryLocationAddress;
export declare function resolvePreferredMerchantLocationKey(config: ConfigService, store?: Pick<Store, 'locationKey' | 'config'> | null, explicit?: string | null): string;
export declare function pickPreferredInventoryLocationKey(locations: InventoryLocationCandidate[], keyHint?: string | null): string | undefined;
export declare function buildDefaultInventoryLocationPayload(config: ConfigService, store?: Pick<Store, 'storeName' | 'config'> | null): Omit<EbayLocation, 'merchantLocationKey'>;

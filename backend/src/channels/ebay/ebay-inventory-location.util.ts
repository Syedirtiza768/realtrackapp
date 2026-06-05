import type { ConfigService } from '@nestjs/config';
import type { Store } from '../entities/store.entity.js';
import type { EbayLocation } from './ebay-api.types.js';

export const DEFAULT_MERCHANT_LOCATION_KEY = 'default';

export interface InventoryLocationAddress {
  addressLine1: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

/** Resolve ship-from address from store config, then env defaults (US). */
export function resolveInventoryLocationAddress(
  config: ConfigService,
  store?: Pick<Store, 'storeName' | 'config'> | null,
): InventoryLocationAddress {
  const storeConfig = (store?.config ?? {}) as Record<string, unknown>;
  const shipFrom =
    storeConfig.shipFromAddress && typeof storeConfig.shipFromAddress === 'object'
      ? (storeConfig.shipFromAddress as Record<string, unknown>)
      : null;

  const pick = (shipKey: string, envKey: string, fallback: string): string => {
    const fromShip = shipFrom?.[shipKey];
    if (typeof fromShip === 'string' && fromShip.trim()) return fromShip.trim();
    const fromEnv = config.get<string>(envKey, '').trim();
    if (fromEnv) return fromEnv;
    return fallback;
  };

  return {
    addressLine1: pick(
      'addressLine1',
      'EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1',
      'Primary Warehouse',
    ),
    city: pick('city', 'EBAY_DEFAULT_INVENTORY_CITY', 'Houston'),
    stateOrProvince: pick(
      'stateOrProvince',
      'EBAY_DEFAULT_INVENTORY_STATE',
      'TX',
    ),
    postalCode: pick('postalCode', 'EBAY_DEFAULT_INVENTORY_POSTAL_CODE', '77001'),
    country: pick('country', 'EBAY_DEFAULT_INVENTORY_COUNTRY', 'US'),
  };
}

export function resolvePreferredMerchantLocationKey(
  config: ConfigService,
  store?: Pick<Store, 'locationKey' | 'config'> | null,
  explicit?: string | null,
): string {
  if (explicit?.trim()) return explicit.trim();
  if (store?.locationKey?.trim()) return store.locationKey.trim();
  const storeConfig = (store?.config ?? {}) as Record<string, unknown>;
  if (typeof storeConfig.locationKey === 'string' && storeConfig.locationKey.trim()) {
    return storeConfig.locationKey.trim();
  }
  return config.get<string>(
    'EBAY_DEFAULT_MERCHANT_LOCATION_KEY',
    DEFAULT_MERCHANT_LOCATION_KEY,
  ).trim() || DEFAULT_MERCHANT_LOCATION_KEY;
}

/** Payload for POST /sell/inventory/v1/location/{merchantLocationKey} */
export function buildDefaultInventoryLocationPayload(
  config: ConfigService,
  store?: Pick<Store, 'storeName' | 'config'> | null,
): Omit<EbayLocation, 'merchantLocationKey'> {
  const address = resolveInventoryLocationAddress(config, store);
  return {
    location: { address },
    locationTypes: ['WAREHOUSE'],
    name: store?.storeName?.trim() || 'Primary Warehouse',
    merchantLocationStatus: 'ENABLED',
  };
}

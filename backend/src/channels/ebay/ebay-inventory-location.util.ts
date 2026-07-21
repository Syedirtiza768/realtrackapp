import type { ConfigService } from '@nestjs/config';
import type { Store } from '../entities/store.entity.js';
import type { EbayLocation } from './ebay-api.types.js';

/** Preferred key for Dubai-based warehouses (matches live eBay inventory locations). */
export const DEFAULT_MERCHANT_LOCATION_KEY = 'AE_Dubai';

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

/** Resolve ship-from address from store config, then env defaults (Dubai / AE). */
export function resolveInventoryLocationAddress(
  config: ConfigService,
  store?: Pick<Store, 'storeName' | 'config'> | null,
): InventoryLocationAddress {
  const storeConfig = store?.config ?? {};
  const shipFrom =
    storeConfig.shipFromAddress &&
    typeof storeConfig.shipFromAddress === 'object'
      ? (storeConfig.shipFromAddress as Record<string, unknown>)
      : null;

  const pick = (shipKey: string, envKey: string, fallback: string): string => {
    const fromShip = shipFrom?.[shipKey];
    if (typeof fromShip === 'string' && fromShip.trim()) return fromShip.trim();
    const fromEnv = config.get<string>(envKey, '').trim();
    if (fromEnv) return fromEnv;
    return fallback;
  };

  const address: InventoryLocationAddress = {
    city: pick('city', 'EBAY_DEFAULT_INVENTORY_CITY', 'Dubai'),
    country: pick('country', 'EBAY_DEFAULT_INVENTORY_COUNTRY', 'AE'),
  };

  const addressLine1 = pick(
    'addressLine1',
    'EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1',
    'Dubai Warehouse',
  );
  if (addressLine1) address.addressLine1 = addressLine1;

  // Never emit US state/ZIP when country is AE (or generally for Dubai defaults).
  // Empty env/store values stay omitted so eBay does not keep Houston leftovers.
  const countryUpper = address.country.toUpperCase();
  if (countryUpper === 'AE') {
    delete address.stateOrProvince;
    delete address.postalCode;
  } else {
    const stateOrProvince = pick(
      'stateOrProvince',
      'EBAY_DEFAULT_INVENTORY_STATE',
      '',
    );
    if (stateOrProvince) address.stateOrProvince = stateOrProvince;

    const postalCode = pick(
      'postalCode',
      'EBAY_DEFAULT_INVENTORY_POSTAL_CODE',
      '',
    );
    if (postalCode) address.postalCode = postalCode;
  }

  return address;
}

export function resolvePreferredMerchantLocationKey(
  config: ConfigService,
  store?: Pick<Store, 'locationKey' | 'config'> | null,
  explicit?: string | null,
): string {
  if (explicit?.trim()) return explicit.trim();
  if (store?.locationKey?.trim()) return store.locationKey.trim();
  const storeConfig = store?.config ?? {};
  if (
    typeof storeConfig.locationKey === 'string' &&
    storeConfig.locationKey.trim()
  ) {
    return storeConfig.locationKey.trim();
  }
  return (
    config
      .get<string>(
        'EBAY_DEFAULT_MERCHANT_LOCATION_KEY',
        DEFAULT_MERCHANT_LOCATION_KEY,
      )
      .trim() || DEFAULT_MERCHANT_LOCATION_KEY
  );
}

/**
 * Pick the best inventory location from an eBay list.
 * Prefers an explicit key hint, then AE/Dubai warehouses, and deprioritizes
 * legacy Houston (US_77001) keys that were auto-provisioned incorrectly.
 */
export function pickPreferredInventoryLocationKey(
  locations: InventoryLocationCandidate[],
  keyHint?: string | null,
): string | undefined {
  if (!locations.length) return undefined;

  const hint = keyHint?.trim();
  if (hint) {
    const exact = locations.find((l) => l.merchantLocationKey === hint);
    if (exact) return exact.merchantLocationKey;
  }

  const score = (loc: InventoryLocationCandidate): number => {
    const key = loc.merchantLocationKey ?? '';
    const country = (loc.location?.address?.country ?? '').toUpperCase();
    const city = (loc.location?.address?.city ?? '').toLowerCase();
    const postal = loc.location?.address?.postalCode ?? '';
    let s = 0;
    if (key === DEFAULT_MERCHANT_LOCATION_KEY || key === 'AE_Dubai') s += 100;
    if (key.startsWith('AE_')) s += 50;
    if (country === 'AE') s += 40;
    if (city === 'dubai') s += 20;
    if (key === 'default') s += 5;
    // Legacy mistaken Houston provision — keep available but never prefer.
    if (key === 'US_77001' || postal === '77001' || city === 'houston') {
      s -= 100;
    }
    if (country === 'US' && postal === '77001') s -= 50;
    return s;
  };

  const ranked = [...locations].sort((a, b) => score(b) - score(a));
  return ranked[0]?.merchantLocationKey;
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
    name: store?.storeName?.trim()
      ? `${store.storeName.trim()} - Dubai`
      : 'Dubai Warehouse',
    merchantLocationStatus: 'ENABLED',
  };
}

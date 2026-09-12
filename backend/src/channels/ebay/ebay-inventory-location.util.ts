import type { ConfigService } from '@nestjs/config';
import type { Store } from '../entities/store.entity.js';
import type { EbayLocation } from './ebay-api.types.js';

/** Preferred key for Dubai-based warehouses (matches live eBay inventory locations). */
export const DEFAULT_MERCHANT_LOCATION_KEY = 'AE_Dubai';

/**
 * Values written by older integrations to mean "use the account default".
 * They are not safe eBay merchant-location keys: in production, eBay can
 * resolve them to the seller's old US location.
 */
const LEGACY_DEFAULT_LOCATION_KEYS = new Set([
  'default',
  'usa',
  'us',
  'us_77001',
  'houston',
]);

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

export function isLegacyDefaultMerchantLocationKey(
  value?: string | null,
): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && LEGACY_DEFAULT_LOCATION_KEYS.has(normalized));
}

/** Only UAE locations are valid for the Dubai default ship-from policy. */
export function isUaeInventoryLocation(
  location: InventoryLocationCandidate,
): boolean {
  const key = location.merchantLocationKey?.trim() ?? '';
  const country = (location.location?.address?.country ?? '')
    .trim()
    .toUpperCase();
  if (country) {
    return (
      country === 'AE' ||
      country === 'ARE' ||
      country === 'UNITED ARAB EMIRATES'
    );
  }
  // Some older eBay responses omit country on the list endpoint. Keep the
  // explicit UAE key safe in that case, but never infer UAE from a US key.
  return (
    key === DEFAULT_MERCHANT_LOCATION_KEY || key.toUpperCase().startsWith('AE_')
  );
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
  const normalizeKey = (value?: string | null): string | undefined => {
    const key = value?.trim();
    // "default" is a legacy placeholder, not the Dubai merchant location.
    // Passing it through makes eBay evaluate the wrong country/location.
    return key && !isLegacyDefaultMerchantLocationKey(key) ? key : undefined;
  };

  const explicitKey = normalizeKey(explicit);
  if (explicitKey) return explicitKey;

  const configuredDefault = normalizeKey(
    config.get<string>('EBAY_DEFAULT_MERCHANT_LOCATION_KEY', ''),
  );
  const fallbackKey = configuredDefault || DEFAULT_MERCHANT_LOCATION_KEY;
  // An explicit legacy value must not fall through to an unrelated store key.
  // That would preserve the very US/default mapping this resolver is meant to
  // repair.
  if (explicit?.trim() && isLegacyDefaultMerchantLocationKey(explicit)) {
    return DEFAULT_MERCHANT_LOCATION_KEY;
  }

  const storeKey = normalizeKey(store?.locationKey);
  if (storeKey) return storeKey;

  const storeConfig = store?.config ?? {};
  const configKey = normalizeKey(
    typeof storeConfig.locationKey === 'string'
      ? storeConfig.locationKey
      : undefined,
  );
  if (configKey) return configKey;

  return fallbackKey;
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
  const uaeLocations = locations.filter(isUaeInventoryLocation);
  if (!uaeLocations.length) return undefined;

  const rawHint = keyHint?.trim();
  const hint =
    rawHint && !isLegacyDefaultMerchantLocationKey(rawHint)
      ? rawHint
      : undefined;
  if (hint) {
    const exact = uaeLocations.find((l) => l.merchantLocationKey === hint);
    if (exact) return exact.merchantLocationKey;
  }

  const score = (loc: InventoryLocationCandidate): number => {
    const key = loc.merchantLocationKey ?? '';
    const country = (loc.location?.address?.country ?? '').toUpperCase();
    const city = (loc.location?.address?.city ?? '').toLowerCase();
    let s = 0;
    if (key === DEFAULT_MERCHANT_LOCATION_KEY) s += 100;
    if (key.startsWith('AE_')) s += 50;
    if (country === 'AE') s += 40;
    if (city === 'dubai') s += 20;
    if (country === 'AE' && city === 'dubai') s += 20;
    return s;
  };

  const ranked = [...uaeLocations].sort((a, b) => score(b) - score(a));
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

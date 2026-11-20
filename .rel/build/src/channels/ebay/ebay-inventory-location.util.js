"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MERCHANT_LOCATION_KEY = void 0;
exports.isLegacyDefaultMerchantLocationKey = isLegacyDefaultMerchantLocationKey;
exports.isUaeInventoryLocation = isUaeInventoryLocation;
exports.resolveInventoryLocationAddress = resolveInventoryLocationAddress;
exports.resolvePreferredMerchantLocationKey = resolvePreferredMerchantLocationKey;
exports.pickPreferredInventoryLocationKey = pickPreferredInventoryLocationKey;
exports.buildDefaultInventoryLocationPayload = buildDefaultInventoryLocationPayload;
exports.DEFAULT_MERCHANT_LOCATION_KEY = 'AE_Dubai';
const LEGACY_DEFAULT_LOCATION_KEYS = new Set([
    'default',
    'usa',
    'us',
    'us_77001',
    'houston',
]);
function isLegacyDefaultMerchantLocationKey(value) {
    const normalized = value?.trim().toLowerCase();
    return Boolean(normalized && LEGACY_DEFAULT_LOCATION_KEYS.has(normalized));
}
function isUaeInventoryLocation(location) {
    const key = location.merchantLocationKey?.trim() ?? '';
    const country = (location.location?.address?.country ?? '')
        .trim()
        .toUpperCase();
    if (country) {
        return (country === 'AE' ||
            country === 'ARE' ||
            country === 'UNITED ARAB EMIRATES');
    }
    return (key === exports.DEFAULT_MERCHANT_LOCATION_KEY || key.toUpperCase().startsWith('AE_'));
}
function resolveInventoryLocationAddress(config, store) {
    const storeConfig = store?.config ?? {};
    const shipFrom = storeConfig.shipFromAddress &&
        typeof storeConfig.shipFromAddress === 'object'
        ? storeConfig.shipFromAddress
        : null;
    const pick = (shipKey, envKey, fallback) => {
        const fromShip = shipFrom?.[shipKey];
        if (typeof fromShip === 'string' && fromShip.trim())
            return fromShip.trim();
        const fromEnv = config.get(envKey, '').trim();
        if (fromEnv)
            return fromEnv;
        return fallback;
    };
    const address = {
        city: pick('city', 'EBAY_DEFAULT_INVENTORY_CITY', 'Dubai'),
        country: pick('country', 'EBAY_DEFAULT_INVENTORY_COUNTRY', 'AE'),
    };
    const addressLine1 = pick('addressLine1', 'EBAY_DEFAULT_INVENTORY_ADDRESS_LINE1', 'Dubai Warehouse');
    if (addressLine1)
        address.addressLine1 = addressLine1;
    const countryUpper = address.country.toUpperCase();
    if (countryUpper === 'AE') {
        delete address.stateOrProvince;
        delete address.postalCode;
    }
    else {
        const stateOrProvince = pick('stateOrProvince', 'EBAY_DEFAULT_INVENTORY_STATE', '');
        if (stateOrProvince)
            address.stateOrProvince = stateOrProvince;
        const postalCode = pick('postalCode', 'EBAY_DEFAULT_INVENTORY_POSTAL_CODE', '');
        if (postalCode)
            address.postalCode = postalCode;
    }
    return address;
}
function resolvePreferredMerchantLocationKey(config, store, explicit) {
    const normalizeKey = (value) => {
        const key = value?.trim();
        return key && !isLegacyDefaultMerchantLocationKey(key) ? key : undefined;
    };
    const explicitKey = normalizeKey(explicit);
    if (explicitKey)
        return explicitKey;
    const configuredDefault = normalizeKey(config.get('EBAY_DEFAULT_MERCHANT_LOCATION_KEY', ''));
    const fallbackKey = configuredDefault || exports.DEFAULT_MERCHANT_LOCATION_KEY;
    if (explicit?.trim() && isLegacyDefaultMerchantLocationKey(explicit)) {
        return exports.DEFAULT_MERCHANT_LOCATION_KEY;
    }
    const storeKey = normalizeKey(store?.locationKey);
    if (storeKey)
        return storeKey;
    const storeConfig = store?.config ?? {};
    const configKey = normalizeKey(typeof storeConfig.locationKey === 'string'
        ? storeConfig.locationKey
        : undefined);
    if (configKey)
        return configKey;
    return fallbackKey;
}
function pickPreferredInventoryLocationKey(locations, keyHint) {
    const uaeLocations = locations.filter(isUaeInventoryLocation);
    if (!uaeLocations.length)
        return undefined;
    const rawHint = keyHint?.trim();
    const hint = rawHint && !isLegacyDefaultMerchantLocationKey(rawHint)
        ? rawHint
        : undefined;
    if (hint) {
        const exact = uaeLocations.find((l) => l.merchantLocationKey === hint);
        if (exact)
            return exact.merchantLocationKey;
    }
    const score = (loc) => {
        const key = loc.merchantLocationKey ?? '';
        const country = (loc.location?.address?.country ?? '').toUpperCase();
        const city = (loc.location?.address?.city ?? '').toLowerCase();
        let s = 0;
        if (key === exports.DEFAULT_MERCHANT_LOCATION_KEY)
            s += 100;
        if (key.startsWith('AE_'))
            s += 50;
        if (country === 'AE')
            s += 40;
        if (city === 'dubai')
            s += 20;
        if (country === 'AE' && city === 'dubai')
            s += 20;
        return s;
    };
    const ranked = [...uaeLocations].sort((a, b) => score(b) - score(a));
    return ranked[0]?.merchantLocationKey;
}
function buildDefaultInventoryLocationPayload(config, store) {
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
//# sourceMappingURL=ebay-inventory-location.util.js.map
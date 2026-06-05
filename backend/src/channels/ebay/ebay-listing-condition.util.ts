import type { EbayConditionEnum } from './ebay-api.types.js';

/** eBay File Exchange / Motors numeric condition IDs → Inventory API enums. */
const NUMERIC_CONDITION_MAP: Record<string, EbayConditionEnum> = {
  '1000': 'NEW',
  '1500': 'NEW_OTHER',
  '1750': 'NEW_WITH_DEFECTS',
  '2000': 'MANUFACTURER_REFURBISHED',
  '2500': 'SELLER_REFURBISHED',
  '3000': 'USED_EXCELLENT',
  '4000': 'USED_VERY_GOOD',
  '5000': 'USED_GOOD',
  '6000': 'USED_ACCEPTABLE',
  '7000': 'FOR_PARTS_OR_NOT_WORKING',
};

const LABEL_CONDITION_MAP: Record<string, EbayConditionEnum> = {
  new: 'NEW',
  'new other': 'NEW_OTHER',
  'new with defects': 'NEW_WITH_DEFECTS',
  'certified refurbished': 'CERTIFIED_REFURBISHED',
  'manufacturer refurbished': 'MANUFACTURER_REFURBISHED',
  'seller refurbished': 'SELLER_REFURBISHED',
  remanufactured: 'MANUFACTURER_REFURBISHED',
  used: 'USED_GOOD',
  'used excellent': 'USED_EXCELLENT',
  'used very good': 'USED_VERY_GOOD',
  'used good': 'USED_GOOD',
  'used acceptable': 'USED_ACCEPTABLE',
  'for parts or not working': 'FOR_PARTS_OR_NOT_WORKING',
  'for parts': 'FOR_PARTS_OR_NOT_WORKING',
};

const VALID_CONDITION_ENUMS = new Set<string>([
  'NEW',
  'LIKE_NEW',
  'NEW_OTHER',
  'NEW_WITH_DEFECTS',
  'MANUFACTURER_REFURBISHED',
  'CERTIFIED_REFURBISHED',
  'EXCELLENT_REFURBISHED',
  'VERY_GOOD_REFURBISHED',
  'GOOD_REFURBISHED',
  'SELLER_REFURBISHED',
  'USED_EXCELLENT',
  'USED_VERY_GOOD',
  'USED_GOOD',
  'USED_ACCEPTABLE',
  'FOR_PARTS_OR_NOT_WORKING',
]);

/**
 * Map legacy import values (e.g. `3000-Used`, `3000`, `Used`) to eBay Inventory API enums.
 */
export function mapToEbayConditionEnum(
  raw: string | null | undefined,
  fallback: EbayConditionEnum = 'USED_GOOD',
): EbayConditionEnum {
  if (!raw?.trim()) return fallback;

  const trimmed = raw.trim();
  const normalizedEnum = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (VALID_CONDITION_ENUMS.has(normalizedEnum)) {
    return normalizedEnum as EbayConditionEnum;
  }

  const numeric = trimmed.replace(/-.*/, '').trim();
  if (NUMERIC_CONDITION_MAP[numeric]) {
    return NUMERIC_CONDITION_MAP[numeric];
  }

  const labelKey = trimmed.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (LABEL_CONDITION_MAP[labelKey]) {
    return LABEL_CONDITION_MAP[labelKey];
  }

  if (labelKey.includes('parts') || labelKey.includes('not working')) {
    return 'FOR_PARTS_OR_NOT_WORKING';
  }
  if (labelKey.includes('refurb')) {
    return 'SELLER_REFURBISHED';
  }
  if (labelKey.includes('new')) {
    return 'NEW';
  }
  if (labelKey.includes('used')) {
    return 'USED_GOOD';
  }

  return fallback;
}

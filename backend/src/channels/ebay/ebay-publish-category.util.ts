export const SAFE_PUBLISH_FALLBACK_CATEGORY_ID = '9886';
export const SAFE_PUBLISH_FALLBACK_CATEGORY_NAME =
  'Other Car & Truck Parts & Accessories';

const GENERIC_ENGINE_CATEGORY_IDS = new Set(['33615', '33626', '1260189']);
const GENERIC_ENGINE_CATEGORY_NAMES = /^(?:engine|engines)(?:\s*&\s*components)?$/i;
const GENERIC_FLUID_CATEGORY_IDS = new Set(['179501']);
const GENERIC_FLUID_CATEGORY_NAMES =
  /^(?:transmission|gear|differential)\s+(?:fluid|fluids|oil|oils)$/i;
const COMPLETE_ENGINE_PATTERN =
  /\b(?:complete|long|short)\s+(?:engine|motor)\b|\b(?:engine|motor)\s+(?:assembly|block)\b/i;
const FLUID_PRODUCT_PATTERN =
  /\b(?:automatic\s+)?transmission\s+(?:fluid|oil)\b(?!\s+filter)|\b(?:gear|differential)\s+oil\b|\b(?:atf|dctf|cvtf)\b/i;

export interface SafePublishCategoryInput {
  categoryId?: string | null;
  categoryName?: string | null;
  listingText?: string | null;
}

export interface SafePublishCategoryResult {
  categoryId: string;
  changed: boolean;
}

/**
 * Prevent generic engine categories from being used for unrelated parts.
 * eBay resolves these stale IDs to the restricted engine category and returns
 * error 25019; the generic Motors leaf is safer than sending a miscategory.
 */
export function resolveSafePublishCategory(
  input: SafePublishCategoryInput,
): SafePublishCategoryResult {
  const categoryId = input.categoryId?.trim() ?? '';
  const categoryName = input.categoryName?.trim() ?? '';
  const listingText = input.listingText?.trim() ?? '';
  const isGenericEngine =
    GENERIC_ENGINE_CATEGORY_IDS.has(categoryId) ||
    GENERIC_ENGINE_CATEGORY_NAMES.test(categoryName);
  const isGenericFluid =
    GENERIC_FLUID_CATEGORY_IDS.has(categoryId) ||
    GENERIC_FLUID_CATEGORY_NAMES.test(categoryName);

  if (
    (!isGenericEngine || COMPLETE_ENGINE_PATTERN.test(listingText)) &&
    (!isGenericFluid || FLUID_PRODUCT_PATTERN.test(listingText))
  ) {
    return { categoryId, changed: false };
  }

  return {
    categoryId: SAFE_PUBLISH_FALLBACK_CATEGORY_ID,
    changed: categoryId !== SAFE_PUBLISH_FALLBACK_CATEGORY_ID,
  };
}

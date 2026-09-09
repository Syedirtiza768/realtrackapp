import type { EbayAspect } from '../channels/ebay/ebay-api.types.js';

export const PRODUCT_VERTICALS = [
  'automotive',
  'business_industrial',
  'fashion',
] as const;

export type ProductVertical = (typeof PRODUCT_VERTICALS)[number];

export const DEFAULT_PRODUCT_VERTICAL: ProductVertical = 'automotive';

export function isProductVertical(value: unknown): value is ProductVertical {
  return (
    typeof value === 'string' &&
    (PRODUCT_VERTICALS as readonly string[]).includes(value)
  );
}

export function normalizeProductVertical(
  value: unknown,
  fallback: ProductVertical = DEFAULT_PRODUCT_VERTICAL,
): ProductVertical {
  if (isProductVertical(value)) return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (normalized === 'businessandindustrial' || normalized === 'business_industrial') {
    return 'business_industrial';
  }
  if (normalized === 'auto' || normalized === 'motors') return 'automotive';
  if (normalized === 'fashion') return 'fashion';
  return fallback;
}

export type VerticalConfig = {
  enabledVerticals: ProductVertical[];
  defaultVertical: ProductVertical;
  workflows: Record<string, Record<string, unknown>>;
};

export type VerticalAttributeValue = string | number | boolean | string[];
export type VerticalAttributes = Record<string, VerticalAttributeValue>;
export type ProductAttributes = VerticalAttributes;

export type VerticalProfile = {
  id: ProductVertical;
  label: string;
  attributeFields: Array<{
    key: string;
    label: string;
    input: 'text' | 'number' | 'textarea' | 'json';
    description?: string;
  }>;
  supportsFitment: boolean;
  supportsVariations: boolean;
};

export type VerticalPublishProjection = {
  vertical: ProductVertical;
  title: string;
  description: string;
  categoryId: string;
  aspects: Record<string, string[]>;
  condition: string;
  conditionDescription?: string;
  warnings: string[];
  blockingErrors: string[];
  taxonomyAspects: EbayAspect[];
};

export type VerticalCategoryMetadata = {
  marketplaceId: string;
  categoryTreeId: string;
  categoryId: string;
  categoryName?: string | null;
  aspects: EbayAspect[];
  supportedConditions: string[];
  supportsVariations: boolean | null;
  fetchedAt: string;
};

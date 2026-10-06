import type { EbayCompatibilityPayload } from './ebay-api.types.js';

export interface TradingItemDetails {
  itemId: string | null;
  sku: string | null;
  title: string | null;
  categoryId: string | null;
  conditionId: number | null;
  quantity: number | null;
  quantitySold: number | null;
  price: number | null;
  currency: string | null;
  listingType: string | null;
  listingStatus: string | null;
  listingDuration: string | null;
  inventoryTrackingMethod: string | null;
  location: string | null;
  country: string | null;
  postalCode: string | null;
  conditionDescription: string | null;
  paymentProfileId: string | null;
  shippingProfileId: string | null;
  returnProfileId: string | null;
  listingUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  imageUrls: string[];
  compatibility: EbayCompatibilityPayload | null;
  listingDetails: {
    bestOfferEnabled: boolean | null;
    immediatePayRequired: boolean | null;
  };
  description: string | null;
  itemSpecifics: Record<string, string[]>;
}

function tagValue(block: string, tag: string): string | null {
  const m = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'),
  );
  const raw = m?.[1]?.trim() ?? null;
  if (!raw) return null;
  return decodeXmlEntities(raw.replace(/^<!\[CDATA\[|\]\]>$/g, ''));
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_match, code: string) => {
      const value = code.toLowerCase().startsWith('x')
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _match;
    });
}

function parseBoolean(value: string | null): boolean | null {
  if (value == null) return null;
  if (/^(true|1)$/i.test(value)) return true;
  if (/^(false|0)$/i.test(value)) return false;
  return null;
}

/** Extract all PictureURL values (and optional GalleryURL) from a Trading Item XML block. */
export function parsePictureUrls(itemBlock: string): string[] {
  const section =
    itemBlock.match(/<PictureDetails>[\s\S]*?<\/PictureDetails>/i)?.[0] ??
    itemBlock;
  const urls: string[] = [];
  const matches = section.matchAll(
    /<PictureURL[^>]*>([\s\S]*?)<\/PictureURL>/gi,
  );
  for (const m of matches) {
    const url = m[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
    if (url) urls.push(url);
  }
  const gallery = tagValue(section, 'GalleryURL');
  if (gallery) urls.push(gallery);
  return [...new Set(urls)];
}

export function parseTradingItemCompatibility(
  itemBlock: string,
): EbayCompatibilityPayload | null {
  const section = itemBlock.match(
    /<ItemCompatibilityList>[\s\S]*?<\/ItemCompatibilityList>/i,
  )?.[0];
  if (!section) return null;

  const compatibleProducts: EbayCompatibilityPayload['compatibleProducts'] = [];
  const compatBlocks =
    section.match(/<Compatibility>[\s\S]*?<\/Compatibility>/gi) ?? [];

  for (const block of compatBlocks) {
    const compatibilityProperties: Array<{ name: string; value: string }> = [];
    const nvlBlocks =
      block.match(/<NameValueList>[\s\S]*?<\/NameValueList>/gi) ?? [];
    for (const nvl of nvlBlocks) {
      const name = tagValue(nvl, 'Name');
      const value = tagValue(nvl, 'Value');
      if (name && value) compatibilityProperties.push({ name, value });
    }
    if (compatibilityProperties.length === 0) continue;
    const notes = tagValue(block, 'CompatibilityNotes');
    compatibleProducts.push({
      compatibilityProperties,
      ...(notes ? { notes } : {}),
    });
  }

  return compatibleProducts.length > 0 ? { compatibleProducts } : null;
}

/** Parse ItemSpecifics NameValueList blocks into a Name → values[] map. */
export function parseTradingItemSpecifics(
  itemBlock: string,
): Record<string, string[]> {
  const section =
    itemBlock.match(/<ItemSpecifics>[\s\S]*?<\/ItemSpecifics>/i)?.[0] ?? '';
  if (!section) return {};

  const out: Record<string, string[]> = {};
  const nvlBlocks =
    section.match(/<NameValueList>[\s\S]*?<\/NameValueList>/gi) ?? [];
  for (const nvl of nvlBlocks) {
    const name = tagValue(nvl, 'Name');
    if (!name) continue;
    const values: string[] = [];
    const valueMatches = nvl.matchAll(
      /<Value(?:\s[^>]*)?>([\s\S]*?)<\/Value>/gi,
    );
    for (const m of valueMatches) {
      const raw = m[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '');
      if (raw) values.push(raw);
    }
    if (values.length === 0) continue;
    const existing = out[name] ?? [];
    out[name] = [...new Set([...existing, ...values])];
  }
  return out;
}

export function parseTradingGetItemResponse(xml: string): TradingItemDetails {
  const itemBlock = xml.match(/<Item>[\s\S]*?<\/Item>/i)?.[0] ?? xml;
  const listingDetailsBlock =
    itemBlock.match(/<ListingDetails>[\s\S]*?<\/ListingDetails>/i)?.[0] ?? '';
  const bestOfferEnabled = parseBoolean(
    tagValue(itemBlock, 'BestOfferEnabled') ??
      tagValue(listingDetailsBlock, 'BestOfferEnabled'),
  );
  const immediatePayRequired = parseBoolean(tagValue(itemBlock, 'AutoPay'));
  const primaryCategoryBlock = itemBlock.match(
    /<PrimaryCategory>[\s\S]*?<\/PrimaryCategory>/i,
  )?.[0];
  const sellerProfilesBlock =
    itemBlock.match(/<SellerProfiles>[\s\S]*?<\/SellerProfiles>/i)?.[0] ?? '';
  const paymentProfileBlock =
    sellerProfilesBlock.match(
      /<SellerPaymentProfile>[\s\S]*?<\/SellerPaymentProfile>/i,
    )?.[0] ?? '';
  const shippingProfileBlock =
    sellerProfilesBlock.match(
      /<SellerShippingProfile>[\s\S]*?<\/SellerShippingProfile>/i,
    )?.[0] ?? '';
  const returnProfileBlock =
    sellerProfilesBlock.match(
      /<SellerReturnProfile>[\s\S]*?<\/SellerReturnProfile>/i,
    )?.[0] ?? '';
  const priceRaw =
    tagValue(itemBlock, 'BuyItNowPrice') ??
    tagValue(itemBlock, 'CurrentPrice') ??
    tagValue(itemBlock, 'StartPrice');
  const priceTag = itemBlock.match(
    /<(?:BuyItNowPrice|CurrentPrice|StartPrice)(?:\s[^>]*)?[^>]*>/i,
  )?.[0];
  const currency = priceTag?.match(/currencyID="([^"]+)"/i)?.[1] ?? null;
  const numberOrNull = (value: string | null): number | null => {
    if (value == null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    itemId: tagValue(itemBlock, 'ItemID'),
    sku: tagValue(itemBlock, 'SKU'),
    title: tagValue(itemBlock, 'Title'),
    categoryId:
      tagValue(itemBlock, 'PrimaryCategoryID') ??
      (primaryCategoryBlock
        ? tagValue(primaryCategoryBlock, 'CategoryID')
        : null),
    conditionId: numberOrNull(tagValue(itemBlock, 'ConditionID')),
    quantity: numberOrNull(tagValue(itemBlock, 'Quantity')),
    quantitySold: numberOrNull(tagValue(itemBlock, 'QuantitySold')),
    price: numberOrNull(priceRaw),
    currency,
    listingType: tagValue(itemBlock, 'ListingType'),
    listingStatus: tagValue(itemBlock, 'ListingStatus'),
    listingDuration: tagValue(itemBlock, 'ListingDuration'),
    inventoryTrackingMethod: tagValue(itemBlock, 'InventoryTrackingMethod'),
    location: tagValue(itemBlock, 'Location'),
    country: tagValue(itemBlock, 'Country'),
    postalCode: tagValue(itemBlock, 'PostalCode'),
    conditionDescription: tagValue(itemBlock, 'ConditionDescription'),
    paymentProfileId: tagValue(paymentProfileBlock, 'PaymentProfileID'),
    shippingProfileId: tagValue(shippingProfileBlock, 'ShippingProfileID'),
    returnProfileId: tagValue(returnProfileBlock, 'ReturnProfileID'),
    listingUrl: tagValue(itemBlock, 'ViewItemURL'),
    startTime: tagValue(itemBlock, 'StartTime'),
    endTime: tagValue(itemBlock, 'EndTime'),
    imageUrls: parsePictureUrls(itemBlock),
    compatibility: parseTradingItemCompatibility(itemBlock),
    listingDetails: {
      bestOfferEnabled,
      immediatePayRequired,
    },
    description: tagValue(itemBlock, 'Description'),
    itemSpecifics: parseTradingItemSpecifics(itemBlock),
  };
}

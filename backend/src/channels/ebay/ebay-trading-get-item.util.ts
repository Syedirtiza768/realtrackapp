import type { EbayCompatibilityPayload } from './ebay-api.types.js';

export interface TradingItemDetails {
  imageUrls: string[];
  compatibility: EbayCompatibilityPayload | null;
  description: string | null;
  itemSpecifics: Record<string, string[]>;
}

function tagValue(block: string, tag: string): string | null {
  const m = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'),
  );
  const raw = m?.[1]?.trim() ?? null;
  if (!raw) return null;
  return raw.replace(/^<!\[CDATA\[|\]\]>$/g, '');
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
  return {
    imageUrls: parsePictureUrls(itemBlock),
    compatibility: parseTradingItemCompatibility(itemBlock),
    description: tagValue(itemBlock, 'Description'),
    itemSpecifics: parseTradingItemSpecifics(itemBlock),
  };
}

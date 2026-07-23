/**
 * Best-effort parsers for public eBay item HTML.
 * Used only as an enrichment fallback when Trading/Browse cannot fill fields.
 * Selectors intentionally tolerate layout drift — prefer JSON-LD / embedded
 * image URLs over fragile DOM structure.
 */

export interface ScrapedListingPage {
  title: string | null;
  imageUrls: string[];
  descriptionHtml: string | null;
  descriptionText: string | null;
  itemSpecifics: Record<string, string[]>;
  compatibility: {
    compatibleProducts: Array<{
      compatibilityProperties: Array<{ name: string; value: string }>;
      notes?: string;
    }>;
  } | null;
  sources: string[];
}

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.trim().replace(/^http:\/\//i, 'https://');
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

function parseJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const blocks =
    html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ) ?? [];
  const products: Array<Record<string, unknown>> = [];
  for (const block of blocks) {
    const body = block
      .replace(/^[\s\S]*?>/, '')
      .replace(/<\/script>\s*$/i, '')
      .trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const type = String(
          (entry as { '@type'?: unknown })['@type'] ?? '',
        ).toLowerCase();
        if (type.includes('product')) {
          products.push(entry as Record<string, unknown>);
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return products;
}

function collectImagesFromJsonLd(
  products: Array<Record<string, unknown>>,
): string[] {
  const urls: string[] = [];
  for (const product of products) {
    const image = product.image;
    if (typeof image === 'string') urls.push(image);
    else if (Array.isArray(image)) {
      for (const entry of image) {
        if (typeof entry === 'string') urls.push(entry);
        else if (entry && typeof entry === 'object' && 'url' in entry) {
          const url = (entry as { url?: unknown }).url;
          if (typeof url === 'string') urls.push(url);
        }
      }
    } else if (image && typeof image === 'object' && 'url' in image) {
      const url = (image as { url?: unknown }).url;
      if (typeof url === 'string') urls.push(url);
    }
  }
  return urls;
}

function collectTitleFromJsonLd(
  products: Array<Record<string, unknown>>,
): string | null {
  for (const product of products) {
    const name = product.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

function collectDescriptionFromJsonLd(
  products: Array<Record<string, unknown>>,
): string | null {
  for (const product of products) {
    const desc = product.description;
    if (typeof desc === 'string' && desc.trim()) return desc.trim();
  }
  return null;
}

/** Pull every i.ebayimg.com URL mentioned in the page HTML. */
export function extractEbayImageUrlsFromHtml(html: string): string[] {
  const matches = html.matchAll(
    /https?:\/\/i\.ebayimg\.com\/[^"'\\\s<>]+/gi,
  );
  const urls: string[] = [];
  for (const m of matches) {
    let url = m[0]
      .replace(/&amp;/gi, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');
    // Drop size query junk / trailing punctuation
    url = url.replace(/[),.;]+$/, '');
    urls.push(url);
  }
  // Also catch escaped JSON forms: https:\/\/i.ebayimg.com\/...
  const escaped = html.matchAll(
    /https?:\\\/\\\/i\.ebayimg\.com\\\/[^"'\\\s<>]+/gi,
  );
  for (const m of escaped) {
    urls.push(m[0].replace(/\\\//g, '/').replace(/\\u002F/gi, '/'));
  }
  return uniqUrls(urls);
}

function extractOgImages(html: string): string[] {
  const urls: string[] = [];
  const metas = html.matchAll(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
  );
  for (const m of metas) {
    if (m[1]) urls.push(decodeHtmlEntities(m[1]));
  }
  const metas2 = html.matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
  );
  for (const m of metas2) {
    if (m[1]) urls.push(decodeHtmlEntities(m[1]));
  }
  return uniqUrls(urls);
}

/**
 * Best-effort item specifics from classic vi NameValue tables / JSON blobs.
 */
export function extractItemSpecificsFromHtml(
  html: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  const add = (name: string, value: string) => {
    const n = decodeHtmlEntities(name).replace(/\s+/g, ' ').trim();
    const v = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
    if (!n || !v) return;
    const existing = out[n] ?? [];
    if (!existing.includes(v)) existing.push(v);
    out[n] = existing;
  };

  // Classic item specifics rows: <div class="ux-labels-values__labels">Brand</div> ... values
  const labelValueBlocks = html.matchAll(
    /ux-labels-values__labels-content[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?ux-labels-values__values-content[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi,
  );
  for (const m of labelValueBlocks) {
    add(stripTags(m[1] ?? ''), stripTags(m[2] ?? ''));
  }

  // Older table style
  const rows = html.matchAll(
    /<td[^>]*class=["'][^"']*attrLabels[^"']*["'][^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi,
  );
  for (const m of rows) {
    add(stripTags(m[1] ?? ''), stripTags(m[2] ?? ''));
  }

  // Embedded "name":"Brand","value":"…" pairs in page JSON
  const jsonPairs = html.matchAll(
    /"name"\s*:\s*"([^"\\]+)"\s*,\s*"value"\s*:\s*"([^"\\]+)"/gi,
  );
  for (const m of jsonPairs) {
    add(m[1] ?? '', m[2] ?? '');
  }

  return out;
}

/**
 * Parse Motors fitment rows from HTML tables or embedded JSON.
 */
export function extractCompatibilityFromHtml(
  html: string,
): ScrapedListingPage['compatibility'] {
  const products: NonNullable<ScrapedListingPage['compatibility']>['compatibleProducts'] =
    [];

  // Table rows with Year / Make / Model headers nearby
  const tableRows =
    html.matchAll(
      /<tr[^>]*>\s*<td[^>]*>(\d{4})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>(?:\s*<td[^>]*>([^<]*)<\/td>)?(?:\s*<td[^>]*>([^<]*)<\/td>)?/gi,
    ) ?? [];
  for (const m of tableRows) {
    const props = [
      { name: 'Year', value: (m[1] ?? '').trim() },
      { name: 'Make', value: decodeHtmlEntities((m[2] ?? '').trim()) },
      { name: 'Model', value: decodeHtmlEntities((m[3] ?? '').trim()) },
    ];
    if (m[4]?.trim()) {
      props.push({
        name: 'Trim',
        value: decodeHtmlEntities(m[4].trim()),
      });
    }
    if (m[5]?.trim()) {
      props.push({
        name: 'Engine',
        value: decodeHtmlEntities(m[5].trim()),
      });
    }
    if (props.every((p) => p.value)) {
      products.push({ compatibilityProperties: props });
    }
  }

  // JSON-ish Year/Make/Model triples
  const jsonRows = html.matchAll(
    /"Year"\s*:\s*"(\d{4})"\s*,\s*"Make"\s*:\s*"([^"\\]+)"\s*,\s*"Model"\s*:\s*"([^"\\]+)"/gi,
  );
  for (const m of jsonRows) {
    products.push({
      compatibilityProperties: [
        { name: 'Year', value: m[1] ?? '' },
        { name: 'Make', value: m[2] ?? '' },
        { name: 'Model', value: m[3] ?? '' },
      ],
    });
  }

  if (products.length === 0) return null;
  // Cap absurd dumps
  return { compatibleProducts: products.slice(0, 5000) };
}

function extractDescriptionHtml(html: string): string | null {
  // iframe srcdoc / classic d-item-description
  const iframeSrc =
    html.match(
      /id=["']desc_ifr["'][^>]*src=["']([^"']+)["']/i,
    )?.[1] ?? null;
  void iframeSrc; // remote iframe body needs a second fetch — handled by caller if needed

  const sections = [
    html.match(
      /id=["']ds_div["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/section|<\/td)/i,
    )?.[1],
    html.match(
      /itemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1],
    html.match(
      /class=["'][^"']*d-item-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1],
  ];
  for (const section of sections) {
    if (section && stripTags(section).length > 40) {
      return section.trim();
    }
  }
  return null;
}

export function parseEbayListingPageHtml(html: string): ScrapedListingPage {
  const sources: string[] = [];
  const products = parseJsonLdProducts(html);
  const title = collectTitleFromJsonLd(products);
  if (title) sources.push('json_ld_title');
  const jsonLdImages = collectImagesFromJsonLd(products);
  const ogImages = extractOgImages(html);
  const pageImages = extractEbayImageUrlsFromHtml(html);
  const imageUrls = uniqUrls([...jsonLdImages, ...ogImages, ...pageImages]);
  if (jsonLdImages.length) sources.push('json_ld_images');
  if (ogImages.length) sources.push('og_image');
  if (pageImages.length) sources.push('html_ebayimg');

  let descriptionHtml =
    collectDescriptionFromJsonLd(products) ?? extractDescriptionHtml(html);
  if (descriptionHtml && !descriptionHtml.includes('<')) {
    // JSON-LD plain text — wrap lightly for consumers expecting HTML
    descriptionHtml = `<p>${descriptionHtml}</p>`;
    sources.push('json_ld_description');
  } else if (descriptionHtml) {
    sources.push('html_description');
  }

  const itemSpecifics = extractItemSpecificsFromHtml(html);
  if (Object.keys(itemSpecifics).length) sources.push('html_item_specifics');

  const compatibility = extractCompatibilityFromHtml(html);
  if (compatibility) sources.push('html_compatibility');

  return {
    title,
    imageUrls,
    descriptionHtml: descriptionHtml?.trim() || null,
    descriptionText: descriptionHtml ? stripTags(descriptionHtml) : null,
    itemSpecifics,
    compatibility,
    sources: [...new Set(sources)],
  };
}

/** True when listing URL points at a non-English eBay marketplace host. */
export function isNonEnglishEbayListingHost(url?: string | null): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host === 'www.ebay.com' || host === 'ebay.com') return false;
    if (host.endsWith('.ebay.com')) return false;
    // English-language sites we keep as-is for now
    if (host === 'www.ebay.co.uk' || host === 'ebay.co.uk') return false;
    if (host === 'www.ebay.ca' || host === 'ebay.ca') return false;
    if (host === 'www.ebay.com.au' || host === 'ebay.com.au') return false;
    return /(^|\.)ebay\.(de|fr|it|es|nl|be|at|ch|pl|ie|com\.br)$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Build a public item URL for enrichment.
 * When preferEnglishSite is true (default for scrape), always use ebay.com so
 * title/description come back in English even if Trading stored a .de/.fr URL.
 */
export function buildPublicEbayItemUrl(
  ebayItemId: string,
  listingUrl?: string | null,
  options?: { preferEnglishSite?: boolean },
): string {
  const preferEnglish = options?.preferEnglishSite !== false;
  if (preferEnglish && ebayItemId?.trim()) {
    return `https://www.ebay.com/itm/${ebayItemId.trim()}`;
  }
  if (listingUrl?.trim() && /^https?:\/\//i.test(listingUrl.trim())) {
    return listingUrl.trim();
  }
  return `https://www.ebay.com/itm/${ebayItemId}`;
}

import { Injectable, Logger } from '@nestjs/common';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
import { EbayListingPageScrapeService } from '../../channels/ebay/ebay-listing-page-scrape.service.js';
import type { EbayCompatibilityPayload } from '../../channels/ebay/ebay-api.types.js';
import type { EbayItem } from '../../channels/ebay/ebay-api.types.js';
import {
  preferLargeEbayImageUrl,
  sanitizeEbayImageUrls,
} from '../../channels/ebay/ebay-listing-images.util.js';
import { isNonEnglishEbayListingHost } from '../../channels/ebay/ebay-listing-page-scrape.util.js';

export interface ListingEnrichmentInput {
  storeId: string;
  ebayItemId: string;
  sku?: string | null;
  marketplaceId?: string | null;
  listingUrl?: string | null;
  title?: string | null;
  imageUrls?: string[];
  compatibility?: Record<string, unknown> | null;
  description?: string | null;
  itemSpecifics?: Record<string, string[]>;
  /** Prefer Browse + page scrape; skip Trading GetItem (usage limits). */
  skipTrading?: boolean;
}

export interface ListingEnrichmentResult {
  title: string | null;
  listingUrl: string | null;
  imageUrls: string[];
  compatibility: Record<string, unknown> | null;
  description: string | null;
  itemSpecifics: Record<string, string[]>;
  sources: string[];
  /** Thin GetItem / scrape snapshot for consumers rebuilding fields. */
  rawGetItem?: {
    imageUrls: string[];
    description: string | null;
    itemSpecifics: Record<string, string[]>;
    compatibility: Record<string, unknown> | null;
    title?: string | null;
  };
}

function compatibilityRowCount(
  compatibility: Record<string, unknown> | null | undefined,
): number {
  const rows = compatibility?.compatibleProducts;
  return Array.isArray(rows) ? rows.length : -1;
}

function compatibilityChecked(
  compatibility: Record<string, unknown> | null | undefined,
): boolean {
  return (
    compatibility != null && Array.isArray(compatibility.compatibleProducts)
  );
}

function aspectCount(specifics: Record<string, string[]> | undefined): number {
  return Object.keys(specifics ?? {}).length;
}

function extractBrowseImages(item: EbayItem): string[] {
  const urls: string[] = [];
  if (item.image?.imageUrl) urls.push(item.image.imageUrl);
  const additional =
    (
      item as EbayItem & {
        additionalImages?: Array<{ imageUrl?: string }>;
      }
    ).additionalImages ?? [];
  for (const img of additional) {
    if (img.imageUrl) urls.push(img.imageUrl);
  }
  return [...new Set(urls.map(preferLargeEbayImageUrl))];
}

function extractBrowseCompatibility(
  item: EbayItem,
): EbayCompatibilityPayload | null {
  const raw =
    (
      item as EbayItem & {
        compatibleProducts?: EbayCompatibilityPayload['compatibleProducts'];
      }
    ).compatibleProducts ?? null;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return { compatibleProducts: raw };
}

function extractBrowseDescription(item: EbayItem): string | null {
  const desc = (
    item as EbayItem & {
      description?: string;
      shortDescription?: string;
    }
  ).description;
  const short = (
    item as EbayItem & {
      shortDescription?: string;
    }
  ).shortDescription;
  const value = (desc ?? short ?? '').trim();
  return value || null;
}

function extractBrowseItemSpecifics(
  item: EbayItem,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const aspect of item.localizedAspects ?? []) {
    const name = aspect?.name?.trim();
    const value = aspect?.value?.trim();
    if (!name || !value) continue;
    const existing = out[name] ?? [];
    if (!existing.includes(value)) existing.push(value);
    out[name] = existing;
  }
  if (item.brand?.trim()) {
    out.Brand = [...new Set([...(out.Brand ?? []), item.brand.trim()])];
  }
  if (item.mpn?.trim()) {
    out['Manufacturer Part Number'] = [
      ...new Set([...(out['Manufacturer Part Number'] ?? []), item.mpn.trim()]),
    ];
  }
  return out;
}

function mergeItemSpecifics(
  primary: Record<string, string[]> | undefined,
  secondary: Record<string, string[]> | undefined,
): Record<string, string[]> {
  if (aspectCount(primary) === 0) return { ...(secondary ?? {}) };
  if (aspectCount(secondary) === 0) return { ...(primary ?? {}) };
  if (aspectCount(secondary) > aspectCount(primary)) {
    return { ...(secondary ?? {}) };
  }
  return { ...(primary ?? {}) };
}

function tradingEnrichDisabled(
  inputSkip?: boolean,
): boolean {
  if (inputSkip) return true;
  const flag = (
    process.env.PUBLISHED_LISTINGS_SKIP_TRADING_ENRICH ?? ''
  ).toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

@Injectable()
export class PublishedListingsEnrichmentService {
  private readonly logger = new Logger(PublishedListingsEnrichmentService.name);

  constructor(
    private readonly tradingApi: EbayTradingApiService,
    private readonly browseApi: EbayBrowseApiService,
    private readonly inventoryApi: EbayInventoryApiService,
    private readonly pageScrape: EbayListingPageScrapeService,
  ) {}

  needsEnrichment(input: ListingEnrichmentInput): boolean {
    const imageCount = input.imageUrls?.length ?? 0;
    const hasDescription = Boolean(input.description?.trim());
    const hasSpecifics = aspectCount(input.itemSpecifics) > 0;
    const needsEnglishLocale = isNonEnglishEbayListingHost(input.listingUrl);
    return (
      imageCount <= 1 ||
      !compatibilityChecked(input.compatibility) ||
      !hasDescription ||
      !hasSpecifics ||
      needsEnglishLocale
    );
  }

  async enrichListing(
    input: ListingEnrichmentInput,
  ): Promise<ListingEnrichmentResult> {
    const sources: string[] = [];
    let listingUrl = input.listingUrl?.trim() || null;
    const englishListingUrl = input.ebayItemId?.trim()
      ? `https://www.ebay.com/itm/${input.ebayItemId.trim()}`
      : null;
    const forceEnglish = isNonEnglishEbayListingHost(listingUrl);
    // Drop localized title/description so Browse US / ebay.com scrape replace them.
    let title = forceEnglish ? null : input.title?.trim() || null;
    let imageUrls = [...(input.imageUrls ?? [])].map(preferLargeEbayImageUrl);
    let compatibility = input.compatibility ?? null;
    let description = forceEnglish ? null : input.description?.trim() || null;
    let itemSpecifics = { ...(input.itemSpecifics ?? {}) };
    let rawGetItem: ListingEnrichmentResult['rawGetItem'];

    if (input.sku?.trim() && !compatibilityChecked(compatibility)) {
      try {
        const invCompat = (await this.inventoryApi.getCompatibility(
          input.storeId,
          input.sku.trim(),
        )) as unknown as Record<string, unknown>;
        if (compatibilityRowCount(invCompat) > 0) {
          compatibility = invCompat;
          sources.push('inventory_api');
        }
      } catch {
        // SKU may not exist in Inventory API for legacy listings.
      }
    }

    let needsImages = imageUrls.length <= 1;
    let needsCompat = !compatibilityChecked(compatibility);
    let needsDescription = !description;
    let needsTitle = !title;
    let needsSpecifics = aspectCount(itemSpecifics) === 0;

    // Trading GetItem follows the seller marketplace language — skip it when
    // we need English locale so FR/DE text is not re-applied.
    if (
      !forceEnglish &&
      !tradingEnrichDisabled(input.skipTrading) &&
      (needsImages || needsCompat || needsDescription || needsSpecifics)
    ) {
      try {
        const trading = await this.tradingApi.getItemDetails(
          input.storeId,
          input.ebayItemId,
          input.marketplaceId,
        );
        rawGetItem = {
          imageUrls: trading.imageUrls.map(preferLargeEbayImageUrl),
          description: trading.description,
          itemSpecifics: trading.itemSpecifics ?? {},
          compatibility: trading.compatibility as unknown as Record<
            string,
            unknown
          > | null,
        };
        if (needsImages && trading.imageUrls.length > imageUrls.length) {
          imageUrls = trading.imageUrls.map(preferLargeEbayImageUrl);
          sources.push('trading_getitem');
        }
        if (needsCompat && trading.compatibility) {
          compatibility = trading.compatibility as unknown as Record<
            string,
            unknown
          >;
          sources.push('trading_getitem');
        }
        if (needsDescription && trading.description?.trim()) {
          description = trading.description.trim();
          sources.push('trading_getitem');
        }
        if (needsSpecifics && aspectCount(trading.itemSpecifics) > 0) {
          itemSpecifics = mergeItemSpecifics(
            itemSpecifics,
            trading.itemSpecifics,
          );
          sources.push('trading_getitem');
        }
      } catch (e) {
        this.logger.debug(
          `Trading GetItem enrich skipped for ${input.ebayItemId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    needsImages = imageUrls.length <= 1;
    needsCompat = !compatibilityChecked(compatibility);
    needsDescription = !description;
    needsTitle = !title;
    needsSpecifics = aspectCount(itemSpecifics) === 0;

    if (
      needsImages ||
      needsCompat ||
      needsDescription ||
      needsSpecifics ||
      needsTitle ||
      forceEnglish
    ) {
      try {
        const browse = await this.browseApi.getItemByLegacyId(input.ebayItemId);
        if (needsImages) {
          const browseImages = extractBrowseImages(browse);
          if (browseImages.length > imageUrls.length) {
            imageUrls = browseImages;
            sources.push('browse_api');
          }
        }
        if (needsCompat) {
          const browseCompat = extractBrowseCompatibility(browse);
          if (browseCompat) {
            compatibility = browseCompat as unknown as Record<string, unknown>;
            sources.push('browse_api');
          }
        }
        if (needsDescription) {
          const browseDesc = extractBrowseDescription(browse);
          if (browseDesc) {
            description = browseDesc;
            sources.push('browse_api');
          }
        }
        if (needsTitle && browse.title?.trim()) {
          title = browse.title.trim();
          sources.push('browse_api');
        }
        if (needsSpecifics) {
          const browseSpecifics = extractBrowseItemSpecifics(browse);
          if (aspectCount(browseSpecifics) > 0) {
            itemSpecifics = mergeItemSpecifics(itemSpecifics, browseSpecifics);
            sources.push('browse_api');
          }
        }
        if (forceEnglish && englishListingUrl) {
          listingUrl = englishListingUrl;
          sources.push('browse_api');
        }
      } catch (e) {
        this.logger.debug(
          `Browse enrich skipped for ${input.ebayItemId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    needsImages = imageUrls.length <= 1;
    needsCompat = !compatibilityChecked(compatibility);
    needsDescription = !description;
    needsTitle = !title;
    needsSpecifics = aspectCount(itemSpecifics) === 0;

    if (
      this.pageScrape.isEnabled() &&
      (needsImages ||
        needsCompat ||
        needsDescription ||
        needsSpecifics ||
        needsTitle)
    ) {
      try {
        const scraped = await this.pageScrape.scrapeListingPage({
          ebayItemId: input.ebayItemId,
          listingUrl: englishListingUrl ?? input.listingUrl,
        });
        if (scraped) {
          if (needsImages && scraped.imageUrls.length > imageUrls.length) {
            imageUrls = scraped.imageUrls.map(preferLargeEbayImageUrl);
            sources.push('listing_page_scrape');
          }
          if (needsCompat && scraped.compatibility) {
            compatibility = scraped.compatibility as unknown as Record<
              string,
              unknown
            >;
            sources.push('listing_page_scrape');
          }
          if (needsDescription && scraped.descriptionHtml?.trim()) {
            description = scraped.descriptionHtml.trim();
            sources.push('listing_page_scrape');
          }
          if (needsTitle && scraped.title?.trim()) {
            title = scraped.title.trim();
            sources.push('listing_page_scrape');
          }
          if (
            needsSpecifics &&
            aspectCount(scraped.itemSpecifics) > 0
          ) {
            itemSpecifics = mergeItemSpecifics(
              itemSpecifics,
              scraped.itemSpecifics,
            );
            sources.push('listing_page_scrape');
          }
          if (forceEnglish && englishListingUrl) {
            listingUrl = englishListingUrl;
            sources.push('listing_page_scrape');
          }
          rawGetItem = {
            imageUrls: scraped.imageUrls,
            description: scraped.descriptionHtml,
            itemSpecifics: scraped.itemSpecifics,
            compatibility: scraped.compatibility as unknown as Record<
              string,
              unknown
            > | null,
            title: scraped.title,
          };
        }
      } catch (e) {
        this.logger.debug(
          `Listing page scrape enrich skipped for ${input.ebayItemId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    if (forceEnglish && englishListingUrl) {
      listingUrl = englishListingUrl;
    }

    const sanitized = sanitizeEbayImageUrls(
      imageUrls.map(preferLargeEbayImageUrl),
    );
    return {
      title,
      listingUrl,
      imageUrls: sanitized.imageUrls,
      compatibility:
        compatibilityRowCount(compatibility) > 0
          ? compatibility
          : compatibility === null
            ? { compatibleProducts: [] }
            : compatibility,
      description,
      itemSpecifics,
      sources: [...new Set(sources)],
      rawGetItem,
    };
  }
}

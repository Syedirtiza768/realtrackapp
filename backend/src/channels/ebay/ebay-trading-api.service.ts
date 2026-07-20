import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import {
  parsePictureUrls,
  parseTradingGetItemResponse,
  type TradingItemDetails,
} from './ebay-trading-get-item.util.js';

export interface TradingSellerListItem {
  itemId: string;
  title: string;
  sku: string | null;
  quantityAvailable: number;
  quantitySold: number;
  price: number | null;
  currency: string;
  listingStatus: string;
  listingFormat: string;
  condition: string | null;
  categoryId: string | null;
  /** First gallery/thumbnail URL (legacy). Prefer imageUrls. */
  imageUrl: string | null;
  /** Full gallery when PictureURL[] is present in the Trading XML. */
  imageUrls: string[];
  viewCount: number | null;
  watchCount: number | null;
  startTime: string | null;
  endTime: string | null;
  listingUrl: string | null;
}

const MARKETPLACE_SITE_ID: Record<string, number> = {
  EBAY_US: 0,
  EBAY_MOTORS_US: 100,
  EBAY_GB: 3,
  EBAY_DE: 77,
  EBAY_AU: 15,
};

function tagValue(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  const raw = m?.[1]?.trim() ?? null;
  if (!raw) return null;
  return raw.replace(/^<!\[CDATA\[|\]\]>$/g, '');
}

function parseActiveListItems(xml: string): TradingSellerListItem[] {
  const section = xml.match(/<ActiveList>[\s\S]*?<\/ActiveList>/i)?.[0];
  if (!section) return [];
  return parseItems(section);
}

function parseItems(xml: string): TradingSellerListItem[] {
  const items: TradingSellerListItem[] = [];
  const blocks = xml.match(/<Item>[\s\S]*?<\/Item>/gi) ?? [];
  for (const block of blocks) {
    const itemId = tagValue(block, 'ItemID');
    const title = tagValue(block, 'Title');
    if (!itemId || !title) continue;

    const sku = tagValue(block, 'SKU');
    const qty = Number(tagValue(block, 'Quantity') ?? '0');
    const sold = Number(tagValue(block, 'QuantitySold') ?? '0');
    const priceStr =
      tagValue(block, 'CurrentPrice') ??
      tagValue(block, 'BuyItNowPrice') ??
      tagValue(block, 'StartPrice');
    const currency =
      block.match(/currencyID="([^"]+)"/i)?.[1] ??
      block.match(/<CurrentPrice currencyID="([^"]+)"/i)?.[1] ??
      'USD';
    const listingType = tagValue(block, 'ListingType') ?? 'FixedPriceItem';
    const listingStatus = tagValue(block, 'ListingStatus') ?? 'Active';
    const condition = tagValue(block, 'ConditionDisplayName');
    const categoryId = tagValue(block, 'PrimaryCategoryID');
    const imageUrls = parsePictureUrls(block);
    const galleryUrl = imageUrls[0] ?? tagValue(block, 'GalleryURL');
    const viewCount = Number(tagValue(block, 'HitCount') ?? '');
    const watchCount = Number(tagValue(block, 'WatchCount') ?? '');
    const startTime = tagValue(block, 'StartTime');
    const endTime = tagValue(block, 'EndTime');
    const viewItemUrl = tagValue(block, 'ViewItemURL');

    items.push({
      itemId,
      title,
      sku,
      quantityAvailable: Math.max(0, qty - sold),
      quantitySold: sold,
      price: priceStr ? Number(priceStr) : null,
      currency,
      listingStatus,
      listingFormat: listingType.toLowerCase().includes('auction')
        ? 'auction'
        : 'fixed_price',
      condition,
      categoryId,
      imageUrl: galleryUrl,
      imageUrls,
      viewCount: Number.isFinite(viewCount) ? viewCount : null,
      watchCount: Number.isFinite(watchCount) ? watchCount : null,
      startTime,
      endTime,
      listingUrl: viewItemUrl,
    });
  }
  return items;
}

/**
 * eBay Trading API client (XML) — GetSellerList fallback for legacy/active listings
 * not surfaced via Inventory API offers.
 */
@Injectable()
export class EbayTradingApiService {
  private readonly logger = new Logger(EbayTradingApiService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: config.baseUrl.replace('/buy', '').replace(/\/$/, ''),
      timeout: 60_000,
    });
  }

  private tradingUrl(): string {
    const config = this.auth.getApiConfig();
    return `${config.baseUrl}/ws/api.dll`;
  }

  private resolveSiteId(marketplaceId?: string | null): number {
    if (!marketplaceId) return 0;
    return MARKETPLACE_SITE_ID[marketplaceId] ?? 0;
  }

  private formatTradingDate(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  }

  private async postTradingRequest(
    storeId: string,
    callName: string,
    body: string,
    marketplaceId?: string | null,
  ): Promise<string> {
    const token = await this.auth.getAccessToken(storeId);
    const siteId = this.resolveSiteId(marketplaceId);

    const { data } = await this.http.post<string>(this.tradingUrl(), body, {
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': '',
        'X-EBAY-API-APP-NAME': '',
        'X-EBAY-API-CERT-NAME': '',
        'X-EBAY-API-CALL-NAME': callName,
        'X-EBAY-API-SITEID': String(siteId),
        'X-EBAY-API-IAF-TOKEN': token,
      },
      responseType: 'text',
      transformResponse: [(r) => r],
    });

    return String(data);
  }

  /**
   * GetMyeBaySelling ActiveList — canonical source for all live seller listings.
   * GetSellerList requires date windows and misses GTC inventory; ActiveList does not.
   */
  async getMyeBaySellingActiveList(
    storeId: string,
    options: {
      page?: number;
      entriesPerPage?: number;
      marketplaceId?: string | null;
    } = {},
  ): Promise<{
    items: TradingSellerListItem[];
    totalPages: number;
    page: number;
    hasMore: boolean;
  }> {
    const page = options.page ?? 1;
    const entriesPerPage = Math.min(options.entriesPerPage ?? 200, 200);

    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;

    const xml = await this.postTradingRequest(
      storeId,
      'GetMyeBaySelling',
      body,
      options.marketplaceId,
    );

    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const err = tagValue(xml, 'LongMessage') ?? 'GetMyeBaySelling failed';
      this.logger.warn(
        `Trading API GetMyeBaySelling failed for store ${storeId}: ${err}`,
      );
      throw new Error(err);
    }

    const items = parseActiveListItems(xml);
    const activeSection =
      xml.match(/<ActiveList>[\s\S]*?<\/ActiveList>/i)?.[0] ?? xml;
    const totalPages = Number(
      tagValue(activeSection, 'TotalNumberOfPages') ?? '1',
    );
    return {
      items,
      totalPages: Number.isFinite(totalPages) ? totalPages : 1,
      page,
      hasMore: page < totalPages,
    };
  }

  async getSellerList(
    storeId: string,
    options: {
      page?: number;
      entriesPerPage?: number;
      marketplaceId?: string | null;
    } = {},
  ): Promise<{
    items: TradingSellerListItem[];
    totalPages: number;
    page: number;
    hasMore: boolean;
  }> {
    const page = options.page ?? 1;
    const entriesPerPage = Math.min(options.entriesPerPage ?? 200, 200);
    const now = new Date();
    const endFrom = this.formatTradingDate(now);
    const endTo = this.formatTradingDate(
      new Date(now.getTime() + 119 * 24 * 60 * 60 * 1000),
    );

    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <GranularityLevel>Coarse</GranularityLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
  <EndTimeFrom>${endFrom}</EndTimeFrom>
  <EndTimeTo>${endTo}</EndTimeTo>
  <Pagination>
    <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetSellerListRequest>`;

    const xml = await this.postTradingRequest(
      storeId,
      'GetSellerList',
      body,
      options.marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const err = tagValue(xml, 'LongMessage') ?? 'GetSellerList failed';
      this.logger.warn(
        `Trading API GetSellerList failed for store ${storeId}: ${err}`,
      );
      throw new Error(err);
    }

    const items = parseItems(xml);
    const totalPages = Number(tagValue(xml, 'TotalNumberOfPages') ?? '1');
    return {
      items,
      totalPages: Number.isFinite(totalPages) ? totalPages : 1,
      page,
      hasMore: page < totalPages,
    };
  }

  /**
   * Trading API GetItem — full gallery images and ItemCompatibilityList for a
   * seller-owned listing (requires store OAuth token).
   */
  async getItemDetails(
    storeId: string,
    itemId: string,
    marketplaceId?: string | null,
  ): Promise<TradingItemDetails> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemCompatibilityList>true</IncludeItemCompatibilityList>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`;

    const xml = await this.postTradingRequest(
      storeId,
      'GetItem',
      body,
      marketplaceId,
    );

    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const err = tagValue(xml, 'LongMessage') ?? 'GetItem failed';
      throw new Error(err);
    }

    return parseTradingGetItemResponse(xml);
  }

  /** Paginate all active seller listings via Trading API (GetMyeBaySelling ActiveList). */
  async getAllActiveListings(
    storeId: string,
    marketplaceId?: string | null,
  ): Promise<TradingSellerListItem[]> {
    const all: TradingSellerListItem[] = [];
    let page = 1;
    for (;;) {
      const result = await this.getMyeBaySellingActiveList(storeId, {
        page,
        entriesPerPage: 200,
        marketplaceId,
      });
      all.push(
        ...result.items.filter(
          (i) => i.listingStatus.toLowerCase() === 'active',
        ),
      );
      if (!result.hasMore) break;
      page += 1;
      if (page > 500) {
        this.logger.warn(
          `Trading API ActiveList pagination capped at page 500 for store ${storeId}`,
        );
        break;
      }
    }
    return all;
  }

  /**
   * Full live seller inventory via GetSellerList (EndTime window).
   * Prefer this over ActiveList for large stores — ActiveList is hard-capped
   * around 25,000 items and under-counts storefronts like salvagea / blackline.
   */
  async getAllSellerListListings(
    storeId: string,
    marketplaceId?: string | null,
  ): Promise<TradingSellerListItem[]> {
    const byId = new Map<string, TradingSellerListItem>();
    let page = 1;
    for (;;) {
      const result = await this.getSellerList(storeId, {
        page,
        entriesPerPage: 200,
        marketplaceId,
      });
      for (const item of result.items) {
        if (item.listingStatus.toLowerCase() !== 'active') continue;
        byId.set(item.itemId, item);
      }
      if (!result.hasMore) break;
      page += 1;
      if (page > 1000) {
        this.logger.warn(
          `Trading API GetSellerList pagination capped at page 1000 for store ${storeId}`,
        );
        break;
      }
    }
    return [...byId.values()];
  }

  /**
   * Canonical live listing set for published-listings sync.
   * Uses GetSellerList for completeness; merges ActiveList when it adds IDs
   * (small stores / race coverage). Never treats ActiveList alone as complete
   * for hard-gate count matching against eBay storefronts.
   */
  async getAllLiveListings(
    storeId: string,
    marketplaceId?: string | null,
  ): Promise<TradingSellerListItem[]> {
    const byId = new Map<string, TradingSellerListItem>();

    try {
      const sellerList = await this.getAllSellerListListings(
        storeId,
        marketplaceId,
      );
      for (const item of sellerList) byId.set(item.itemId, item);
      this.logger.log(
        `GetSellerList returned ${sellerList.length} active listing(s) for store ${storeId}`,
      );
    } catch (e) {
      this.logger.warn(
        `GetSellerList failed for store ${storeId}: ${
          e instanceof Error ? e.message : String(e)
        } — falling back to ActiveList only`,
      );
    }

    try {
      const activeList = await this.getAllActiveListings(storeId, marketplaceId);
      let added = 0;
      for (const item of activeList) {
        if (!byId.has(item.itemId)) {
          byId.set(item.itemId, item);
          added += 1;
        }
      }
      this.logger.log(
        `ActiveList returned ${activeList.length} active listing(s) for store ${storeId} (${added} new after merge)`,
      );
    } catch (e) {
      if (byId.size === 0) throw e;
      this.logger.warn(
        `ActiveList merge skipped for store ${storeId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return [...byId.values()];
  }
}

import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';

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
  imageUrl: string | null;
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
    const galleryUrl = tagValue(block, 'GalleryURL');
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
    const token = await this.auth.getAccessToken(storeId);
    const siteId = this.resolveSiteId(options.marketplaceId);

    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <GranularityLevel>Coarse</GranularityLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
  <Pagination>
    <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetSellerListRequest>`;

    const { data } = await this.http.post<string>(this.tradingUrl(), body, {
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-DEV-NAME': '',
        'X-EBAY-API-APP-NAME': '',
        'X-EBAY-API-CERT-NAME': '',
        'X-EBAY-API-CALL-NAME': 'GetSellerList',
        'X-EBAY-API-SITEID': String(siteId),
        'X-EBAY-API-IAF-TOKEN': token,
      },
      responseType: 'text',
      transformResponse: [(r) => r],
    });

    const xml = String(data);
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const err = tagValue(xml, 'LongMessage') ?? 'GetSellerList failed';
      this.logger.warn(`Trading API GetSellerList failed for store ${storeId}: ${err}`);
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

  /** Paginate all active seller listings via Trading API. */
  async getAllActiveListings(
    storeId: string,
    marketplaceId?: string | null,
  ): Promise<TradingSellerListItem[]> {
    const all: TradingSellerListItem[] = [];
    let page = 1;
    for (;;) {
      const result = await this.getSellerList(storeId, {
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
      if (page > 100) {
        this.logger.warn(`Trading API pagination capped at page 100 for store ${storeId}`);
        break;
      }
    }
    return all;
  }
}

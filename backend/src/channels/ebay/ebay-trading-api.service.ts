import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import {
  parsePictureUrls,
  parseTradingGetItemResponse,
  type TradingItemDetails,
} from './ebay-trading-get-item.util.js';
import type { EbayCompatibilityPayload } from './ebay-api.types.js';
import { toCoreCompatibilityPayload } from '../../fitment/fitment-mvl.util.js';

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

export interface TradingFixedPriceItemInput {
  title: string;
  description: string;
  categoryId: string;
  conditionId: number;
  quantity: number;
  price: number;
  currency: string;
  sku: string;
  imageUrls: string[];
  itemSpecifics?: Record<string, string[]>;
  compatibility?: EbayCompatibilityPayload | null;
  listingDuration?: string;
  location?: string | null;
  country?: string | null;
  postalCode?: string | null;
  conditionDescription?: string | null;
  paymentProfileId?: string | null;
  shippingProfileId?: string | null;
  returnProfileId?: string | null;
  immediatePayRequired?: boolean | null;
  bestOfferEnabled?: boolean | null;
}

export interface TradingBatchAddResult {
  messageId: string;
  success: boolean;
  itemId?: string;
  errorCode?: string;
  error?: string;
}

export interface TradingFixedPriceRevisionInput {
  title?: string;
  description?: string;
  categoryId?: string;
  quantity?: number;
  price?: number;
  currency?: string;
  imageUrls?: string[];
  itemSpecifics?: Record<string, string[]>;
  compatibility?: EbayCompatibilityPayload | null;
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

function tradingFailureMessage(xml: string, fallback: string): string {
  const details = [
    tagValue(xml, 'LongMessage'),
    tagValue(xml, 'Message'),
    tagValue(xml, 'ShortMessage'),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(details)].join(' — ') || fallback;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function xmlText(value: string): string {
  return escapeXml(value);
}

function sellerProfilesXml(input: TradingFixedPriceItemInput): string {
  const profiles = [
    input.paymentProfileId
      ? `    <SellerPaymentProfile><PaymentProfileID>${xmlText(input.paymentProfileId)}</PaymentProfileID></SellerPaymentProfile>`
      : '',
    input.shippingProfileId
      ? `    <SellerShippingProfile><ShippingProfileID>${xmlText(input.shippingProfileId)}</ShippingProfileID></SellerShippingProfile>`
      : '',
    input.returnProfileId
      ? `    <SellerReturnProfile><ReturnProfileID>${xmlText(input.returnProfileId)}</ReturnProfileID></SellerReturnProfile>`
      : '',
  ].filter(Boolean);
  return profiles.length ? `  <SellerProfiles>\n${profiles.join('\n')}\n  </SellerProfiles>` : '';
}

function itemSpecificsXml(aspects: Record<string, string[]> | undefined): string {
  const rows = Object.entries(aspects ?? {}).flatMap(([name, values]) =>
    (values ?? []).map(
      (value) =>
        `    <NameValueList><Name>${xmlText(name)}</Name><Value>${xmlText(String(value))}</Value></NameValueList>`,
    ),
  );
  return rows.length ? `  <ItemSpecifics>\n${rows.join('\n')}\n  </ItemSpecifics>` : '';
}

function compatibilityXml(payload: EbayCompatibilityPayload | null | undefined): string {
  const rows = (payload?.compatibleProducts ?? []).map((row) => {
    const properties = row.compatibilityProperties
      .map(
        (property) =>
          `      <NameValueList><Name>${xmlText(property.name)}</Name><Value>${xmlText(property.value)}</Value></NameValueList>`,
      )
      .join('\n');
    const notes = row.notes
      ? `\n      <CompatibilityNotes>${xmlText(row.notes)}</CompatibilityNotes>`
      : '';
    return `    <Compatibility>\n${properties}${notes}\n    </Compatibility>`;
  });
  return rows.length
    ? `  <ItemCompatibilityList>\n${rows.join('\n')}\n  </ItemCompatibilityList>`
    : '';
}

function isInvalidCompatibilityResponse(xml: string): boolean {
  return (
    /<ErrorCode>\s*21917122\s*<\/ErrorCode>/i.test(xml) ||
    /all compatibilities are invalid/i.test(xml)
  );
}

function validateFixedPriceItemInput(input: TradingFixedPriceItemInput): void {
  const categoryId = String(input.categoryId ?? '').trim();
  if (!/^\d{1,10}$/.test(categoryId)) {
    throw new Error(
      'eBay primary category ID is missing or invalid. Select a valid eBay category before publishing.',
    );
  }
  if (!input.imageUrls.length) {
    throw new Error('Trading API listing requires at least one image URL');
  }
  if (!input.sku?.trim()) throw new Error('Trading API listing requires a SKU');
  if (!input.title?.trim()) throw new Error('Trading API listing requires a title');
  if (!input.description?.trim()) {
    throw new Error('Trading API listing requires a description');
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error('Trading API listing requires a positive price');
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    throw new Error('Trading API listing requires an available quantity');
  }
}

function fixedPriceItemXml(
  input: TradingFixedPriceItemInput,
  includeCompatibility: boolean,
  includeInventoryTrackingMethod = true,
): string {
  validateFixedPriceItemInput(input);
  if (
    !input.paymentProfileId ||
    !input.shippingProfileId ||
    !input.returnProfileId
  ) {
    throw new Error(
      'Trading API listing requires payment, shipping, and return business policy IDs',
    );
  }
  const coreCompatibility = toCoreCompatibilityPayload(input.compatibility);
  const pictures = input.imageUrls
    .map((url) => `      <PictureURL>${xmlText(url)}</PictureURL>`)
    .join('\n');
  const profiles = sellerProfilesXml(input);
  const specifics = itemSpecificsXml(input.itemSpecifics);
  const immediatePay =
    input.immediatePayRequired == null
      ? ''
      : `    <AutoPay>${input.immediatePayRequired ? 'true' : 'false'}</AutoPay>`;
  const bestOffer =
    input.bestOfferEnabled == null
      ? ''
      : `    <BestOfferDetails><BestOfferEnabled>${input.bestOfferEnabled ? 'true' : 'false'}</BestOfferEnabled></BestOfferDetails>`;
  const inventoryTrackingMethod = includeInventoryTrackingMethod
    ? '    <InventoryTrackingMethod>ItemID</InventoryTrackingMethod>'
    : '';

  return `<Item>
    <Title>${xmlText(input.title)}</Title>
    <Description>${xmlText(input.description)}</Description>
    <PrimaryCategory><CategoryID>${xmlText(input.categoryId.trim())}</CategoryID></PrimaryCategory>
    <ConditionID>${input.conditionId}</ConditionID>
    ${input.conditionDescription ? `<ConditionDescription>${xmlText(input.conditionDescription)}</ConditionDescription>` : ''}
    <Quantity>${Math.max(1, Math.trunc(input.quantity))}</Quantity>
    <Currency>${xmlText(input.currency)}</Currency>
    <StartPrice currencyID="${xmlText(input.currency)}">${input.price.toFixed(2)}</StartPrice>
    <ListingDuration>${xmlText(input.listingDuration ?? 'GTC')}</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <SKU>${xmlText(input.sku)}</SKU>
    <!-- Keep the seller SKU as an editable custom label; ItemID tracking is the default. -->
${inventoryTrackingMethod ? `${inventoryTrackingMethod}\n` : ''}${immediatePay ? `${immediatePay}\n` : ''}${bestOffer ? `${bestOffer}\n` : ''}    ${input.location ? `<Location>${xmlText(input.location)}</Location>` : ''}
    ${input.country ? `<Country>${xmlText(input.country)}</Country>` : ''}
    ${input.postalCode ? `<PostalCode>${xmlText(input.postalCode)}</PostalCode>` : ''}
    <PictureDetails>
${pictures}
    </PictureDetails>
${specifics}
${includeCompatibility ? compatibilityXml(coreCompatibility) : ''}
${profiles}
  </Item>`;
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
      modifiedSince?: Date;
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

    const modTimeFilter = options.modifiedSince
      ? `<ModTimeFrom>${this.formatTradingDate(options.modifiedSince)}</ModTimeFrom>`
      : '';

    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <GranularityLevel>Coarse</GranularityLevel>
  <IncludeWatchCount>true</IncludeWatchCount>
  ${modTimeFilter || `<EndTimeFrom>${endFrom}</EndTimeFrom>\n  <EndTimeTo>${endTo}</EndTimeTo>`}
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

  /** Create a new Seller Hub-editable fixed-price listing with AddFixedPriceItem. */
  async addFixedPriceItem(
    storeId: string,
    input: TradingFixedPriceItemInput,
    marketplaceId?: string | null,
  ): Promise<{ itemId: string }> {
    // Trading API validates the whole ItemCompatibilityList against the live
    // Motors vocabulary. Local fitment may contain useful but non-eBay
    // optional values such as Trim, Engine, and notes; sending those values
    // can make every row invalid and prevent the listing itself from being
    // created. Start with the validated core vehicle identity only.
    const coreCompatibility = toCoreCompatibilityPayload(input.compatibility);
    const buildBody = (
      includeCompatibility: boolean,
    ) => `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${fixedPriceItemXml(input, includeCompatibility)}
</AddFixedPriceItemRequest>`;
    let xml = await this.postTradingRequest(
      storeId,
      'AddFixedPriceItem',
      buildBody(Boolean(coreCompatibility?.compatibleProducts?.length)),
      marketplaceId,
    );
    if (
      /<Ack>\s*Failure\s*<\/Ack>/i.test(xml) &&
      isInvalidCompatibilityResponse(xml) &&
      coreCompatibility?.compatibleProducts?.length
    ) {
      this.logger.warn(
        `Trading AddFixedPriceItem rejected compatibility for SKU ${input.sku}; retrying without the compatibility block`,
      );
      // AddFixedPriceItem is atomic: eBay reports Item not listed, so a
      // second request without ItemCompatibilityList is safe and avoids
      // leaving FEBEST products unpublished because one MVL row is stale.
      xml = await this.postTradingRequest(
        storeId,
        'AddFixedPriceItem',
        buildBody(false),
        marketplaceId,
      );
    }
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const message = tradingFailureMessage(xml, 'AddFixedPriceItem failed');
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(
        code ? `AddFixedPriceItem failed (${code}): ${message}` : message,
      );
    }
    const itemId = tagValue(xml, 'ItemID');
    if (!itemId) {
      throw new Error('AddFixedPriceItem succeeded without an ItemID');
    }
    return { itemId };
  }

  /** Add up to five standard fixed-price items in one Trading API call. */
  async addFixedPriceItems(
    storeId: string,
    inputs: TradingFixedPriceItemInput[],
    marketplaceId?: string | null,
  ): Promise<TradingBatchAddResult[]> {
    if (inputs.length === 0 || inputs.length > 5) {
      throw new Error('Trading AddItems requires between one and five items');
    }

    const coreCompatibility = inputs.map((input) =>
      toCoreCompatibilityPayload(input.compatibility),
    );
    const messageIds = inputs.map((_input, index) => `batch-${index + 1}`);
    const containers = inputs
      .map(
        (input, index) => `  <AddItemRequestContainer>
    <MessageID>${messageIds[index]}</MessageID>
${fixedPriceItemXml(
  input,
  Boolean(coreCompatibility[index]?.compatibleProducts?.length),
  false,
)}
  </AddItemRequestContainer>`,
      )
      .join('\n');
    const xml = await this.postTradingRequest(
      storeId,
      'AddItems',
      `<?xml version="1.0" encoding="utf-8"?>
<AddItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${containers}
</AddItemsRequest>`,
      marketplaceId,
    );
    const responseContainers =
      xml.match(
        /<AddItemResponseContainer(?:\s[^>]*)?>[\s\S]*?<\/AddItemResponseContainer>/gi,
      ) ?? [];
    const byMessageId = new Map<string, TradingBatchAddResult>();
    for (const block of responseContainers) {
      const messageId =
        tagValue(block, 'CorrelationID') ?? tagValue(block, 'MessageID');
      if (!messageId) continue;
      const ack = tagValue(block, 'Ack')?.toLowerCase();
      const itemId = tagValue(block, 'ItemID') ?? undefined;
      const errorCode = tagValue(block, 'ErrorCode') ?? undefined;
      const error = tradingFailureMessage(block, 'AddItems item failed');
      byMessageId.set(messageId, {
        messageId,
        success: Boolean(itemId) && ack !== 'failure',
        ...(itemId ? { itemId } : {}),
        ...(errorCode ? { errorCode } : {}),
        ...(ack === 'failure' || !itemId ? { error } : {}),
      });
    }

    const overallFailure = /<Ack>\s*Failure\s*<\/Ack>/i.test(xml);
    const overallErrorCode = tagValue(xml, 'ErrorCode') ?? undefined;
    return messageIds.map((messageId) => {
      const result = byMessageId.get(messageId);
      if (result) return result;
      return {
        messageId,
        success: false,
        ...(overallErrorCode ? { errorCode: overallErrorCode } : {}),
        error: overallFailure
          ? tradingFailureMessage(xml, 'AddItems failed')
          : 'AddItems returned no result for this item',
      };
    });
  }

  /** Revise fields on a legacy fixed-price listing. */
  async reviseFixedPriceItem(
    storeId: string,
    itemId: string,
    input: TradingFixedPriceRevisionInput,
    marketplaceId?: string | null,
  ): Promise<void> {
    const fields: string[] = [];
    if (input.title != null) fields.push(`    <Title>${xmlText(input.title)}</Title>`);
    if (input.description != null) fields.push(`    <Description>${xmlText(input.description)}</Description>`);
    if (input.categoryId != null) {
      fields.push(`    <PrimaryCategory><CategoryID>${xmlText(input.categoryId)}</CategoryID></PrimaryCategory>`);
    }
    if (input.quantity != null) fields.push(`    <Quantity>${Math.max(0, Math.trunc(input.quantity))}</Quantity>`);
    if (input.price != null) {
      fields.push(`    <StartPrice currencyID="${xmlText(input.currency ?? 'USD')}">${input.price.toFixed(2)}</StartPrice>`);
    }
    if (input.imageUrls != null) {
      const pictures = input.imageUrls.map((url) => `      <PictureURL>${xmlText(url)}</PictureURL>`).join('\n');
      fields.push(`    <PictureDetails>\n${pictures}\n    </PictureDetails>`);
    }
    if (input.itemSpecifics != null) {
      const specifics = itemSpecificsXml(input.itemSpecifics).replace(/^  /gm, '    ');
      fields.push(specifics);
    }
    if (fields.length === 0) return;
    const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${xmlText(itemId)}</ItemID>
${fields.join('\n')}
  </Item>
</ReviseFixedPriceItemRequest>`;
    const xml = await this.postTradingRequest(
      storeId,
      'ReviseFixedPriceItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const message = tradingFailureMessage(xml, 'ReviseFixedPriceItem failed');
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(code ? `ReviseFixedPriceItem failed (${code}): ${message}` : message);
    }
  }

  /** Relist a previously Trading-managed fixed-price item, retaining ItemID tracking. */
  async relistFixedPriceItem(
    storeId: string,
    itemId: string,
    marketplaceId?: string | null,
  ): Promise<{ itemId: string }> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<RelistFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${xmlText(itemId)}</ItemID>
</RelistFixedPriceItemRequest>`;
    const xml = await this.postTradingRequest(
      storeId,
      'RelistFixedPriceItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const code = tagValue(xml, 'ErrorCode');
      const message = tradingFailureMessage(xml, 'RelistFixedPriceItem failed');
      throw new Error(
        code ? `RelistFixedPriceItem failed (${code}): ${message}` : message,
      );
    }
    const newItemId = tagValue(xml, 'ItemID');
    if (!newItemId) {
      throw new Error('RelistFixedPriceItem succeeded without an ItemID');
    }
    return { itemId: newItemId };
  }

  /** End a legacy fixed-price listing. */
  async endFixedPriceItem(
    storeId: string,
    itemId: string,
    marketplaceId?: string | null,
  ): Promise<void> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${xmlText(itemId)}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndFixedPriceItemRequest>`;
    const xml = await this.postTradingRequest(
      storeId,
      'EndFixedPriceItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const message = tagValue(xml, 'LongMessage') ?? 'EndFixedPriceItem failed';
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(code ? `EndFixedPriceItem failed (${code}): ${message}` : message);
    }
  }

  /**
   * Replace the complete item-level gallery with one externally hosted image.
   * ReviseItem replaces the existing PictureURL set when PictureDetails is
   * supplied, so sending exactly one URL removes the other item-level images
   * while preserving the rest of the listing fields.
   */
  async replaceListingImages(
    storeId: string,
    itemId: string,
    imageUrl: string,
    marketplaceId?: string | null,
  ): Promise<void> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
    <PictureDetails>
      <PictureURL>${escapeXml(imageUrl)}</PictureURL>
    </PictureDetails>
  </Item>
</ReviseItemRequest>`;

    const xml = await this.postTradingRequest(
      storeId,
      'ReviseItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const err =
        tagValue(xml, 'LongMessage') ?? 'ReviseItem image update failed';
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(
        code ? `ReviseItem image update failed (${code}): ${err}` : err,
      );
    }
  }

  /**
   * Replace the legacy listing compatibility list.
   *
   * ReviseItem with ItemCompatibilityList.ReplaceAll=true is intentional:
   * an empty list removes all old compatibility rows, while a non-empty list
   * replaces the old list instead of appending to it.
   */
  async replaceItemCompatibility(
    storeId: string,
    itemId: string,
    payload: EbayCompatibilityPayload,
    marketplaceId?: string | null,
    listingDetails?: {
      bestOfferEnabled?: boolean | null;
      immediatePayRequired?: boolean | null;
    },
  ): Promise<void> {
    const rows = payload.compatibleProducts ?? [];
    const compatibilityXml = rows
      .map((row) => {
        const properties = row.compatibilityProperties
          .map(
            (property) =>
              `      <NameValueList><Name>${escapeXml(property.name)}</Name><Value>${escapeXml(property.value)}</Value></NameValueList>`,
          )
          .join('\n');
        const notes = row.notes
          ? `\n      <CompatibilityNotes>${escapeXml(row.notes)}</CompatibilityNotes>`
          : '';
        return `    <Compatibility>\n${properties}${notes}\n    </Compatibility>`;
      })
      .join('\n');
    const legacyBestOfferConflict =
      listingDetails?.bestOfferEnabled === true &&
      listingDetails.immediatePayRequired === true;
    if (legacyBestOfferConflict) {
      this.logger.warn(
        `ReviseItem ${itemId}: legacy Best Offer/AutoPay conflict; will use fixed-price revise fallback if needed`,
      );
    }

    const buildBody = (
      requestName: 'ReviseItemRequest' | 'ReviseFixedPriceItemRequest',
    ) => `<?xml version="1.0" encoding="utf-8"?>
<${requestName} xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
    <ItemCompatibilityList>
      <ReplaceAll>true</ReplaceAll>
${compatibilityXml}
    </ItemCompatibilityList>
  </Item>
  </${requestName}>`;

    const submit = async (
      callName: 'ReviseItem' | 'ReviseFixedPriceItem',
      requestName: 'ReviseItemRequest' | 'ReviseFixedPriceItemRequest',
    ) => {
      const xml = await this.postTradingRequest(
        storeId,
        callName,
        buildBody(requestName),
        marketplaceId,
      );
      if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
        const err = tagValue(xml, 'LongMessage') ?? `${callName} failed`;
        const code = tagValue(xml, 'ErrorCode');
        throw new Error(code ? `${callName} failed (${code}): ${err}` : err);
      }
    };

    const submitItemFields = async (fieldsXml: string, description: string) => {
      const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
${fieldsXml}
  </Item>
</ReviseItemRequest>`;
      const xml = await this.postTradingRequest(
        storeId,
        'ReviseItem',
        body,
        marketplaceId,
      );
      if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
        const err = tagValue(xml, 'LongMessage') ?? `${description} failed`;
        const code = tagValue(xml, 'ErrorCode');
        throw new Error(code ? `${description} failed (${code}): ${err}` : err);
      }
    };

    if (legacyBestOfferConflict) {
      // eBay validates the existing payment flags before it processes a
      // compatibility-only revise. Temporarily remove Best Offer, clear the
      // contradictory AutoPay flag, then restore Best Offer after the list is
      // replaced. This preserves the seller's original listing behavior.
      await submitItemFields(
        '    <BestOfferDetails><BestOfferEnabled>false</BestOfferEnabled></BestOfferDetails>',
        'ReviseItem Best Offer disable',
      );
      await submitItemFields(
        '    <AutoPay>false</AutoPay>',
        'ReviseItem AutoPay clear',
      );
      this.logger.log(`Cleared legacy AutoPay for item ${itemId}`);
    }

    try {
      await submit('ReviseItem', 'ReviseItemRequest');
    } catch (error) {
      if (!legacyBestOfferConflict || !String(error).includes('(23015)')) {
        throw error;
      }
      // Some old fixed-price listings retain an invalid AutoPay=true flag
      // alongside Best Offer. ReviseFixedPriceItem accepts the compatibility
      // replacement without revalidating that legacy payment combination.
      this.logger.warn(
        `ReviseItem ${itemId}: retrying compatibility replacement with ReviseFixedPriceItem`,
      );
      await submit('ReviseFixedPriceItem', 'ReviseFixedPriceItemRequest');
    }
    if (legacyBestOfferConflict) {
      await submitItemFields(
        '    <BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>',
        'ReviseItem Best Offer restore',
      );
      this.logger.log(`Restored Best Offer for item ${itemId}`);
    }
    this.logger.log(
      `Replaced ${rows.length} legacy compatibility row(s) for item ${itemId}`,
    );
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
    modifiedSince?: Date,
  ): Promise<TradingSellerListItem[]> {
    const byId = new Map<string, TradingSellerListItem>();
    let page = 1;
    for (;;) {
      const result = await this.getSellerList(storeId, {
        page,
        entriesPerPage: 200,
        marketplaceId,
        modifiedSince,
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
    modifiedSince?: Date,
  ): Promise<TradingSellerListItem[]> {
    const byId = new Map<string, TradingSellerListItem>();

    try {
      const sellerList = await this.getAllSellerListListings(
        storeId,
        marketplaceId,
        modifiedSince,
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
      const activeList = await this.getAllActiveListings(
        storeId,
        marketplaceId,
      );
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

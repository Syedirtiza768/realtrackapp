"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EbayTradingApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTradingApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const ebay_trading_get_item_util_js_1 = require("./ebay-trading-get-item.util.js");
const fitment_mvl_util_js_1 = require("../../fitment/fitment-mvl.util.js");
const MARKETPLACE_SITE_ID = {
    EBAY_US: 0,
    EBAY_MOTORS_US: 100,
    EBAY_GB: 3,
    EBAY_DE: 77,
    EBAY_AU: 15,
};
function tagValue(block, tag) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    const raw = m?.[1]?.trim() ?? null;
    if (!raw)
        return null;
    return raw.replace(/^<!\[CDATA\[|\]\]>$/g, '');
}
function tradingPolicyReason(xml) {
    const parameters = xml.match(/<ErrorParameters\b[^>]*>([\s\S]*?)<\/ErrorParameters>/i)?.[1];
    const raw = parameters ? tagValue(parameters, 'Value') : null;
    if (!raw)
        return null;
    const text = raw
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&apos;/g, "'")
        .replace(/<[^>]*>/g, ' ')
        .replace(/\{e\d+-\d+x\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text || null;
}
function tradingFailureMessage(xml, fallback) {
    const details = [
        tagValue(xml, 'LongMessage'),
        tagValue(xml, 'Message'),
        tagValue(xml, 'ShortMessage'),
    ].filter((value) => Boolean(value));
    if (tagValue(xml, 'ErrorCode') === '240') {
        const reason = tradingPolicyReason(xml);
        if (reason)
            details.unshift(`eBay policy block: ${reason}`);
    }
    return [...new Set(details)].join(' — ') || fallback;
}
function fixedPriceRevisionFields(input) {
    const fields = [];
    if (input.title != null) {
        fields.push(`    <Title>${xmlText(input.title)}</Title>`);
    }
    if (input.description != null) {
        fields.push(`    <Description>${xmlText(input.description)}</Description>`);
    }
    if (input.categoryId != null) {
        fields.push(`    <PrimaryCategory><CategoryID>${xmlText(input.categoryId)}</CategoryID></PrimaryCategory>`);
    }
    if (input.quantity != null) {
        fields.push(`    <Quantity>${Math.max(0, Math.trunc(input.quantity))}</Quantity>`);
    }
    if (input.price != null) {
        fields.push(`    <StartPrice currencyID="${xmlText(input.currency ?? 'USD')}">${input.price.toFixed(2)}</StartPrice>`);
    }
    if (input.imageUrls != null) {
        const pictures = input.imageUrls
            .map((url) => `      <PictureURL>${xmlText(url)}</PictureURL>`)
            .join('\n');
        fields.push(`    <PictureDetails>\n${pictures}\n    </PictureDetails>`);
    }
    if (input.itemSpecifics != null) {
        const specifics = itemSpecificsXml(input.itemSpecifics).replace(/^ {2}/gm, '    ');
        fields.push(specifics);
    }
    return fields;
}
function buildFixedPriceListingRequest(callName, itemId, input) {
    const fields = fixedPriceRevisionFields(input);
    return `<?xml version="1.0" encoding="utf-8"?>
<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${xmlText(itemId)}</ItemID>
${fields.join('\n')}
  </Item>
</${callName}Request>`;
}
function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
function xmlText(value) {
    return escapeXml(value);
}
function sellerProfilesXml(input) {
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
function itemSpecificsXml(aspects) {
    const rows = Object.entries(aspects ?? {}).flatMap(([name, values]) => (values ?? []).map((value) => `    <NameValueList><Name>${xmlText(name)}</Name><Value>${xmlText(String(value))}</Value></NameValueList>`));
    return rows.length ? `  <ItemSpecifics>\n${rows.join('\n')}\n  </ItemSpecifics>` : '';
}
function compatibilityXml(payload) {
    const rows = (payload?.compatibleProducts ?? []).map((row) => {
        const properties = row.compatibilityProperties
            .map((property) => `      <NameValueList><Name>${xmlText(property.name)}</Name><Value>${xmlText(property.value)}</Value></NameValueList>`)
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
function isInvalidCompatibilityResponse(xml) {
    return (/<ErrorCode>\s*21917122\s*<\/ErrorCode>/i.test(xml) ||
        /all compatibilities are invalid/i.test(xml));
}
function validateFixedPriceItemInput(input) {
    const categoryId = String(input.categoryId ?? '').trim();
    if (!/^\d{1,10}$/.test(categoryId)) {
        throw new Error('eBay primary category ID is missing or invalid. Select a valid eBay category before publishing.');
    }
    if (!input.imageUrls.length) {
        throw new Error('Trading API listing requires at least one image URL');
    }
    if (!input.sku?.trim())
        throw new Error('Trading API listing requires a SKU');
    if (!input.title?.trim())
        throw new Error('Trading API listing requires a title');
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
function fixedPriceItemXml(input, includeCompatibility, includeInventoryTrackingMethod = true) {
    validateFixedPriceItemInput(input);
    if (!input.paymentProfileId ||
        !input.shippingProfileId ||
        !input.returnProfileId) {
        throw new Error('Trading API listing requires payment, shipping, and return business policy IDs');
    }
    const coreCompatibility = (0, fitment_mvl_util_js_1.toCoreCompatibilityPayload)(input.compatibility);
    const pictures = input.imageUrls
        .map((url) => `      <PictureURL>${xmlText(url)}</PictureURL>`)
        .join('\n');
    const profiles = sellerProfilesXml(input);
    const specifics = itemSpecificsXml(input.itemSpecifics);
    const immediatePay = input.immediatePayRequired == null
        ? ''
        : `    <AutoPay>${input.immediatePayRequired ? 'true' : 'false'}</AutoPay>`;
    const bestOffer = input.bestOfferEnabled == null
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
function parseActiveListItems(xml) {
    const section = xml.match(/<ActiveList>[\s\S]*?<\/ActiveList>/i)?.[0];
    if (!section)
        return [];
    return parseItems(section);
}
function parseItems(xml) {
    const items = [];
    const blocks = xml.match(/<Item>[\s\S]*?<\/Item>/gi) ?? [];
    for (const block of blocks) {
        const itemId = tagValue(block, 'ItemID');
        const title = tagValue(block, 'Title');
        if (!itemId || !title)
            continue;
        const sku = tagValue(block, 'SKU');
        const qty = Number(tagValue(block, 'Quantity') ?? '0');
        const sold = Number(tagValue(block, 'QuantitySold') ?? '0');
        const priceStr = tagValue(block, 'CurrentPrice') ??
            tagValue(block, 'BuyItNowPrice') ??
            tagValue(block, 'StartPrice');
        const currency = block.match(/currencyID="([^"]+)"/i)?.[1] ??
            block.match(/<CurrentPrice currencyID="([^"]+)"/i)?.[1] ??
            'USD';
        const listingType = tagValue(block, 'ListingType') ?? 'FixedPriceItem';
        const listingStatus = tagValue(block, 'ListingStatus') ?? 'Active';
        const condition = tagValue(block, 'ConditionDisplayName');
        const categoryId = tagValue(block, 'PrimaryCategoryID');
        const imageUrls = (0, ebay_trading_get_item_util_js_1.parsePictureUrls)(block);
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
let EbayTradingApiService = EbayTradingApiService_1 = class EbayTradingApiService {
    auth;
    logger = new common_1.Logger(EbayTradingApiService_1.name);
    http;
    constructor(auth) {
        this.auth = auth;
        const config = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: config.baseUrl.replace('/buy', '').replace(/\/$/, ''),
            timeout: 60_000,
        });
    }
    tradingUrl() {
        const config = this.auth.getApiConfig();
        return `${config.baseUrl}/ws/api.dll`;
    }
    resolveSiteId(marketplaceId) {
        if (!marketplaceId)
            return 0;
        return MARKETPLACE_SITE_ID[marketplaceId] ?? 0;
    }
    formatTradingDate(date) {
        return date.toISOString().replace(/\.\d{3}Z$/, '.000Z');
    }
    async postTradingRequest(storeId, callName, body, marketplaceId) {
        const token = await this.auth.getAccessToken(storeId);
        const siteId = this.resolveSiteId(marketplaceId);
        const { data } = await this.http.post(this.tradingUrl(), body, {
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
    async getMyeBaySellingActiveList(storeId, options = {}) {
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
        const xml = await this.postTradingRequest(storeId, 'GetMyeBaySelling', body, options.marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const err = tagValue(xml, 'LongMessage') ?? 'GetMyeBaySelling failed';
            this.logger.warn(`Trading API GetMyeBaySelling failed for store ${storeId}: ${err}`);
            throw new Error(err);
        }
        const items = parseActiveListItems(xml);
        const activeSection = xml.match(/<ActiveList>[\s\S]*?<\/ActiveList>/i)?.[0] ?? xml;
        const totalPages = Number(tagValue(activeSection, 'TotalNumberOfPages') ?? '1');
        return {
            items,
            totalPages: Number.isFinite(totalPages) ? totalPages : 1,
            page,
            hasMore: page < totalPages,
        };
    }
    async getSellerList(storeId, options = {}) {
        const page = options.page ?? 1;
        const entriesPerPage = Math.min(options.entriesPerPage ?? 200, 200);
        const now = new Date();
        const endFrom = this.formatTradingDate(now);
        const endTo = this.formatTradingDate(new Date(now.getTime() + 119 * 24 * 60 * 60 * 1000));
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
        const xml = await this.postTradingRequest(storeId, 'GetSellerList', body, options.marketplaceId);
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
    async getItemDetails(storeId, itemId, marketplaceId) {
        const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeItemCompatibilityList>true</IncludeItemCompatibilityList>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
</GetItemRequest>`;
        const xml = await this.postTradingRequest(storeId, 'GetItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const err = tagValue(xml, 'LongMessage') ?? 'GetItem failed';
            throw new Error(err);
        }
        return (0, ebay_trading_get_item_util_js_1.parseTradingGetItemResponse)(xml);
    }
    async addFixedPriceItem(storeId, input, marketplaceId) {
        const coreCompatibility = (0, fitment_mvl_util_js_1.toCoreCompatibilityPayload)(input.compatibility);
        const buildBody = (includeCompatibility) => `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${fixedPriceItemXml(input, includeCompatibility)}
</AddFixedPriceItemRequest>`;
        let xml = await this.postTradingRequest(storeId, 'AddFixedPriceItem', buildBody(Boolean(coreCompatibility?.compatibleProducts?.length)), marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml) &&
            isInvalidCompatibilityResponse(xml) &&
            coreCompatibility?.compatibleProducts?.length) {
            this.logger.warn(`Trading AddFixedPriceItem rejected compatibility for SKU ${input.sku}; retrying without the compatibility block`);
            xml = await this.postTradingRequest(storeId, 'AddFixedPriceItem', buildBody(false), marketplaceId);
        }
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const message = tradingFailureMessage(xml, 'AddFixedPriceItem failed');
            const code = tagValue(xml, 'ErrorCode');
            throw new Error(code ? `AddFixedPriceItem failed (${code}): ${message}` : message);
        }
        const itemId = tagValue(xml, 'ItemID');
        if (!itemId) {
            throw new Error('AddFixedPriceItem succeeded without an ItemID');
        }
        return { itemId };
    }
    async addFixedPriceItems(storeId, inputs, marketplaceId) {
        if (inputs.length === 0 || inputs.length > 5) {
            throw new Error('Trading AddItems requires between one and five items');
        }
        const coreCompatibility = inputs.map((input) => (0, fitment_mvl_util_js_1.toCoreCompatibilityPayload)(input.compatibility));
        const messageIds = inputs.map((_input, index) => `batch-${index + 1}`);
        const containers = inputs
            .map((input, index) => `  <AddItemRequestContainer>
    <MessageID>${messageIds[index]}</MessageID>
${fixedPriceItemXml(input, Boolean(coreCompatibility[index]?.compatibleProducts?.length), false)}
  </AddItemRequestContainer>`)
            .join('\n');
        const xml = await this.postTradingRequest(storeId, 'AddItems', `<?xml version="1.0" encoding="utf-8"?>
<AddItemsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${containers}
</AddItemsRequest>`, marketplaceId);
        const responseContainers = xml.match(/<AddItemResponseContainer(?:\s[^>]*)?>[\s\S]*?<\/AddItemResponseContainer>/gi) ?? [];
        const byMessageId = new Map();
        for (const block of responseContainers) {
            const messageId = tagValue(block, 'CorrelationID') ?? tagValue(block, 'MessageID');
            if (!messageId)
                continue;
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
            if (result)
                return result;
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
    async reviseFixedPriceItem(storeId, itemId, input, marketplaceId) {
        const fields = [];
        if (input.title != null)
            fields.push(`    <Title>${xmlText(input.title)}</Title>`);
        if (input.description != null)
            fields.push(`    <Description>${xmlText(input.description)}</Description>`);
        if (input.categoryId != null) {
            fields.push(`    <PrimaryCategory><CategoryID>${xmlText(input.categoryId)}</CategoryID></PrimaryCategory>`);
        }
        if (input.quantity != null)
            fields.push(`    <Quantity>${Math.max(0, Math.trunc(input.quantity))}</Quantity>`);
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
        if (fields.length === 0)
            return;
        const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${xmlText(itemId)}</ItemID>
${fields.join('\n')}
  </Item>
</ReviseFixedPriceItemRequest>`;
        const xml = await this.postTradingRequest(storeId, 'ReviseFixedPriceItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const message = tradingFailureMessage(xml, 'ReviseFixedPriceItem failed');
            const code = tagValue(xml, 'ErrorCode');
            throw new Error(code ? `ReviseFixedPriceItem failed (${code}): ${message}` : message);
        }
    }
    async relistFixedPriceItem(storeId, itemId, marketplaceId) {
        const body = `<?xml version="1.0" encoding="utf-8"?>
<RelistFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${xmlText(itemId)}</ItemID>
</RelistFixedPriceItemRequest>`;
        const xml = await this.postTradingRequest(storeId, 'RelistFixedPriceItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const code = tagValue(xml, 'ErrorCode');
            const message = tradingFailureMessage(xml, 'RelistFixedPriceItem failed');
            throw new Error(code ? `RelistFixedPriceItem failed (${code}): ${message}` : message);
        }
        const newItemId = tagValue(xml, 'ItemID');
        if (!newItemId) {
            throw new Error('RelistFixedPriceItem succeeded without an ItemID');
        }
        return { itemId: newItemId };
    }
    async endFixedPriceItem(storeId, itemId, marketplaceId) {
        const body = `<?xml version="1.0" encoding="utf-8"?>
<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${xmlText(itemId)}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndFixedPriceItemRequest>`;
        const xml = await this.postTradingRequest(storeId, 'EndFixedPriceItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const message = tagValue(xml, 'LongMessage') ?? 'EndFixedPriceItem failed';
            const code = tagValue(xml, 'ErrorCode');
            throw new Error(code ? `EndFixedPriceItem failed (${code}): ${message}` : message);
        }
    }
    async replaceListingImages(storeId, itemId, imageUrl, marketplaceId) {
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
        const xml = await this.postTradingRequest(storeId, 'ReviseItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const err = tagValue(xml, 'LongMessage') ?? 'ReviseItem image update failed';
            const code = tagValue(xml, 'ErrorCode');
            throw new Error(code ? `ReviseItem image update failed (${code}): ${err}` : err);
        }
    }
    async replaceItemCompatibility(storeId, itemId, payload, marketplaceId, listingDetails) {
        const rows = payload.compatibleProducts ?? [];
        const compatibilityXml = rows
            .map((row) => {
            const properties = row.compatibilityProperties
                .map((property) => `      <NameValueList><Name>${escapeXml(property.name)}</Name><Value>${escapeXml(property.value)}</Value></NameValueList>`)
                .join('\n');
            const notes = row.notes
                ? `\n      <CompatibilityNotes>${escapeXml(row.notes)}</CompatibilityNotes>`
                : '';
            return `    <Compatibility>\n${properties}${notes}\n    </Compatibility>`;
        })
            .join('\n');
        const legacyBestOfferConflict = listingDetails?.bestOfferEnabled === true &&
            listingDetails.immediatePayRequired === true;
        if (legacyBestOfferConflict) {
            this.logger.warn(`ReviseItem ${itemId}: legacy Best Offer/AutoPay conflict; will use fixed-price revise fallback if needed`);
        }
        const buildBody = (requestName) => `<?xml version="1.0" encoding="utf-8"?>
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
        const submit = async (callName, requestName) => {
            const xml = await this.postTradingRequest(storeId, callName, buildBody(requestName), marketplaceId);
            if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
                const err = tagValue(xml, 'LongMessage') ?? `${callName} failed`;
                const code = tagValue(xml, 'ErrorCode');
                throw new Error(code ? `${callName} failed (${code}): ${err}` : err);
            }
        };
        const submitItemFields = async (fieldsXml, description) => {
            const body = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <ItemID>${escapeXml(itemId)}</ItemID>
${fieldsXml}
  </Item>
</ReviseItemRequest>`;
            const xml = await this.postTradingRequest(storeId, 'ReviseItem', body, marketplaceId);
            if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
                const err = tagValue(xml, 'LongMessage') ?? `${description} failed`;
                const code = tagValue(xml, 'ErrorCode');
                throw new Error(code ? `${description} failed (${code}): ${err}` : err);
            }
        };
        if (legacyBestOfferConflict) {
            await submitItemFields('    <BestOfferDetails><BestOfferEnabled>false</BestOfferEnabled></BestOfferDetails>', 'ReviseItem Best Offer disable');
            await submitItemFields('    <AutoPay>false</AutoPay>', 'ReviseItem AutoPay clear');
            this.logger.log(`Cleared legacy AutoPay for item ${itemId}`);
        }
        try {
            await submit('ReviseItem', 'ReviseItemRequest');
        }
        catch (error) {
            if (!legacyBestOfferConflict || !String(error).includes('(23015)')) {
                throw error;
            }
            this.logger.warn(`ReviseItem ${itemId}: retrying compatibility replacement with ReviseFixedPriceItem`);
            await submit('ReviseFixedPriceItem', 'ReviseFixedPriceItemRequest');
        }
        if (legacyBestOfferConflict) {
            await submitItemFields('    <BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>', 'ReviseItem Best Offer restore');
            this.logger.log(`Restored Best Offer for item ${itemId}`);
        }
        this.logger.log(`Replaced ${rows.length} legacy compatibility row(s) for item ${itemId}`);
    }
    async getAllActiveListings(storeId, marketplaceId) {
        const all = [];
        let page = 1;
        for (;;) {
            const result = await this.getMyeBaySellingActiveList(storeId, {
                page,
                entriesPerPage: 200,
                marketplaceId,
            });
            all.push(...result.items.filter((i) => i.listingStatus.toLowerCase() === 'active'));
            if (!result.hasMore)
                break;
            page += 1;
            if (page > 500) {
                this.logger.warn(`Trading API ActiveList pagination capped at page 500 for store ${storeId}`);
                break;
            }
        }
        return all;
    }
    async getAllSellerListListings(storeId, marketplaceId, modifiedSince) {
        const byId = new Map();
        let page = 1;
        for (;;) {
            const result = await this.getSellerList(storeId, {
                page,
                entriesPerPage: 200,
                marketplaceId,
                modifiedSince,
            });
            for (const item of result.items) {
                if (item.listingStatus.toLowerCase() !== 'active')
                    continue;
                byId.set(item.itemId, item);
            }
            if (!result.hasMore)
                break;
            page += 1;
            if (page > 1000) {
                this.logger.warn(`Trading API GetSellerList pagination capped at page 1000 for store ${storeId}`);
                break;
            }
        }
        return [...byId.values()];
    }
    async getAllLiveListings(storeId, marketplaceId, modifiedSince) {
        const byId = new Map();
        try {
            const sellerList = await this.getAllSellerListListings(storeId, marketplaceId, modifiedSince);
            for (const item of sellerList)
                byId.set(item.itemId, item);
            this.logger.log(`GetSellerList returned ${sellerList.length} active listing(s) for store ${storeId}`);
        }
        catch (e) {
            this.logger.warn(`GetSellerList failed for store ${storeId}: ${e instanceof Error ? e.message : String(e)} — falling back to ActiveList only`);
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
            this.logger.log(`ActiveList returned ${activeList.length} active listing(s) for store ${storeId} (${added} new after merge)`);
        }
        catch (e) {
            if (byId.size === 0)
                throw e;
            this.logger.warn(`ActiveList merge skipped for store ${storeId}: ${e instanceof Error ? e.message : String(e)}`);
        }
        return [...byId.values()];
    }
};
exports.EbayTradingApiService = EbayTradingApiService;
exports.EbayTradingApiService = EbayTradingApiService = EbayTradingApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbayTradingApiService);
//# sourceMappingURL=ebay-trading-api.service.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbayTradingPublishService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const ebay_auth_service_js_1 = require("./ebay-auth.service.js");
const SITE_IDS = {
    EBAY_US: 0,
    EBAY_MOTORS_US: 100,
    EBAY_GB: 3,
    EBAY_DE: 77,
    EBAY_AU: 15,
};
function tagValue(xml, tag) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    return match?.[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '') || null;
}
function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
function specificsXml(aspects) {
    const rows = Object.entries(aspects ?? {}).flatMap(([name, values]) => (values ?? []).map((value) => `    <NameValueList><Name>${escapeXml(name)}</Name><Value>${escapeXml(String(value))}</Value></NameValueList>`));
    return rows.length ? `  <ItemSpecifics>\n${rows.join('\n')}\n  </ItemSpecifics>` : '';
}
function compatibilityXml(payload) {
    const rows = (payload?.compatibleProducts ?? []).map((row) => {
        const properties = row.compatibilityProperties
            .map((property) => `      <NameValueList><Name>${escapeXml(property.name)}</Name><Value>${escapeXml(property.value)}</Value></NameValueList>`)
            .join('\n');
        const notes = row.notes
            ? `\n      <CompatibilityNotes>${escapeXml(row.notes)}</CompatibilityNotes>`
            : '';
        return `    <Compatibility>\n${properties}${notes}\n    </Compatibility>`;
    });
    return rows.length
        ? `  <ItemCompatibilityList>\n${rows.join('\n')}\n  </ItemCompatibilityList>`
        : '';
}
let EbayTradingPublishService = class EbayTradingPublishService {
    auth;
    http;
    constructor(auth) {
        this.auth = auth;
        const config = this.auth.getApiConfig();
        this.http = axios_1.default.create({
            baseURL: config.baseUrl.replace('/buy', '').replace(/\/$/, ''),
            timeout: 60_000,
        });
    }
    async post(storeId, callName, body, marketplaceId) {
        const token = await this.auth.getAccessToken(storeId);
        const config = this.auth.getApiConfig();
        const { data } = await this.http.post(`${config.baseUrl}/ws/api.dll`, body, {
            headers: {
                'Content-Type': 'text/xml',
                'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                'X-EBAY-API-CALL-NAME': callName,
                'X-EBAY-API-SITEID': String(SITE_IDS[marketplaceId] ?? 0),
                'X-EBAY-API-IAF-TOKEN': token,
            },
            responseType: 'text',
            transformResponse: [(value) => value],
        });
        return String(data);
    }
    async addFixedPriceItem(storeId, input, marketplaceId) {
        if (!input.imageUrls.length) {
            throw new Error('Trading API listing requires at least one image URL');
        }
        const pictures = input.imageUrls
            .map((url) => `      <PictureURL>${escapeXml(url)}</PictureURL>`)
            .join('\n');
        const profiles = [
            input.paymentProfileId
                ? `    <SellerPaymentProfile><PaymentProfileID>${escapeXml(input.paymentProfileId)}</PaymentProfileID></SellerPaymentProfile>`
                : '',
            input.shippingProfileId
                ? `    <SellerShippingProfile><ShippingProfileID>${escapeXml(input.shippingProfileId)}</ShippingProfileID></SellerShippingProfile>`
                : '',
            input.returnProfileId
                ? `    <SellerReturnProfile><ReturnProfileID>${escapeXml(input.returnProfileId)}</ReturnProfileID></SellerReturnProfile>`
                : '',
        ].filter(Boolean);
        const sellerProfiles = profiles.length
            ? `  <SellerProfiles>\n${profiles.join('\n')}\n  </SellerProfiles>`
            : '';
        const body = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${escapeXml(input.title)}</Title>
    <Description>${escapeXml(input.description)}</Description>
    <PrimaryCategory><CategoryID>${escapeXml(input.categoryId)}</CategoryID></PrimaryCategory>
    <ConditionID>${input.conditionId}</ConditionID>
    ${input.conditionDescription ? `<ConditionDescription>${escapeXml(input.conditionDescription)}</ConditionDescription>` : ''}
    <Quantity>${Math.max(1, Math.trunc(input.quantity))}</Quantity>
    <Currency>${escapeXml(input.currency)}</Currency>
    <StartPrice currencyID="${escapeXml(input.currency)}">${input.price.toFixed(2)}</StartPrice>
    <ListingDuration>${escapeXml(input.listingDuration ?? 'GTC')}</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <SKU>${escapeXml(input.sku)}</SKU>
    <!-- Keep seller SKU editable as a custom label; identify the listing by ItemID. -->
    <InventoryTrackingMethod>ItemID</InventoryTrackingMethod>
    <Location>${escapeXml(input.location)}</Location>
    <Country>${escapeXml(input.country)}</Country>
    ${input.postalCode ? `<PostalCode>${escapeXml(input.postalCode)}</PostalCode>` : ''}
    <PictureDetails>
${pictures}
    </PictureDetails>
${specificsXml(input.itemSpecifics)}
${compatibilityXml(input.compatibility)}
${sellerProfiles}
  </Item>
</AddFixedPriceItemRequest>`;
        const xml = await this.post(storeId, 'AddFixedPriceItem', body, marketplaceId);
        if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
            const message = tagValue(xml, 'LongMessage') ?? 'AddFixedPriceItem failed';
            const code = tagValue(xml, 'ErrorCode');
            throw new Error(code ? `AddFixedPriceItem failed (${code}): ${message}` : message);
        }
        const itemId = tagValue(xml, 'ItemID');
        if (!itemId)
            throw new Error('AddFixedPriceItem succeeded without an ItemID');
        return { itemId };
    }
};
exports.EbayTradingPublishService = EbayTradingPublishService;
exports.EbayTradingPublishService = EbayTradingPublishService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ebay_auth_service_js_1.EbayAuthService])
], EbayTradingPublishService);
//# sourceMappingURL=ebay-trading-publish.service.js.map
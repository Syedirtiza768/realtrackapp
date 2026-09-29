import { Injectable } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EbayAuthService } from './ebay-auth.service.js';
import type { EbayCompatibilityPayload } from './ebay-api.types.js';

export interface TradingPublishInput {
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
  location: string;
  country: string;
  postalCode?: string | null;
  conditionDescription?: string | null;
  paymentProfileId?: string | null;
  shippingProfileId?: string | null;
  returnProfileId?: string | null;
}

export interface TradingRevisionInput {
  title?: string;
  description?: string;
  price?: number;
  quantity?: number;
  currency?: string;
  imageUrls?: string[];
  itemSpecifics?: Record<string, string[]>;
  paymentProfileId?: string | null;
  shippingProfileId?: string | null;
  returnProfileId?: string | null;
}

const SITE_IDS: Record<string, number> = {
  EBAY_US: 0,
  EBAY_MOTORS_US: 100,
  EBAY_GB: 3,
  EBAY_DE: 77,
  EBAY_AU: 15,
};

function tagValue(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'),
  );
  return match?.[1]?.trim().replace(/^<!\[CDATA\[|\]\]>$/g, '') || null;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function specificsXml(aspects: Record<string, string[]> | undefined): string {
  const rows = Object.entries(aspects ?? {}).flatMap(([name, values]) =>
    (values ?? []).map(
      (value) =>
        `    <NameValueList><Name>${escapeXml(name)}</Name><Value>${escapeXml(String(value))}</Value></NameValueList>`,
    ),
  );
  return rows.length ? `  <ItemSpecifics>\n${rows.join('\n')}\n  </ItemSpecifics>` : '';
}

function compatibilityXml(
  payload: EbayCompatibilityPayload | null | undefined,
): string {
  const rows = (payload?.compatibleProducts ?? []).map((row) => {
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
  });
  return rows.length
    ? `  <ItemCompatibilityList>\n${rows.join('\n')}\n  </ItemCompatibilityList>`
    : '';
}

@Injectable()
export class EbayTradingPublishService {
  private readonly http: AxiosInstance;

  constructor(private readonly auth: EbayAuthService) {
    const config = this.auth.getApiConfig();
    this.http = axios.create({
      baseURL: config.baseUrl.replace('/buy', '').replace(/\/$/, ''),
      timeout: 60_000,
    });
  }

  private async post(
    storeId: string,
    callName: string,
    body: string,
    marketplaceId: string,
  ): Promise<string> {
    const token = await this.auth.getAccessToken(storeId);
    const config = this.auth.getApiConfig();
    const { data } = await this.http.post<string>(
      `${config.baseUrl}/ws/api.dll`,
      body,
      {
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-CALL-NAME': callName,
          'X-EBAY-API-SITEID': String(SITE_IDS[marketplaceId] ?? 0),
          'X-EBAY-API-IAF-TOKEN': token,
        },
        responseType: 'text',
        transformResponse: [(value) => value],
      },
    );
    return String(data);
  }

  async addFixedPriceItem(
    storeId: string,
    input: TradingPublishInput,
    marketplaceId: string,
  ): Promise<{ itemId: string }> {
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
    const isFebest = Object.entries(input.itemSpecifics ?? {}).some(([name, values]) =>
      /^(brand|manufacturer|hersteller)$/i.test(name.trim()) &&
      (values ?? []).some((value) => String(value).trim().toLowerCase() === "febest"),
    );
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
    <InventoryTrackingMethod>SKU</InventoryTrackingMethod>
    <Location>${escapeXml(input.location)}</Location>
    <Country>${escapeXml(input.country)}</Country>
    ${input.postalCode ? `<PostalCode>${escapeXml(input.postalCode)}</PostalCode>` : ''}
    <PictureDetails>
${pictures}
    </PictureDetails>
${specificsXml(input.itemSpecifics)}
${isFebest ? "" : compatibilityXml(input.compatibility)}
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
    if (!itemId) throw new Error('AddFixedPriceItem succeeded without an ItemID');
    return { itemId };
  }

  async reviseFixedPriceItem(
    storeId: string,
    itemId: string,
    input: TradingRevisionInput,
    marketplaceId: string,
  ): Promise<void> {
    const fields: string[] = [];
    if (input.title !== undefined) {
      fields.push('    <Title>' + escapeXml(input.title) + '</Title>');
    }
    if (input.description !== undefined) {
      fields.push(
        '    <Description>' +
          escapeXml(input.description) +
          '</Description>',
      );
    }
    if (input.quantity !== undefined) {
      fields.push(
        '    <Quantity>' +
          String(Math.max(0, Math.trunc(input.quantity))) +
          '</Quantity>',
      );
    }
    if (input.price !== undefined) {
      const currency = input.currency ?? 'USD';
      fields.push(
        '    <StartPrice currencyID="' +
          escapeXml(currency) +
          '">' +
          input.price.toFixed(2) +
          '</StartPrice>',
      );
    }
    if (input.imageUrls !== undefined) {
      if (!input.imageUrls.length) {
        throw new Error('Trading API revision requires at least one image URL');
      }
      const pictures = input.imageUrls
        .map(
          (url) =>
            '      <PictureURL>' +
            escapeXml(url) +
            '</PictureURL>',
        )
        .join('\n');
      fields.push('    <PictureDetails>\n' + pictures + '\n    </PictureDetails>');
    }
    if (input.itemSpecifics !== undefined) {
      const rows = Object.entries(input.itemSpecifics).flatMap(([name, values]) =>
        (values ?? []).map(
          (value) =>
            '      <NameValueList><Name>' +
            escapeXml(name) +
            '</Name><Value>' +
            escapeXml(String(value)) +
            '</Value></NameValueList>',
        ),
      );
      fields.push(
        rows.length
          ? '    <ItemSpecifics>\n' + rows.join('\n') + '\n    </ItemSpecifics>'
          : '    <ItemSpecifics />',
      );
    }
    const profiles = [
      input.paymentProfileId
        ? '      <SellerPaymentProfile><PaymentProfileID>' +
          escapeXml(input.paymentProfileId) +
          '</PaymentProfileID></SellerPaymentProfile>'
        : '',
      input.shippingProfileId
        ? '      <SellerShippingProfile><ShippingProfileID>' +
          escapeXml(input.shippingProfileId) +
          '</ShippingProfileID></SellerShippingProfile>'
        : '',
      input.returnProfileId
        ? '      <SellerReturnProfile><ReturnProfileID>' +
          escapeXml(input.returnProfileId) +
          '</ReturnProfileID></SellerReturnProfile>'
        : '',
    ].filter(Boolean);
    if (profiles.length) {
      fields.push(
        '    <SellerProfiles>\n' +
          profiles.join('\n') +
          '\n    </SellerProfiles>',
      );
    }
    if (!fields.length) return;

    const body = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
      '  <ErrorLanguage>en_US</ErrorLanguage>',
      '  <WarningLevel>High</WarningLevel>',
      '  <Item>',
      '    <ItemID>' + escapeXml(itemId) + '</ItemID>',
      fields.join('\n'),
      '  </Item>',
      '</ReviseFixedPriceItemRequest>',
    ].join('\n');
    const xml = await this.post(
      storeId,
      'ReviseFixedPriceItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const message =
        tagValue(xml, 'LongMessage') ?? 'ReviseFixedPriceItem failed';
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(
        code
          ? 'ReviseFixedPriceItem failed (' + code + '): ' + message
          : message,
      );
    }
  }

  async endFixedPriceItem(
    storeId: string,
    itemId: string,
    marketplaceId: string,
  ): Promise<void> {
    const body = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<EndFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
      '  <ErrorLanguage>en_US</ErrorLanguage>',
      '  <WarningLevel>High</WarningLevel>',
      '  <EndingReason>NotAvailable</EndingReason>',
      '  <ItemID>' + escapeXml(itemId) + '</ItemID>',
      '</EndFixedPriceItemRequest>',
    ].join('\n');
    const xml = await this.post(
      storeId,
      'EndFixedPriceItem',
      body,
      marketplaceId,
    );
    if (/<Ack>\s*Failure\s*<\/Ack>/i.test(xml)) {
      const message =
        tagValue(xml, 'LongMessage') ?? 'EndFixedPriceItem failed';
      const code = tagValue(xml, 'ErrorCode');
      throw new Error(
        code ? 'EndFixedPriceItem failed (' + code + '): ' + message : message,
      );
    }
  }
}

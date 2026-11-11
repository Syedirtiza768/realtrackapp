/**
 * Migrate a bounded set of eBay Inventory API listings to legacy Trading API
 * fixed-price listings so Seller Hub can edit them.
 *
 * This command is deliberately dry-run by default. The live operation ends
 * and deletes the Inventory API offer/item before creating a new listing, so
 * --apply and --confirm are both required. Always inspect the dry-run output
 * before running the live command.
 *
 * Examples:
 *   node dist/src/scripts/migrate-ebay-inventory-to-trading.js --store="Blackline Autoparts" --limit=10
 *   node dist/src/scripts/migrate-ebay-inventory-to-trading.js --item-id=920009799224
 *   node dist/src/scripts/migrate-ebay-inventory-to-trading.js --store="Blackline Autoparts" --limit=10 --apply --confirm
 *   node dist/src/scripts/migrate-ebay-inventory-to-trading.js --item-id=920009799224 --apply --confirm
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { EbayInventoryApiService } from '../channels/ebay/ebay-inventory-api.service.js';
import {
  EbayTradingApiService,
  type TradingFixedPriceItemInput,
} from '../channels/ebay/ebay-trading-api.service.js';
import type {
  EbayCompatibilityPayload,
  EbayInventoryItem,
  EbayOffer,
} from '../channels/ebay/ebay-api.types.js';
import type { TradingItemDetails } from '../channels/ebay/ebay-trading-get-item.util.js';

interface MigrationTarget {
  listingId: string;
  publishedListingId: string | null;
  channelId: string | null;
  storeId: string;
  storeName: string;
  marketplaceId: string;
  ebayAccountId: string;
  ebayItemId: string;
  offerId: string;
  sku: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  price: string | number | null;
  currency: string;
  quantityAvailable: number;
  imageUrls: unknown;
  itemSpecifics: unknown;
  compatibility: unknown;
  listingPolicies: unknown;
  condition: string | null;
}

interface PreflightRecord {
  target: MigrationTarget;
  item: EbayInventoryItem;
  offer: EbayOffer;
  trading: TradingItemDetails;
  input: TradingFixedPriceItemInput;
  errors: string[];
  warnings: string[];
}

interface PolicyDefaults {
  fulfillmentPolicyId: string | null;
  paymentPolicyId: string | null;
  returnPolicyId: string | null;
}

function option(name: string, fallback = ''): string {
  const prefix = `--${name}=`;
  return (
    process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ??
    fallback
  );
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
    : [];
}

function httpUrls(value: unknown): string[] {
  return [
    ...new Set(stringArray(value).filter((entry) => /^https?:\/\//i.test(entry))),
  ];
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function conditionIdFor(value: string | null): number | null {
  const condition = normalize(value);
  if (condition === 'new') return 1000;
  if (condition === 'new_other') return 1500;
  if (condition === 'for_parts_or_not_working') return 7000;
  if (condition.includes('refurbished')) return 2000;
  if (condition.startsWith('used') || condition === 'like_new') return 3000;
  return null;
}

function listingUrl(itemId: string, marketplaceId: string): string {
  const host =
    marketplaceId === 'EBAY_GB'
      ? 'www.ebay.co.uk'
      : marketplaceId === 'EBAY_DE'
        ? 'www.ebay.de'
        : marketplaceId === 'EBAY_AU'
          ? 'www.ebay.com.au'
          : 'www.ebay.com';
  return `https://${host}/itm/${itemId}`;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function xmlTag(xml: string, name: string): string | null {
  return xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1]
    ?.replace(/^<!\\[CDATA\\[|\\]\\]>$/g, '')
    .trim() ?? null;
}

function addFixedPriceItemBody(
  input: TradingFixedPriceItemInput,
  includeCompatibility: boolean,
): string {
  const x = xmlEscape;
  const profiles = [
    input.paymentProfileId
      ? `<SellerPaymentProfile><PaymentProfileID>${x(input.paymentProfileId)}</PaymentProfileID></SellerPaymentProfile>`
      : '',
    input.shippingProfileId
      ? `<SellerShippingProfile><ShippingProfileID>${x(input.shippingProfileId)}</ShippingProfileID></SellerShippingProfile>`
      : '',
    input.returnProfileId
      ? `<SellerReturnProfile><ReturnProfileID>${x(input.returnProfileId)}</ReturnProfileID></SellerReturnProfile>`
      : '',
  ].filter(Boolean);
  const specifics = Object.entries(input.itemSpecifics ?? {}).flatMap(([name, values]) =>
    (values ?? []).map(
      (value) => `<NameValueList><Name>${x(name)}</Name><Value>${x(String(value))}</Value></NameValueList>`,
    ),
  );
  const compatibilities = includeCompatibility
    ? (input.compatibility?.compatibleProducts ?? []).map((row) => {
        const properties = row.compatibilityProperties.map(
          (property) => `<NameValueList><Name>${x(property.name)}</Name><Value>${x(property.value)}</Value></NameValueList>`,
        ).join('');
        const notes = row.notes ? `<CompatibilityNotes>${x(row.notes)}</CompatibilityNotes>` : '';
        return `<Compatibility>${properties}${notes}</Compatibility>`;
      })
    : [];
  const pictures = input.imageUrls.map((url) => `<PictureURL>${x(url)}</PictureURL>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ErrorLanguage>en_US</ErrorLanguage><WarningLevel>High</WarningLevel><Item>
<Title>${x(input.title)}</Title><Description>${x(input.description)}</Description><PrimaryCategory><CategoryID>${x(input.categoryId)}</CategoryID></PrimaryCategory>
<ConditionID>${input.conditionId}</ConditionID>${input.conditionDescription ? `<ConditionDescription>${x(input.conditionDescription)}</ConditionDescription>` : ''}
<Quantity>${Math.max(1, Math.trunc(input.quantity))}</Quantity><Currency>${x(input.currency)}</Currency><StartPrice currencyID="${x(input.currency)}">${input.price.toFixed(2)}</StartPrice>
<ListingDuration>${x(input.listingDuration ?? 'GTC')}</ListingDuration><ListingType>FixedPriceItem</ListingType><SKU>${x(input.sku)}</SKU><InventoryTrackingMethod>ItemID</InventoryTrackingMethod>
${input.location ? `<Location>${x(input.location)}</Location>` : ''}${input.country ? `<Country>${x(input.country)}</Country>` : ''}${input.postalCode ? `<PostalCode>${x(input.postalCode)}</PostalCode>` : ''}
<PictureDetails>${pictures}</PictureDetails>${specifics.length ? `<ItemSpecifics>${specifics.join('')}</ItemSpecifics>` : ''}
${compatibilities.length ? `<ItemCompatibilityList>${compatibilities.join('')}</ItemCompatibilityList>` : ''}
${profiles.length ? `<SellerProfiles>${profiles.join('')}</SellerProfiles>` : ''}</Item></AddFixedPriceItemRequest>`;
}

async function createTradingListing(
  tradingApi: EbayTradingApiService,
  storeId: string,
  input: TradingFixedPriceItemInput,
  marketplaceId: string,
): Promise<{ itemId: string }> {
  const compatibleApi = tradingApi as unknown as {
    addFixedPriceItem?: (
      storeId: string,
      input: TradingFixedPriceItemInput,
      marketplaceId: string,
    ) => Promise<{ itemId: string }>;
    postTradingRequest?: (
      storeId: string,
      callName: string,
      body: string,
      marketplaceId: string,
    ) => Promise<string>;
  };
  if (typeof compatibleApi.addFixedPriceItem === 'function') {
    return compatibleApi.addFixedPriceItem.call(tradingApi, storeId, input, marketplaceId);
  }
  if (typeof compatibleApi.postTradingRequest !== 'function') {
    throw new Error('Production Trading API client cannot create fixed-price listings');
  }

  // Production currently has the shared Trading transport but not the newer
  // AddFixedPriceItem wrapper. Keep this fallback confined to the migration
  // helper rather than replacing the running application service.
  let response = await compatibleApi.postTradingRequest.call(
    tradingApi,
    storeId,
    'AddFixedPriceItem',
    addFixedPriceItemBody(input, true),
    marketplaceId,
  );
  if (
    /<Ack>\s*Failure\s*<\/Ack>/i.test(response) &&
    (/<ErrorCode>\s*21917122\s*<\/ErrorCode>/i.test(response) || /all compatibilities are invalid/i.test(response)) &&
    input.compatibility?.compatibleProducts?.length
  ) {
    response = await compatibleApi.postTradingRequest.call(
      tradingApi,
      storeId,
      'AddFixedPriceItem',
      addFixedPriceItemBody(input, false),
      marketplaceId,
    );
  }
  if (/<Ack>\s*Failure\s*<\/Ack>/i.test(response)) {
    const code = xmlTag(response, 'ErrorCode');
    const message = xmlTag(response, 'LongMessage') ?? xmlTag(response, 'Message') ?? 'AddFixedPriceItem failed';
    throw new Error(code ? `AddFixedPriceItem failed (${code}): ${message}` : message);
  }
  const itemId = xmlTag(response, 'ItemID');
  if (!itemId) throw new Error('AddFixedPriceItem succeeded without an ItemID');
  return { itemId };
}

function conditionDescription(item: EbayInventoryItem): string | null {
  return item.conditionDescription?.trim() || null;
}

function buildInput(
  target: MigrationTarget,
  item: EbayInventoryItem,
  offer: EbayOffer,
  trading: TradingItemDetails,
  defaultPolicies: PolicyDefaults | undefined,
  errors: string[],
  warnings: string[],
): TradingFixedPriceItemInput {
  const policies = {
    ...(defaultPolicies ?? {}),
    ...(offer.listingPolicies ?? {}),
  };
  if (!offer.listingPolicies && defaultPolicies) {
    warnings.push('policy_ids_using_marketplace_defaults');
  }
  const inventoryProduct = item.product ?? { title: '' };
  const title =
    inventoryProduct.title?.trim() || trading.title?.trim() || target.title.trim();
  const description =
    inventoryProduct.description?.trim() ||
    trading.description?.trim() ||
    target.description?.trim() ||
    '';
  const categoryId =
    offer.categoryId?.trim() || trading.categoryId?.trim() || target.categoryId?.trim() || '';
  const quantity =
    offer.availableQuantity ??
    (trading.quantity == null || trading.quantitySold == null
      ? target.quantityAvailable
      : Math.max(0, trading.quantity - trading.quantitySold));
  const price =
    numberOrNull(offer.pricingSummary?.price?.value) ??
    trading.price ??
    numberOrNull(target.price) ??
    0;
  const currency =
    offer.pricingSummary?.price?.currency?.trim() ||
    trading.currency?.trim() ||
    target.currency.trim() ||
    'USD';
  const imageUrls = httpUrls(inventoryProduct.imageUrls ?? target.imageUrls ?? trading.imageUrls);
  const itemSpecifics =
    inventoryProduct.aspects && Object.keys(inventoryProduct.aspects).length
      ? inventoryProduct.aspects
      : asRecord(target.itemSpecifics) as Record<string, string[]>;
  const targetCompatibility = target.compatibility && typeof target.compatibility === 'object'
    ? (asRecord(target.compatibility) as unknown as EbayCompatibilityPayload)
    : null;
  const compatibility =
    (offer.compatibility as EbayCompatibilityPayload | undefined) ??
    targetCompatibility ??
    trading.compatibility;
  const conditionId =
    trading.conditionId ?? conditionIdFor(target.condition ?? item.condition);
  const location = trading.location?.trim() || null;
  const country = trading.country?.trim() || (target.marketplaceId.startsWith('EBAY_') ? 'US' : null);
  const postalCode = trading.postalCode?.trim() || null;

  if (!title) errors.push('missing_title');
  if (title.length > 80) errors.push('title_over_80_characters');
  if (!description) errors.push('missing_description');
  if (!categoryId) errors.push('missing_category_id');
  if (!imageUrls.length) errors.push('missing_http_image');
  if (imageUrls.length > 24) errors.push('more_than_24_images');
  if (price <= 0) errors.push('missing_or_invalid_price');
  if (quantity <= 0) errors.push('available_quantity_is_zero');
  if (!conditionId) errors.push('missing_condition_id');
  if (!location) errors.push('missing_listing_location');
  if (!policies.paymentPolicyId) errors.push('missing_payment_profile_id');
  if (!policies.fulfillmentPolicyId) errors.push('missing_shipping_profile_id');
  if (!policies.returnPolicyId) errors.push('missing_return_profile_id');
  if (!inventoryProduct.imageUrls?.length && trading.imageUrls.length) {
    warnings.push('inventory_image_set_missing_using_trading_gallery');
  }
  if (!trading.conditionId && conditionId) {
    warnings.push(`condition_id_fallback_${conditionId}`);
  }

  return {
    title,
    description,
    categoryId,
    conditionId: conditionId ?? 0,
    quantity: Math.max(1, Math.trunc(quantity)),
    price,
    currency,
    sku: target.sku,
    imageUrls,
    itemSpecifics,
    compatibility,
    listingDuration: trading.listingDuration || offer.listingDuration || 'GTC',
    location,
    country,
    postalCode,
    conditionDescription: conditionDescription(item),
    paymentProfileId: policies.paymentPolicyId ?? null,
    shippingProfileId: policies.fulfillmentPolicyId ?? null,
    returnProfileId: policies.returnPolicyId ?? null,
  };
}

async function main(): Promise<void> {
  const ebayItemId = option('item-id').trim();
  const storeName = option(
    'store',
    ebayItemId ? '' : 'Blackline Autoparts',
  ).trim();
  const storeId = option('store-id').trim();
  const limit = Math.max(1, Number(option('limit', '10')) || 10);
  const apply = hasFlag('apply');
  const confirmed = hasFlag('confirm');

  if (apply && !confirmed) {
    throw new Error('Live migration requires both --apply and --confirm');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const dataSource = app.get(DataSource);
    const inventoryApi = app.get(EbayInventoryApiService);
    const tradingApi = app.get(EbayTradingApiService);
    const policyRows = (await dataSource.query(
      `SELECT ebay_account_id AS "ebayAccountId", marketplace_id AS "marketplaceId",
              default_fulfillment_policy_id AS "fulfillmentPolicyId",
              default_payment_policy_id AS "paymentPolicyId",
              default_return_policy_id AS "returnPolicyId"
       FROM ebay_account_marketplaces`,
    )) as Array<
      PolicyDefaults & { ebayAccountId: string; marketplaceId: string }
    >;
    const policyDefaults = new Map(
      policyRows.map((row) => [
        `${row.ebayAccountId}:${row.marketplaceId}`,
        row,
      ]),
    );

    let targets = (await dataSource.query(
      `
      SELECT
        epl.id AS "listingId",
        epl.id AS "publishedListingId",
        elc.id AS "channelId",
        epl.store_id AS "storeId",
        s.store_name AS "storeName",
        epl.marketplace_id AS "marketplaceId",
        epl.ebay_account_id AS "ebayAccountId",
        epl.ebay_item_id AS "ebayItemId",
        epl.offer_id AS "offerId",
        COALESCE(epl.sku, elc.internal_sku, elc.ebay_inventory_sku) AS "sku",
        epl.title AS "title",
        epl.description AS "description",
        epl.category_id AS "categoryId",
        epl.price AS "price",
        epl.currency AS "currency",
        epl.quantity_available AS "quantityAvailable",
        epl.image_urls AS "imageUrls",
        epl.item_specifics AS "itemSpecifics",
        epl.compatibility AS "compatibility",
        epl.listing_policies AS "listingPolicies",
        epl.condition AS "condition"
      FROM ebay_published_listings epl
      JOIN stores s ON s.id = epl.store_id
      LEFT JOIN ebay_listing_channels elc ON elc.id = epl.ebay_listing_channel_id
      WHERE epl.offer_id IS NOT NULL
        AND epl.ebay_item_id IS NOT NULL
        AND COALESCE(epl.sku, elc.internal_sku, elc.ebay_inventory_sku) IS NOT NULL
        AND epl.listing_status IN ('active', 'out_of_stock')
        AND (
          ($2 <> '' AND epl.store_id::text = $2)
          OR ($2 = '' AND ($1 = '' OR LOWER(s.store_name) = LOWER($1)))
        )
        AND ($4 = '' OR epl.ebay_item_id = $4)
      ORDER BY epl.created_at ASC, epl.id ASC
      LIMIT $3
      `,
      [storeName, storeId, ebayItemId ? 2 : limit, ebayItemId],
    )) as MigrationTarget[];

    // Some legacy Inventory API publications only have a channel mapping and
    // never received a corresponding ebay_published_listings row. Resolve an
    // explicitly requested item ID through that mapping and the connected
    // account's primary store, without broadening bulk migration selection.
    if (!targets.length && ebayItemId) {
      targets = (await dataSource.query(
        `
        SELECT
          elc.id::text AS "listingId",
          NULL::uuid AS "publishedListingId",
          elc.id AS "channelId",
          cea.primary_store_id AS "storeId",
          s.store_name AS "storeName",
          elc.marketplace_id AS "marketplaceId",
          elc.ebay_account_id AS "ebayAccountId",
          elc.listing_id AS "ebayItemId",
          elc.offer_id AS "offerId",
          COALESCE(elc.internal_sku, elc.ebay_inventory_sku) AS "sku",
          ''::text AS "title",
          NULL::text AS "description",
          NULL::text AS "categoryId",
          NULL::numeric AS "price",
          'USD'::text AS "currency",
          1::int AS "quantityAvailable",
          NULL::jsonb AS "imageUrls",
          NULL::jsonb AS "itemSpecifics",
          NULL::jsonb AS "compatibility",
          NULL::jsonb AS "listingPolicies",
          NULL::text AS "condition"
        FROM ebay_listing_channels elc
        JOIN connected_ebay_accounts cea ON cea.id = elc.ebay_account_id
        JOIN stores s ON s.id = cea.primary_store_id
        WHERE elc.listing_id = $1
          AND elc.offer_id IS NOT NULL
          AND elc.listing_status = 'published'
          AND ($2 = '' OR cea.primary_store_id::text = $2)
          AND ($3 = '' OR LOWER(s.store_name) = LOWER($3))
        ORDER BY elc.updated_at DESC, elc.id ASC
        LIMIT 2
        `,
        [ebayItemId, storeId, storeName],
      )) as MigrationTarget[];
    }

    if (ebayItemId && targets.length > 1) {
      console.log(
        JSON.stringify({
          event: 'migration_item_id_ambiguous',
          ebayItemId,
          candidates: targets.map((target) => ({
            storeId: target.storeId,
            storeName: target.storeName,
            sku: target.sku,
            listingId: target.listingId,
          })),
          applySkipped: true,
        }),
      );
      process.exitCode = 2;
      return;
    }

    if (!targets.length) {
      const available = (await dataSource.query(
        `SELECT id, store_name AS "storeName" FROM stores ORDER BY store_name`,
      )) as Array<{ id: string; storeName: string }>;
      const localListings = ebayItemId
        ? await dataSource.query(
            `SELECT epl.id AS "listingId", epl.store_id AS "storeId",
                    s.store_name AS "storeName", epl.ebay_account_id AS "ebayAccountId",
                    epl.ebay_item_id AS "ebayItemId", epl.offer_id AS "offerId",
                    epl.sku AS "sku", epl.listing_status AS "listingStatus"
             FROM ebay_published_listings epl
             LEFT JOIN stores s ON s.id = epl.store_id
             WHERE epl.ebay_item_id = $1`,
            [ebayItemId],
          )
        : [];
      const localChannels = ebayItemId
        ? await dataSource.query(
            `SELECT id, ebay_account_id AS "ebayAccountId",
                    marketplace_id AS "marketplaceId", listing_id AS "listingId",
                    offer_id AS "offerId", internal_sku AS "internalSku",
                    ebay_inventory_sku AS "ebayInventorySku",
                    listing_status AS "listingStatus"
             FROM ebay_listing_channels
             WHERE listing_id = $1`,
            [ebayItemId],
          )
        : [];
      console.log(
        JSON.stringify({
          event: 'migration_no_targets',
          requestedStore: storeName || null,
          requestedStoreId: storeId || null,
          requestedEbayItemId: ebayItemId || null,
          localListingMatches: localListings,
          localChannelMatches: localChannels,
          availableStores: available,
          readOnly: !apply,
        }),
      );
      process.exitCode = 2;
      return;
    }

    console.log(
      JSON.stringify({
        event: 'migration_preflight_started',
        requestedStore: storeName || null,
        requestedStoreId: storeId || null,
        requestedEbayItemId: ebayItemId || null,
        targetCount: targets.length,
        limit: ebayItemId ? 1 : limit,
        apply,
        destructive: apply,
      }),
    );

    const records: PreflightRecord[] = [];
    for (const target of targets) {
      const errors: string[] = [];
      const warnings: string[] = [];
      let item: EbayInventoryItem;
      let offer: EbayOffer;
      let trading: TradingItemDetails;
      try {
        item = await inventoryApi.getItem(target.storeId, target.sku);
      } catch (error: unknown) {
        errors.push(`inventory_item_unreadable:${errorMessage(error)}`);
        continue;
      }
      try {
        offer = await inventoryApi.getOffer(target.storeId, target.offerId);
      } catch (error: unknown) {
        errors.push(`inventory_offer_unreadable:${errorMessage(error)}`);
        continue;
      }
      try {
        trading = await tradingApi.getItemDetails(
          target.storeId,
          target.ebayItemId,
          target.marketplaceId,
        );
      } catch (error: unknown) {
        errors.push(`trading_get_item_failed:${errorMessage(error)}`);
        continue;
      }

      if (!trading.location?.trim() && offer.merchantLocationKey?.trim()) {
        try {
          const inventoryLocation = await inventoryApi.getLocation(
            target.storeId,
            offer.merchantLocationKey,
          );
          const address = inventoryLocation?.location?.address;
          const locationParts = [address?.city, address?.stateOrProvince]
            .map((part) => part?.trim())
            .filter(Boolean);
          if (locationParts.length) {
            trading = {
              ...trading,
              location: locationParts.join(', '),
              country: trading.country ?? address?.country ?? null,
              postalCode: trading.postalCode ?? address?.postalCode ?? null,
            };
          }
        } catch (error: unknown) {
          warnings.push(`inventory_location_unreadable:${errorMessage(error)}`);
        }
      }

      if (offer.status !== 'PUBLISHED') errors.push(`offer_not_published:${offer.status ?? 'unknown'}`);
      if (offer.listingId && offer.listingId !== target.ebayItemId) {
        errors.push('offer_listing_id_mismatch');
      }
      if (normalize(offer.sku) !== normalize(target.sku)) errors.push('offer_sku_mismatch');
      if (trading.itemId && trading.itemId !== target.ebayItemId) errors.push('trading_item_id_mismatch');
      if (trading.listingStatus && normalize(trading.listingStatus) !== 'active') {
        errors.push(`trading_listing_not_active:${trading.listingStatus}`);
      }
      if (trading.sku && normalize(trading.sku) !== normalize(target.sku)) errors.push('trading_sku_mismatch');
      if (normalize(offer.format) !== 'fixed_price') errors.push('offer_not_fixed_price');

      const input = buildInput(
        target,
        item,
        offer,
        trading,
        policyDefaults.get(`${target.ebayAccountId}:${target.marketplaceId}`),
        errors,
        warnings,
      );
      const record: PreflightRecord = { target, item, offer, trading, input, errors, warnings };
      records.push(record);
      console.log(
        JSON.stringify({
          event: 'migration_preflight_result',
          listingId: target.listingId,
          ebayItemId: target.ebayItemId,
          offerId: target.offerId,
          sku: target.sku,
          title: input.title,
          ok: errors.length === 0,
          errors,
          warnings,
        }),
      );
    }

    const blocked = records.filter((record) => record.errors.length > 0);
    if (blocked.length || records.length !== targets.length) {
      console.log(
        JSON.stringify({
          event: 'migration_preflight_blocked',
          targetCount: targets.length,
          readableCount: records.length,
          blockedCount: blocked.length + (targets.length - records.length),
          applySkipped: true,
        }),
      );
      process.exitCode = 2;
      return;
    }

    console.log(
      JSON.stringify({
        event: 'migration_preflight_passed',
        targetCount: records.length,
        apply,
        nextStep: apply ? 'live_migration' : 'rerun_with_--apply_--confirm',
      }),
    );
    if (!apply) return;

    for (const record of records) {
      const { target, item, offer, input } = record;
      let newItemId: string | null = null;
      let withdrawn = false;
      let offerDeleted = false;
      let itemDeleted = false;
      try {
        await inventoryApi.withdrawOffer(target.storeId, target.offerId);
        withdrawn = true;
        await inventoryApi.deleteOffer(target.storeId, target.offerId);
        offerDeleted = true;
        await inventoryApi.deleteItem(target.storeId, target.sku);
        itemDeleted = true;

        const created = await createTradingListing(
          tradingApi,
          target.storeId,
          input,
          target.marketplaceId,
        );
        newItemId = created.itemId;
        const newUrl = listingUrl(newItemId, target.marketplaceId);
        if (target.publishedListingId) {
          await dataSource.query(
            `UPDATE ebay_published_listings
             SET ebay_item_id = $1, offer_id = NULL, listing_url = $2,
                 listing_status = 'active', last_synced_at = NOW(), updated_at = NOW()
             WHERE id = $3`,
            [newItemId, newUrl, target.publishedListingId],
          );
        }
        if (target.channelId) {
          await dataSource.query(
            `UPDATE ebay_listing_channels
             SET listing_id = $1, offer_id = NULL, ebay_inventory_sku = NULL,
                 listing_url = $2, listing_status = 'published', updated_at = NOW()
             WHERE id = $3`,
            [newItemId, newUrl, target.channelId],
          );
        }
        console.log(
          JSON.stringify({
            event: 'migration_success',
            listingId: target.listingId,
            oldItemId: target.ebayItemId,
            oldOfferId: target.offerId,
            newItemId,
            newListingUrl: newUrl,
            sku: target.sku,
          }),
        );
      } catch (error: unknown) {
        let rollback: string = 'not_attempted';
        if (!newItemId && (withdrawn || offerDeleted || itemDeleted)) {
          try {
            const restoredItem = {
              product: {
                title: input.title,
                description: input.description,
                imageUrls: input.imageUrls,
                aspects: input.itemSpecifics ?? {},
              },
              condition: item.condition,
              conditionDescription: item.conditionDescription,
              availability: {
                shipToLocationAvailability: { quantity: input.quantity },
              },
            };
            await inventoryApi.createOrReplaceItem(
              target.storeId,
              target.sku,
              restoredItem,
            );
            const restoredOfferPayload = {
              sku: input.sku,
              marketplaceId: offer.marketplaceId,
              format: 'FIXED_PRICE' as const,
              listingDescription: input.description,
              pricingSummary: {
                price: { value: input.price.toFixed(2), currency: input.currency },
              },
              categoryId: input.categoryId,
              listingPolicies: {
                fulfillmentPolicyId: input.shippingProfileId ?? undefined,
                paymentPolicyId: input.paymentProfileId ?? undefined,
                returnPolicyId: input.returnProfileId ?? undefined,
              },
              merchantLocationKey: offer.merchantLocationKey,
              listingDuration: input.listingDuration ?? 'GTC',
              includeCatalogProductDetails: false,
              compatibility: input.compatibility ?? undefined,
            };
            const restored = await inventoryApi.createOffer(
              target.storeId,
              restoredOfferPayload,
            );
            const published = await inventoryApi.publishOffer(
              target.storeId,
              restored.offerId,
            );
            const restoredUrl = listingUrl(published.listingId, target.marketplaceId);
            if (target.publishedListingId) {
              await dataSource.query(
                `UPDATE ebay_published_listings
                 SET ebay_item_id = $1, offer_id = $2, listing_url = $3,
                     listing_status = 'active', last_synced_at = NOW(), updated_at = NOW()
                 WHERE id = $4`,
                [published.listingId, restored.offerId, restoredUrl, target.publishedListingId],
              );
            }
            if (target.channelId) {
              await dataSource.query(
                `UPDATE ebay_listing_channels
                 SET listing_id = $1, offer_id = $2, ebay_inventory_sku = $3,
                     listing_url = $4, listing_status = 'published', updated_at = NOW()
                 WHERE id = $5`,
                [published.listingId, restored.offerId, target.sku, restoredUrl, target.channelId],
              );
            }
            rollback = `restored_inventory_offer:${restored.offerId}`;
          } catch (rollbackError: unknown) {
            rollback = `failed:${errorMessage(rollbackError)}`;
          }
        }
        console.log(
          JSON.stringify({
            event: 'migration_failed',
            listingId: target.listingId,
            oldItemId: target.ebayItemId,
            oldOfferId: target.offerId,
            newItemId,
            sku: target.sku,
            error: errorMessage(error),
            rollback,
            stopAfterFailure: true,
          }),
        );
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({ event: 'migration_failed_to_start', error: errorMessage(error) }),
    );
    process.exit(1);
  });

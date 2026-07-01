import { Injectable } from '@nestjs/common';
import type {
  PublishedListingFormat,
  PublishedListingHealthFlag,
  PublishedListingStatus,
} from '../entities/ebay-published-listing.entity.js';
import type { EbayInventoryItem, EbayOffer } from '../../channels/ebay/ebay-api.types.js';

const LOW_STOCK_THRESHOLD = 3;

@Injectable()
export class PublishedListingsHealthService {
  computeHealthFlags(input: {
    title: string;
    imageUrls: string[];
    itemSpecifics: Record<string, string[]>;
    compatibility: Record<string, unknown> | null;
    quantityAvailable: number;
    quantitySold: number;
  performanceMetrics: Record<string, unknown>;
  categoryId: string | null;
  price?: string | null;
  competitorPricing?: {
    medianPrice?: number | null;
    avgPrice?: number | null;
    minPrice?: number | null;
    maxPrice?: number | null;
  } | null;
}): PublishedListingHealthFlag[] {
    const flags: PublishedListingHealthFlag[] = [];

    if (!input.imageUrls.length) {
      flags.push({
        code: 'missing_images',
        severity: 'critical',
        message: 'No listing images',
      });
    } else if (input.imageUrls.length < 3) {
      flags.push({
        code: 'weak_images',
        severity: 'warning',
        message: 'Fewer than 3 images — add more for better conversion',
      });
    }

    const aspectCount = Object.keys(input.itemSpecifics ?? {}).length;
    if (aspectCount === 0) {
      flags.push({
        code: 'missing_item_specifics',
        severity: 'warning',
        message: 'No item specifics defined',
      });
    }

    const title = (input.title ?? '').trim();
    if (title.length < 20) {
      flags.push({
        code: 'short_title',
        severity: 'warning',
        message: 'Title is very short — consider adding keywords',
      });
    }
    if (title.length > 80) {
      flags.push({
        code: 'long_title',
        severity: 'info',
        message: 'Title exceeds 80 characters — may be truncated in search',
      });
    }

    const compatProducts =
      (input.compatibility?.compatibleProducts as unknown[] | undefined) ?? [];
    const isMotors =
      (input.categoryId ?? '').startsWith('33') ||
      (input.categoryId ?? '').startsWith('67');
    if (isMotors && compatProducts.length === 0) {
      flags.push({
        code: 'missing_compatibility',
        severity: 'warning',
        message: 'Motors listing has no vehicle compatibility data',
      });
    }

    if (input.quantityAvailable <= 0) {
      flags.push({
        code: 'out_of_stock',
        severity: 'critical',
        message: 'Out of stock',
      });
    } else if (input.quantityAvailable <= LOW_STOCK_THRESHOLD) {
      flags.push({
        code: 'low_stock',
        severity: 'warning',
        message: `Low stock (${input.quantityAvailable} remaining)`,
      });
    }

    const views = Number(input.performanceMetrics?.viewCount ?? 0);
    if (views === 0 && input.quantitySold === 0) {
      flags.push({
        code: 'no_engagement',
        severity: 'info',
        message: 'No views or sales recorded',
      });
    } else if (views > 0 && input.quantitySold === 0) {
      flags.push({
        code: 'no_sales',
        severity: 'info',
        message: 'Has views but no sales yet',
      });
    }

    const cp = input.competitorPricing;
    const myPrice = input.price != null ? Number(input.price) : null;
    if (cp?.medianPrice != null && myPrice != null && myPrice > 0) {
      const median = Number(cp.medianPrice);
      if (median > 0) {
        const ratio = myPrice / median;
        if (ratio > 1.15) {
          flags.push({
            code: 'price_above_market',
            severity: 'warning',
            message: `Price $${myPrice.toFixed(2)} is above market median $${median.toFixed(2)}`,
          });
        } else if (ratio < 0.85) {
          flags.push({
            code: 'price_below_market',
            severity: 'info',
            message: `Price $${myPrice.toFixed(2)} is below market median $${median.toFixed(2)} — room to increase`,
          });
        }
      }
    }

    return flags;
  }

  mapOfferStatus(offer: EbayOffer): PublishedListingStatus {
    const status = (offer.status ?? '').toUpperCase();
    if (status === 'PUBLISHED' || offer.listingId) {
      if ((offer.availableQuantity ?? 0) <= 0) return 'out_of_stock';
      return 'active';
    }
    if (status === 'ENDED' || status === 'WITHDRAWN') return 'ended';
    return 'unknown';
  }

  mapOfferFormat(format?: string): PublishedListingFormat {
    const f = (format ?? '').toUpperCase();
    if (f === 'AUCTION') return 'auction';
    if (f === 'FIXED_PRICE') return 'fixed_price';
    return 'unknown';
  }

  buildListingUrl(
    listingId: string | undefined,
    marketplaceId: string,
    environment: 'sandbox' | 'production',
  ): string | null {
    if (!listingId) return null;
    const host =
      environment === 'production' ? 'www.ebay.com' : 'sandbox.ebay.com';
    const path = marketplaceId.includes('MOTORS') ? 'itm' : 'itm';
    return `https://${host}/${path}/${listingId}`;
  }

  extractFromInventoryItem(item: EbayInventoryItem): {
    title: string;
    description: string | null;
    imageUrls: string[];
    itemSpecifics: Record<string, string[]>;
    condition: string | null;
    quantityAvailable: number;
  } {
    return {
      title: item.product?.title ?? 'Untitled',
      description: item.product?.description ?? null,
      imageUrls: item.product?.imageUrls ?? [],
      itemSpecifics: item.product?.aspects ?? {},
      condition: item.condition ?? null,
      quantityAvailable:
        item.availability?.shipToLocationAvailability?.quantity ?? 0,
    };
  }
}

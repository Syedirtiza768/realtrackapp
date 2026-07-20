import { Injectable, Logger } from '@nestjs/common';
import { EbayBrowseApiService } from '../../channels/ebay/ebay-browse-api.service.js';
import { EbayInventoryApiService } from '../../channels/ebay/ebay-inventory-api.service.js';
import { EbayTradingApiService } from '../../channels/ebay/ebay-trading-api.service.js';
import type { EbayCompatibilityPayload } from '../../channels/ebay/ebay-api.types.js';
import type { EbayItem } from '../../channels/ebay/ebay-api.types.js';
import { sanitizeEbayImageUrls } from '../../channels/ebay/ebay-listing-images.util.js';

export interface ListingEnrichmentInput {
  storeId: string;
  ebayItemId: string;
  sku?: string | null;
  marketplaceId?: string | null;
  imageUrls?: string[];
  compatibility?: Record<string, unknown> | null;
}

export interface ListingEnrichmentResult {
  imageUrls: string[];
  compatibility: Record<string, unknown> | null;
  sources: string[];
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
  return [...new Set(urls)];
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

@Injectable()
export class PublishedListingsEnrichmentService {
  private readonly logger = new Logger(PublishedListingsEnrichmentService.name);

  constructor(
    private readonly tradingApi: EbayTradingApiService,
    private readonly browseApi: EbayBrowseApiService,
    private readonly inventoryApi: EbayInventoryApiService,
  ) {}

  needsEnrichment(input: ListingEnrichmentInput): boolean {
    const imageCount = input.imageUrls?.length ?? 0;
    return imageCount <= 1 || !compatibilityChecked(input.compatibility);
  }

  async enrichListing(
    input: ListingEnrichmentInput,
  ): Promise<ListingEnrichmentResult> {
    const sources: string[] = [];
    let imageUrls = [...(input.imageUrls ?? [])];
    let compatibility = input.compatibility ?? null;

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

    const needsImages = imageUrls.length <= 1;
    const needsCompat = !compatibilityChecked(compatibility);

    if (needsImages || needsCompat) {
      try {
        const trading = await this.tradingApi.getItemDetails(
          input.storeId,
          input.ebayItemId,
          input.marketplaceId,
        );
        if (needsImages && trading.imageUrls.length > imageUrls.length) {
          imageUrls = trading.imageUrls;
          sources.push('trading_getitem');
        }
        if (needsCompat && trading.compatibility) {
          compatibility = trading.compatibility as unknown as Record<
            string,
            unknown
          >;
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

    const stillNeedsImages = imageUrls.length <= 1;
    const stillNeedsCompat = !compatibilityChecked(compatibility);
    if (stillNeedsImages || stillNeedsCompat) {
      try {
        const browse = await this.browseApi.getItemByLegacyId(input.ebayItemId);
        if (stillNeedsImages) {
          const browseImages = extractBrowseImages(browse);
          if (browseImages.length > imageUrls.length) {
            imageUrls = browseImages;
            sources.push('browse_api');
          }
        }
        if (stillNeedsCompat) {
          const browseCompat = extractBrowseCompatibility(browse);
          if (browseCompat) {
            compatibility = browseCompat as unknown as Record<string, unknown>;
            sources.push('browse_api');
          }
        }
      } catch (e) {
        this.logger.debug(
          `Browse enrich skipped for ${input.ebayItemId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    const sanitized = sanitizeEbayImageUrls(imageUrls);
    return {
      imageUrls: sanitized.imageUrls,
      compatibility:
        compatibilityRowCount(compatibility) > 0
          ? compatibility
          : compatibility === null
            ? { compatibleProducts: [] }
            : compatibility,
      sources: [...new Set(sources)],
    };
  }
}

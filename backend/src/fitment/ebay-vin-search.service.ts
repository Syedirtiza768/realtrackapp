import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import {
  ListingRecord,
  ListingOrigin,
} from '../listings/listing-record.entity.js';
import { EbayBrowseApiService } from '../channels/ebay/ebay-browse-api.service.js';
import type { VinDecodeResult } from './vin-decode.service.js';

const SOURCE_FILE = 'ebay_browse_api';
const CACHE_TTL_DAYS = 7;

/**
 * EbayVinSearchService — Search eBay Browse API for parts matching a VIN-decoded
 * vehicle, and persist results as listing_records for future lookups.
 */
@Injectable()
export class EbayVinSearchService {
  private readonly logger = new Logger(EbayVinSearchService.name);

  constructor(
    private readonly browseApi: EbayBrowseApiService,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
  ) {}

  /**
   * Search eBay for parts matching the decoded vehicle and persist to DB.
   * Returns cached results if fresh data exists within the TTL window.
   */
  async searchAndPersist(
    vin: string,
    decoded: VinDecodeResult,
  ): Promise<ListingRecord[]> {
    const sheetName = `VIN:${vin}`;

    // Check for fresh cached results
    const cached = await this.listingRepo.find({
      where: {
        sourceFileName: SOURCE_FILE,
        sheetName,
        importedAt: MoreThan(this.daysAgo(CACHE_TTL_DAYS)),
      },
      order: { importedAt: 'DESC' },
      take: 100,
    });

    if (cached.length > 0) {
      this.logger.log(
        `Found ${cached.length} cached eBay listings for VIN ${vin} (within ${CACHE_TTL_DAYS}d TTL)`,
      );
      return cached;
    }

    // Build search query from decoded vehicle data
    const query = this.buildSearchQuery(decoded);
    if (!query) {
      this.logger.warn(
        `Cannot build eBay search query for VIN ${vin} — missing make/model`,
      );
      return [];
    }

    this.logger.log(`Searching eBay Browse API for VIN ${vin}: "${query}"`);

    try {
      const result = await this.browseApi.search({
        q: query,
        categoryIds: '6000', // eBay Motors
        filter: 'conditionIds:{1000|3000|4000|5000|6000}', // New, Used, Refurbished, etc.
        limit: 50,
      });

      const items = result.itemSummaries ?? [];
      if (items.length === 0) {
        this.logger.log(`No eBay results found for VIN ${vin}`);
        return [];
      }

      this.logger.log(
        `Found ${items.length} eBay listings for VIN ${vin}, persisting...`,
      );

      // Map to listing records and upsert
      const records: Partial<ListingRecord>[] = items.map((item, idx) => ({
        sourceFileName: SOURCE_FILE,
        sourceFilePath: `ebay://item/${item.itemId}`,
        origin: ListingOrigin.PIPELINE_IMPORT,
        sheetName,
        sourceRowNumber: idx + 1,
        action: 'Add',
        customLabelSku: `EBAY-${item.itemId}`,
        title: item.title,
        categoryId: item.categories?.[0]?.categoryId ?? null,
        categoryName: item.categories?.[0]?.categoryName ?? null,
        startPrice: item.price?.value ?? null,
        startPriceNum: item.price?.value ? parseFloat(item.price.value) : null,
        quantity: '1',
        quantityNum: 1,
        conditionId: item.conditionId ?? null,
        itemPhotoUrl: item.image?.imageUrl ?? null,
        format: 'FIXED_PRICE',
        extractedMake: decoded.make ?? null,
        extractedModel: decoded.model ?? null,
        status: 'draft',
      }));

      // Upsert using the unique constraint on (sourceFileName, sheetName, sourceRowNumber)
      const saved = await this.upsertListings(records);

      this.logger.log(`Persisted ${saved.length} eBay listings for VIN ${vin}`);

      return saved;
    } catch (err: any) {
      this.logger.error(
        `eBay Browse API search failed for VIN ${vin}: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }

  private buildSearchQuery(decoded: VinDecodeResult): string | null {
    const parts: string[] = [];
    if (decoded.year) parts.push(String(decoded.year));
    if (decoded.make) parts.push(decoded.make);
    if (decoded.model) parts.push(decoded.model);
    if (decoded.trim) parts.push(decoded.trim);
    parts.push('parts');

    return parts.length >= 3 ? parts.join(' ') : null;
  }

  private async upsertListings(
    records: Partial<ListingRecord>[],
  ): Promise<ListingRecord[]> {
    const saved: ListingRecord[] = [];

    for (const record of records) {
      try {
        const existing = await this.listingRepo.findOne({
          where: {
            sourceFileName: record.sourceFileName!,
            sheetName: record.sheetName!,
            sourceRowNumber: record.sourceRowNumber!,
          },
        });

        if (existing) {
          // Update existing record with fresh data
          Object.assign(existing, {
            title: record.title,
            startPrice: record.startPrice,
            startPriceNum: record.startPriceNum,
            conditionId: record.conditionId,
            itemPhotoUrl: record.itemPhotoUrl,
            categoryId: record.categoryId,
            categoryName: record.categoryName,
          });
          saved.push(await this.listingRepo.save(existing));
        } else {
          saved.push(
            await this.listingRepo.save(this.listingRepo.create(record)),
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to upsert listing ${record.customLabelSku}: ${err.message}`,
        );
      }
    }

    return saved;
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }
}

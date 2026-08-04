import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ImageDriveAsset } from './entities/image-drive-asset.entity.js';
import { StorageService } from './storage.service.js';
import { ImageAsset } from './entities/image-asset.entity.js';
import { ListingRecord } from '../listings/listing-record.entity.js';

export interface ImageDriveEntry {
  id: string;
  partNumberRaw: string;
  cdnUrl: string;
  s3Key: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  source: string;
  sourceListingId: string | null;
  createdAt: Date;
}

export interface BatchLookupResult {
  [partNumber: string]: ImageDriveEntry[];
}

@Injectable()
export class ImageDriveService {
  private readonly logger = new Logger(ImageDriveService.name);

  constructor(
    @InjectRepository(ImageDriveAsset)
    private readonly driveRepo: Repository<ImageDriveAsset>,
    @InjectRepository(ImageAsset)
    private readonly imageAssetRepo: Repository<ImageAsset>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    private readonly storageService: StorageService,
  ) {}

  static normalizePartNumber(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[\s\-_./\\]+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  async findByPartNumber(partNumber: string): Promise<ImageDriveEntry[]> {
    const normalized = ImageDriveService.normalizePartNumber(partNumber);
    if (!normalized) return [];

    const assets = await this.driveRepo.find({
      where: { partNumberNormalized: normalized },
      order: { createdAt: 'ASC' },
    });

    return assets.map(this.toEntry);
  }

  async findByPartNumbers(partNumbers: string[]): Promise<BatchLookupResult> {
    const normalizedSet = new Map<string, string>();
    for (const raw of partNumbers) {
      const norm = ImageDriveService.normalizePartNumber(raw);
      if (norm) normalizedSet.set(norm, raw);
    }

    if (normalizedSet.size === 0) return {};

    const assets = await this.driveRepo.find({
      where: { partNumberNormalized: In([...normalizedSet.keys()]) },
      order: { createdAt: 'ASC' },
    });

    const result: BatchLookupResult = {};
    for (const asset of assets) {
      if (!result[asset.partNumberNormalized]) {
        result[asset.partNumberNormalized] = [];
      }
      result[asset.partNumberNormalized].push(this.toEntry(asset));
    }
    return result;
  }

  async recordImages(
    partNumber: string,
    images: Array<{
      cdnUrl: string;
      s3Key: string;
      originalFilename?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    }>,
    source: 'listing' | 'direct' = 'direct',
    sourceListingId?: string,
  ): Promise<number> {
    const normalized = ImageDriveService.normalizePartNumber(partNumber);
    if (!normalized || images.length === 0) return 0;

    let recorded = 0;
    for (const img of images) {
      if (!img.cdnUrl || !img.s3Key) continue;

      try {
        const existing = await this.driveRepo.findOne({
          where: {
            partNumberNormalized: normalized,
            s3Key: img.s3Key,
          },
          withDeleted: true,
        });

        if (existing) {
          if (existing.deletedAt) {
            await this.driveRepo.restore(existing.id);
            recorded++;
          }
          continue;
        }

        await this.driveRepo.save(
          this.driveRepo.create({
            partNumberNormalized: normalized,
            partNumberRaw: partNumber.trim(),
            cdnUrl: img.cdnUrl,
            s3Key: img.s3Key,
            originalFilename: img.originalFilename ?? null,
            mimeType: img.mimeType ?? null,
            fileSizeBytes: img.fileSizeBytes ?? 0,
            source,
            sourceListingId: sourceListingId ?? null,
          }),
        );
        recorded++;
      } catch (err) {
        this.logger.warn(
          `Failed to record image for part ${partNumber}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (recorded > 0) {
      this.logger.log(
        `Recorded ${recorded} image(s) for part ${partNumber} (source=${source})`,
      );
    }
    return recorded;
  }

  async recordFromListing(listingId: string): Promise<number> {
    const listing = await this.listingRepo.findOneBy({ id: listingId });
    if (!listing) return 0;

    const partNumber =
      listing.cManufacturerPartNumber?.trim() ||
      listing.cOeOemPartNumber?.trim();
    if (!partNumber) return 0;

    const images: Array<{
      cdnUrl: string;
      s3Key: string;
      originalFilename?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    }> = [];

    const assets = await this.imageAssetRepo.find({
      where: { listingId },
    });

    for (const asset of assets) {
      if (asset.cdnUrl && asset.s3Key) {
        images.push({
          cdnUrl: asset.cdnUrl,
          s3Key: asset.s3Key,
          originalFilename: asset.originalFilename ?? undefined,
          mimeType: asset.mimeType ?? undefined,
          fileSizeBytes: asset.fileSizeBytes ?? undefined,
        });
      }
    }

    if (images.length === 0) {
      const photoUrls = (listing.itemPhotoUrl ?? '')
        .split('|')
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http'));

      for (const url of photoUrls) {
        const key = this.extractS3KeyFromUrl(url);
        if (key) {
          images.push({ cdnUrl: url, s3Key: key });
        }
      }
    }

    return this.recordImages(partNumber, images, 'listing', listingId);
  }

  async recordFromPartNumber(
    partNumber: string,
    assetIds: string[],
  ): Promise<number> {
    if (assetIds.length === 0) return 0;

    const assets = await this.imageAssetRepo.find({
      where: { id: In(assetIds) },
    });

    const images = assets
      .filter((a) => a.cdnUrl && a.s3Key)
      .map((a) => ({
        cdnUrl: a.cdnUrl!,
        s3Key: a.s3Key,
        originalFilename: a.originalFilename ?? undefined,
        mimeType: a.mimeType ?? undefined,
        fileSizeBytes: a.fileSizeBytes ?? undefined,
      }));

    return this.recordImages(partNumber, images, 'direct');
  }

  async removeAsset(assetId: string): Promise<boolean> {
    const asset = await this.driveRepo.findOneBy({ id: assetId });
    if (!asset) return false;
    await this.driveRepo.softDelete(assetId);
    return true;
  }

  async search(
    query: string,
    page = 1,
    limit = 50,
  ): Promise<{
    items: ImageDriveEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const normalized = ImageDriveService.normalizePartNumber(query);
    const offset = (page - 1) * limit;

    const qb = this.driveRepo
      .createQueryBuilder('a')
      .where('a.part_number_normalized LIKE :q', { q: `%${normalized}%` });

    const total = await qb.getCount();
    const assets = await qb
      .orderBy('a.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      items: assets.map(this.toEntry),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async backfill(
    batchSize: number,
    offset: number,
  ): Promise<{
    processed: number;
    recorded: number;
    skipped: number;
    offset: number;
    nextOffset: number;
    remaining: number;
    message: string;
  }> {
    const listings = await this.listingRepo
      .createQueryBuilder('l')
      .where(
        `(l.c_manufacturer_part_number IS NOT NULL AND TRIM(l.c_manufacturer_part_number) != '')
         OR (l.c_oe_oem_part_number IS NOT NULL AND TRIM(l.c_oe_oem_part_number) != '')`,
      )
      .andWhere('l.deleted_at IS NULL')
      .orderBy('l.imported_at', 'ASC')
      .skip(offset)
      .take(batchSize)
      .getMany();

    let recorded = 0;
    let skipped = 0;
    for (const listing of listings) {
      try {
        const count = await this.recordFromListing(listing.id);
        if (count > 0) recorded += count;
        else skipped++;
      } catch {
        skipped++;
      }
    }

    const total = await this.listingRepo
      .createQueryBuilder('l')
      .where(
        `(l.c_manufacturer_part_number IS NOT NULL AND TRIM(l.c_manufacturer_part_number) != '')
         OR (l.c_oe_oem_part_number IS NOT NULL AND TRIM(l.c_oe_oem_part_number) != '')`,
      )
      .andWhere('l.deleted_at IS NULL')
      .getCount();

    const nextOffset = offset + listings.length;
    const remaining = Math.max(total - nextOffset, 0);

    return {
      processed: listings.length,
      recorded,
      skipped,
      offset,
      nextOffset,
      remaining,
      message:
        listings.length < batchSize
          ? 'Backfill complete'
          : `${remaining} listings remaining. Call again with offset=${nextOffset}`,
    };
  }

  async getStats(): Promise<{
    totalParts: number;
    totalImages: number;
  }> {
    const totalImages = await this.driveRepo.count();
    const result = await this.driveRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.part_number_normalized)', 'count')
      .getRawOne();
    const totalParts = parseInt(result?.count ?? '0', 10);

    return { totalParts, totalImages };
  }

  private toEntry(asset: ImageDriveAsset): ImageDriveEntry {
    return {
      id: asset.id,
      partNumberRaw: asset.partNumberRaw,
      cdnUrl: asset.cdnUrl,
      s3Key: asset.s3Key,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      source: asset.source,
      sourceListingId: asset.sourceListingId,
      createdAt: asset.createdAt,
    };
  }

  private extractS3KeyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const cdnDomain = this.storageService['cdnDomain'];
      const bucket = this.storageService.getBucket();

      if (cdnDomain && parsed.hostname === cdnDomain) {
        return parsed.pathname.replace(/^\//, '');
      }
      if (parsed.hostname.includes(`${bucket}.s3`)) {
        return parsed.pathname.replace(/^\//, '');
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';
import { IsNull, Not, Repository } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { ImageAsset } from './entities/image-asset.entity.js';
import { StorageService } from './storage.service.js';
import { ImageProcessorService } from './image-processor.service.js';
import {
  BulkRequestUploadDto,
  RequestUploadDto,
} from './dto/request-upload.dto.js';
import { UpdateAssetDto } from './dto/image-transform.dto.js';
import type {
  CatalogVariantJobData,
  ThumbnailJobData,
} from './processors/thumbnail.processor.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ListingRecord } from '../listings/listing-record.entity.js';
import { CatalogProduct } from '../catalog-import/entities/catalog-product.entity.js';

@ApiTags('Storage')
@Controller('storage')
@RequirePermissions('storage.view')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  /** Variant suffix pattern: e.g. .../hash_thumb.webp */
  private static readonly VARIANT_RE = /_(thumb|sm|medium|lg)\.webp$/;
  /** Original extensions to probe when locating the source of a variant. */
  private static readonly ORIGINAL_EXTS = [
    '.webp',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.heic',
  ];
  /** Max concurrent on-demand sharp generations (protects CPU on t3.medium). */
  private static readonly MAX_VARIANT_GEN = 4;
  /** Per-original in-flight dedup: collapses concurrent variant requests. */
  private readonly variantGenInflight = new Map<string, Promise<boolean>>();
  private activeVariantGen = 0;

  constructor(
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessorService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectRepository(CatalogProduct)
    private readonly catalogProductRepo: Repository<CatalogProduct>,
    @InjectQueue('storage-thumbnails')
    private readonly thumbnailQueue: Queue<
      ThumbnailJobData | CatalogVariantJobData
    >,
  ) {}

  /**
   * Generate a pre-signed S3 upload URL.
   */
  @Post('upload-url')
  @RequirePermissions('storage.upload')
  @ApiOperation({ summary: 'Get pre-signed S3 upload URL' })
  async getUploadUrl(@Body() dto: RequestUploadDto) {
    const { uploadUrl, s3Key, assetId } =
      await this.storageService.generateUploadUrl(
        dto.filename,
        dto.mimeType,
        dto.listingId,
      );

    // Pre-create the asset record (status: awaiting upload)
    const asset = this.assetRepo.create({
      id: assetId,
      listingId: dto.listingId ?? null,
      s3Bucket: this.storageService.getBucket(),
      s3Key,
      mimeType: dto.mimeType,
      fileSizeBytes: dto.fileSize ?? 0,
      originalFilename: dto.filename,
    });
    await this.assetRepo.save(asset);

    return { uploadUrl, s3Key, assetId };
  }

  /**
   * Confirm an upload completed and trigger thumbnail generation.
   */
  @Post('confirm')
  @RequirePermissions('storage.upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm upload and trigger thumbnail processing' })
  async confirmUpload(@Body() body: { assetId: string; listingId?: string }) {
    const asset = await this.assetRepo.findOneBy({ id: body.assetId });
    if (!asset) {
      throw new NotFoundException(`Asset ${body.assetId} not found`);
    }

    // Move from temp to permanent if needed
    if (body.listingId && this.storageService.isTempKey(asset.s3Key)) {
      const newKey = await this.storageService.confirmUpload(
        asset.s3Key,
        body.listingId,
        asset.id,
      );
      asset.s3Key = newKey;
      asset.listingId = body.listingId;
    }

    asset.cdnUrl = this.storageService.getCdnUrl(asset.s3Key);
    await this.assetRepo.save(asset);

    // Queue thumbnail generation
    await this.thumbnailQueue.add(
      'generate',
      { assetId: asset.id, s3Key: asset.s3Key },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { asset };
  }

  /**
   * Get all images for a listing.
   */
  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get all images for a listing' })
  async getListingImages(@Param('listingId') listingId: string) {
    const images = await this.assetRepo.find({
      where: { listingId },
      order: { sortOrder: 'ASC', uploadedAt: 'ASC' },
    });
    return { images };
  }

  /**
   * Update image metadata (sort order, primary flag).
   */
  @Patch(':assetId')
  @RequirePermissions('storage.manage')
  @ApiOperation({ summary: 'Update image sort order or primary flag' })
  async updateAsset(
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAssetDto,
  ) {
    const asset = await this.assetRepo.findOneBy({ id: assetId });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    // If setting as primary, unset all other primaries for same listing
    if (dto.isPrimary && asset.listingId) {
      await this.assetRepo.update(
        { listingId: asset.listingId, isPrimary: true, id: Not(assetId) },
        { isPrimary: false },
      );
    }

    Object.assign(asset, dto);
    await this.assetRepo.save(asset);
    return { asset };
  }

  /**
   * Soft-delete an image.
   */
  @Delete(':assetId')
  @RequirePermissions('storage.manage')
  @ApiOperation({ summary: 'Soft-delete an image' })
  async deleteAsset(@Param('assetId') assetId: string) {
    const asset = await this.assetRepo.findOneBy({ id: assetId });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    await this.assetRepo.softDelete(assetId);
    return { deleted: true };
  }

  /**
   * Generate multiple pre-signed upload URLs at once.
   */
  @Post('bulk-upload-urls')
  @RequirePermissions('storage.upload')
  @ApiOperation({ summary: 'Generate multiple pre-signed upload URLs' })
  async getBulkUploadUrls(@Body() body: BulkRequestUploadDto) {
    const results = await this.storageService.generateBulkUploadUrls(
      body.files,
      body.listingId,
    );

    // Pre-create asset records
    const assets = results.map((r) =>
      this.assetRepo.create({
        id: r.assetId,
        listingId: body.listingId ?? null,
        s3Bucket: this.storageService.getBucket(),
        s3Key: r.s3Key,
        mimeType:
          body.files.find((f) => r.s3Key.includes(f.filename.split('.')[0]))
            ?.mimeType ?? 'image/webp',
        fileSizeBytes: 0,
      }),
    );
    await this.assetRepo.save(assets);

    return { uploads: results };
  }

  /**
   * Backfill responsive variants for existing images.
   * Finds images missing s3_key_medium (pre-optimization) and re-queues
   * them for variant generation. Runs in batches to avoid queue flooding.
   *
   * POST /storage/backfill-variants?batchSize=50
   */
  @Post('backfill-variants')
  @RequirePermissions('storage.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Backfill responsive variants for existing images',
  })
  async backfillVariants(@Query('batchSize') batchSizeParam?: string) {
    const batchSize = Math.min(
      Math.max(parseInt(batchSizeParam ?? '50', 10) || 50, 1),
      500,
    );

    // Find active images missing the medium variant key
    const candidates = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .andWhere('a.s3_key IS NOT NULL')
      .andWhere('a.s3_key_medium IS NULL')
      .andWhere('a.s3_key NOT LIKE :temp', { temp: '%temp/%' })
      .orderBy('a.uploaded_at', 'DESC')
      .limit(batchSize)
      .getMany();

    if (candidates.length === 0) {
      return {
        queued: 0,
        remaining: 0,
        message: 'All images already have responsive variants',
      };
    }

    let queued = 0;
    for (const asset of candidates) {
      try {
        await this.thumbnailQueue.add(
          'generate',
          { assetId: asset.id, s3Key: asset.s3Key },
          {
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            // Deduplicate: skip if a job for this asset is already queued
            jobId: `backfill-${asset.id}`,
          },
        );
        queued++;
      } catch (err) {
        this.logger.warn(
          `Failed to queue backfill for asset ${asset.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Count remaining
    const remaining = await this.assetRepo
      .createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .andWhere('a.s3_key IS NOT NULL')
      .andWhere('a.s3_key_medium IS NULL')
      .andWhere('a.s3_key NOT LIKE :temp', { temp: '%temp/%' })
      .getCount();

    this.logger.log(
      `Backfill: queued ${queued} images for reprocessing, ${remaining} remaining`,
    );

    return {
      queued,
      remaining,
      message:
        remaining > 0
          ? `${remaining} images still need processing. Call again to continue.`
          : 'All images queued for processing',
    };
  }

  /**
   * Backfill responsive variants for catalog-imported images. These have no
   * image_assets row (mirrorRemoteImages writes straight to S3), so unlike
   * backfill-variants above this walks catalog_products.image_urls directly
   * and marks each product done via images_variants_generated_at once its
   * images are queued. Idempotent/resumable — call repeatedly to page
   * through the backlog.
   *
   * POST /storage/backfill-catalog-variants?batchSize=50
   */
  @Post('backfill-catalog-variants')
  @RequirePermissions('storage.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Backfill responsive variants for catalog-imported images',
  })
  async backfillCatalogVariants(@Query('batchSize') batchSizeParam?: string) {
    const batchSize = Math.min(
      Math.max(parseInt(batchSizeParam ?? '50', 10) || 50, 1),
      500,
    );

    const candidates = await this.catalogProductRepo
      .createQueryBuilder('p')
      .where('p.images_variants_generated_at IS NULL')
      .andWhere('p.image_urls IS NOT NULL')
      .andWhere('array_length(p.image_urls, 1) > 0')
      .orderBy('p.createdAt', 'DESC')
      .limit(batchSize)
      .getMany();

    if (candidates.length === 0) {
      return {
        productsQueued: 0,
        imagesQueued: 0,
        remaining: 0,
        message: 'All catalog products already have responsive variants',
      };
    }

    let imagesQueued = 0;
    let productsQueued = 0;
    for (const product of candidates) {
      try {
        for (const url of product.imageUrls ?? []) {
          const key = this.storageService.keyFromUrl(url);
          // Skip un-mirrored external URLs (e.g. eBay CDN) — nothing of
          // ours to generate variants for.
          if (!key) continue;
          await this.storageService.queueVariantGeneration(key);
          imagesQueued++;
        }
        await this.catalogProductRepo.update(product.id, {
          imagesVariantsGeneratedAt: new Date(),
        });
        productsQueued++;
      } catch (err) {
        this.logger.warn(
          `Failed to queue variant backfill for catalog product ${product.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const remaining = await this.catalogProductRepo
      .createQueryBuilder('p')
      .where('p.images_variants_generated_at IS NULL')
      .andWhere('p.image_urls IS NOT NULL')
      .andWhere('array_length(p.image_urls, 1) > 0')
      .getCount();

    this.logger.log(
      `Catalog variant backfill: ${productsQueued} products / ${imagesQueued} images queued, ${remaining} products remaining`,
    );

    return {
      productsQueued,
      imagesQueued,
      remaining,
      message:
        remaining > 0
          ? `${remaining} catalog products still need processing. Call again to continue.`
          : 'All catalog products queued for processing',
    };
  }

  /**
   * Public image proxy — streams S3 objects to the browser with proper
   * Content-Type and long-lived cache headers. No auth required so <img> tags
   * can use this directly.
   *
   * GET /storage/serve/mhn/catalog-images/uuid/part/000.jpg
   * GET /storage/serve/mhn/catalog-images/uuid/part/000_medium.webp
   */
  @Get('serve/*key')
  @Public()
  @SkipThrottle({ short: true, medium: true, long: true })
  @HttpCode(HttpStatus.OK)
  async serve(@Req() req: Request, @Res() res: Response) {
    // NestJS wildcard param joins path segments with commas — extract from
    // the raw URL instead to preserve slashes in the S3 key.
    const fullPath = req.url.split('?')[0]; // strip query string
    const prefix = '/api/storage/serve/';
    const idx = fullPath.indexOf(prefix);
    const s3Key =
      idx >= 0
        ? fullPath.substring(idx + prefix.length)
        : String(req.params['key'] ?? '')
            .replace(/,/g, '/')
            .replace(/^\//, '');

    if (!s3Key) {
      throw new NotFoundException('Missing S3 key');
    }

    try {
      await this.streamObject(s3Key, res);
      return;
    } catch (err: any) {
      const code = err?.$metadata?.httpStatusCode;
      const isMissing = code === 404 || err?.name === 'NoSuchKey';
      if (!isMissing) {
        this.logger.warn(`S3 serve failed for key=${s3Key}: ${err?.message}`);
        throw new NotFoundException(`Image not found: ${s3Key}`);
      }
    }

    // Self-healing: if a responsive variant (_thumb/_sm/_medium/_lg.webp) is
    // missing, generate it on demand from the original and retry once. This
    // avoids the frontend's expensive fallback to a multi-MB original — the
    // single variant request succeeds directly (then nginx caches it 30d).
    const generated = await this.ensureVariant(s3Key);
    if (generated) {
      try {
        await this.streamObject(s3Key, res);
        return;
      } catch (err: any) {
        this.logger.warn(
          `S3 serve retry failed after on-demand gen for key=${s3Key}: ${err?.message}`,
        );
      }
    }

    throw new NotFoundException(`Image not found: ${s3Key}`);
  }

  /**
   * Stream an S3 object to the Express response with long-lived cache
   * headers. Throws on missing object (NoSuchKey) so the caller can react.
   */
  private async streamObject(s3Key: string, res: Response): Promise<void> {
    const { stream, contentType, contentLength, etag } =
      await this.storageService.getObjectStream(s3Key);

    res.set({
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
      ...(etag ? { ETag: etag } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });

    // The S3 SDK returns a Node.js Readable stream — pipe it directly
    // to the Express response for zero-copy streaming.
    const body = stream as any;
    if (typeof body?.pipe === 'function') {
      body.pipe(res);
    } else {
      // Fallback: buffer and send (shouldn't happen with S3 GetObject)
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
      }
      res.send(Buffer.concat(chunks));
    }
  }

  /**
   * On-demand responsive-variant generation. When a variant
   * (_thumb/_sm/_medium/_lg.webp) is requested but missing from S3, derive
   * the original key, generate all variants via the image processor, and
   * signal the caller to retry the GET. Self-healing: every variant
   * eventually exists without the frontend falling back to a multi-MB
   * original.
   *
   * Bounded to MAX_VARIANT_GEN concurrent generations to protect CPU; per-
   * original in-flight dedup collapses concurrent requests for variants of
   * the same image (e.g. thumb + medium on the same page). Returns true if
   * the variant is now available, false if it could not be produced
   * (original missing, or concurrency budget exhausted).
   */
  private async ensureVariant(variantKey: string): Promise<boolean> {
    const m = variantKey.match(StorageController.VARIANT_RE);
    if (!m) return false;
    const base = variantKey.slice(0, -m[0].length);

    const existing = this.variantGenInflight.get(base);
    if (existing) return existing;

    const p = this.doEnsureVariant(base);
    this.variantGenInflight.set(base, p);
    try {
      return await p;
    } finally {
      this.variantGenInflight.delete(base);
    }
  }

  private async doEnsureVariant(base: string): Promise<boolean> {
    // Locate the original object (variant key stripped of _suffix.webp).
    let originalKey: string | null = null;
    for (const ext of StorageController.ORIGINAL_EXTS) {
      try {
        if (await this.storageService.objectExists(base + ext)) {
          originalKey = base + ext;
          break;
        }
      } catch {
        // HEAD error — try the next extension
      }
    }
    if (!originalKey) return false;

    // Bound concurrent sharp generations to protect the event loop / CPU.
    if (this.activeVariantGen >= StorageController.MAX_VARIANT_GEN) {
      return false;
    }
    this.activeVariantGen++;
    try {
      await this.imageProcessor.processImage(originalKey);
      this.logger.log(`On-demand variants generated for ${originalKey}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `On-demand variant generation failed for ${originalKey}: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    } finally {
      this.activeVariantGen--;
    }
  }
}

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
import { ImageAsset } from './entities/image-asset.entity.js';
import { StorageService } from './storage.service.js';
import { ImageDriveService } from './image-drive.service.js';
import {
  BulkRequestUploadDto,
  RequestUploadDto,
} from './dto/request-upload.dto.js';
import { UpdateAssetDto } from './dto/image-transform.dto.js';
import type { ThumbnailJobData } from './processors/thumbnail.processor.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ListingRecord } from '../listings/listing-record.entity.js';

@ApiTags('Storage')
@Controller('storage')
@RequirePermissions('storage.view')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly imageDriveService: ImageDriveService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectRepository(ListingRecord)
    private readonly listingRepo: Repository<ListingRecord>,
    @InjectQueue('storage-thumbnails')
    private readonly thumbnailQueue: Queue<ThumbnailJobData>,
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

    // Record to Image Drive if linked to a listing with a part number
    if (asset.listingId) {
      this.imageDriveService.recordFromListing(asset.listingId).catch((err) =>
        this.logger.warn(
          `Image Drive record failed for listing ${asset.listingId}: ${err instanceof Error ? err.message : err}`,
        ),
      );
    }

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
  async backfillVariants(
    @Query('batchSize') batchSizeParam?: string,
  ) {
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
   * Public image proxy — streams S3 objects to the browser with proper
   * Content-Type and long-lived cache headers. No auth required so <img> tags
   * can use this directly.
   *
   * GET /storage/serve/mhn/catalog-images/uuid/part/000.jpg
   * GET /storage/serve/mhn/catalog-images/uuid/part/000_medium.webp
   */
  @Get('serve/*key')
  @Public()
  @HttpCode(HttpStatus.OK)
  async serve(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // NestJS wildcard param joins path segments with commas — extract from
    // the raw URL instead to preserve slashes in the S3 key.
    const fullPath = req.url.split('?')[0]; // strip query string
    const prefix = '/api/storage/serve/';
    const idx = fullPath.indexOf(prefix);
    const s3Key = idx >= 0
      ? fullPath.substring(idx + prefix.length)
      : req.params['key']?.replace(/,/g, '/').replace(/^\//, '');

    if (!s3Key) {
      throw new NotFoundException('Missing S3 key');
    }

    try {
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
    } catch (err: any) {
      const code = err?.$metadata?.httpStatusCode;
      if (code === 404 || err?.name === 'NoSuchKey') {
        throw new NotFoundException(`Image not found: ${s3Key}`);
      }
      this.logger.warn(`S3 serve failed for key=${s3Key}: ${err?.message}`);
      throw new NotFoundException(`Image not found: ${s3Key}`);
    }
  }
}

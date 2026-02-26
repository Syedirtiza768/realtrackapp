import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';
import { IsNull, Not, Repository } from 'typeorm';
import { ImageAsset } from './entities/image-asset.entity.js';
import { StorageService } from './storage.service.js';
import { RequestUploadDto } from './dto/request-upload.dto.js';
import { UpdateAssetDto } from './dto/image-transform.dto.js';
import type { ThumbnailJobData } from './processors/thumbnail.processor.js';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
    @InjectQueue('storage-thumbnails')
    private readonly thumbnailQueue: Queue<ThumbnailJobData>,
  ) {}

  /**
   * Generate a pre-signed S3 upload URL.
   */
  @Post('upload-url')
  @ApiOperation({ summary: 'Get pre-signed S3 upload URL' })
  async getUploadUrl(@Body() dto: RequestUploadDto) {
    const { uploadUrl, s3Key, assetId } = await this.storageService.generateUploadUrl(
      dto.filename,
      dto.mimeType,
      dto.listingId,
    );

    // Pre-create the asset record (status: awaiting upload)
    const asset = this.assetRepo.create({
      id: assetId,
      listingId: dto.listingId ?? null,
      s3Bucket: 'realtrack-images',
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm upload and trigger thumbnail processing' })
  async confirmUpload(@Body() body: { assetId: string; listingId?: string }) {
    const asset = await this.assetRepo.findOneBy({ id: body.assetId });
    if (!asset) {
      throw new NotFoundException(`Asset ${body.assetId} not found`);
    }

    // Move from temp to permanent if needed
    if (body.listingId && asset.s3Key.startsWith('temp/')) {
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
  @ApiOperation({ summary: 'Generate multiple pre-signed upload URLs' })
  async getBulkUploadUrls(
    @Body() body: { files: Array<{ filename: string; mimeType: string }>; listingId?: string },
  ) {
    const results = await this.storageService.generateBulkUploadUrls(
      body.files,
      body.listingId,
    );

    // Pre-create asset records
    const assets = results.map((r) =>
      this.assetRepo.create({
        id: r.assetId,
        listingId: body.listingId ?? null,
        s3Bucket: 'realtrack-images',
        s3Key: r.s3Key,
        mimeType: body.files.find((f) => r.s3Key.includes(f.filename.split('.')[0]))?.mimeType ?? 'image/webp',
        fileSizeBytes: 0,
      }),
    );
    await this.assetRepo.save(assets);

    return { uploads: results };
  }
}

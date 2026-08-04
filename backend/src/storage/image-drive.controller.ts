import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { ImageDriveService } from './image-drive.service.js';
import { StorageService } from './storage.service.js';
import { ImageAsset } from './entities/image-asset.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ImageDriveBatchLookupDto,
  ImageDriveRecordFromPartDto,
  ImageDriveSearchDto,
} from './dto/image-drive.dto.js';

@ApiTags('Image Drive')
@Controller('image-drive')
@RequirePermissions('image_drive.view')
export class ImageDriveController {
  constructor(
    private readonly imageDriveService: ImageDriveService,
    private readonly storageService: StorageService,
    @InjectRepository(ImageAsset)
    private readonly assetRepo: Repository<ImageAsset>,
  ) {}

  @Post('upload')
  @RequirePermissions('image_drive.upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 24))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload images directly to the Image Drive by part number',
  })
  async uploadDirect(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('partNumber') partNumber: string,
  ) {
    if (!partNumber?.trim()) {
      throw new BadRequestException('partNumber is required');
    }
    if (!files?.length) {
      throw new BadRequestException('At least one file is required');
    }

    const uploaded: Array<{ cdnUrl: string; s3Key: string }> = [];

    for (const file of files) {
      const mimeType = file.mimetype || 'image/jpeg';
      const { uploadUrl, s3Key, assetId } =
        await this.storageService.generateUploadUrl(
          file.originalname,
          mimeType,
        );

      await this.storageService.putObject(s3Key, file.buffer, mimeType);
      const cdnUrl = this.storageService.getCdnUrl(s3Key);

      await this.assetRepo.save(
        this.assetRepo.create({
          id: assetId,
          s3Bucket: this.storageService.getBucket(),
          s3Key,
          mimeType,
          fileSizeBytes: file.size,
          originalFilename: file.originalname,
          cdnUrl,
        }),
      );

      uploaded.push({ cdnUrl, s3Key });
    }

    const recorded = await this.imageDriveService.recordImages(
      partNumber.trim(),
      uploaded.map((u, i) => ({
        ...u,
        originalFilename: files[i].originalname,
        mimeType: files[i].mimetype,
        fileSizeBytes: files[i].size,
      })),
      'direct',
    );

    return { recorded, images: uploaded };
  }

  @Get('lookup/:partNumber')
  @ApiOperation({ summary: 'Get all images for a part number' })
  async findByPartNumber(@Param('partNumber') partNumber: string) {
    const images =
      await this.imageDriveService.findByPartNumber(partNumber);
    return { partNumber, images, count: images.length };
  }

  @Post('lookup')
  @ApiOperation({ summary: 'Batch lookup images by part numbers' })
  async batchLookup(@Body() dto: ImageDriveBatchLookupDto) {
    if (!dto.partNumbers?.length) {
      throw new BadRequestException('partNumbers array is required');
    }
    const result = await this.imageDriveService.findByPartNumbers(
      dto.partNumbers,
    );

    const summary = dto.partNumbers.map((pn) => {
      const normalized =
        ImageDriveService.normalizePartNumber(pn);
      const images = result[normalized] ?? [];
      return { partNumber: pn, count: images.length };
    });

    return { results: result, summary };
  }

  @Post('record')
  @RequirePermissions('image_drive.upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record existing image assets against a part number',
  })
  async recordFromPartNumber(@Body() dto: ImageDriveRecordFromPartDto) {
    if (!dto.partNumber?.trim()) {
      throw new BadRequestException('partNumber is required');
    }
    if (!dto.assetIds?.length) {
      throw new BadRequestException('assetIds array is required');
    }
    const recorded = await this.imageDriveService.recordFromPartNumber(
      dto.partNumber,
      dto.assetIds,
    );
    return { recorded };
  }

  @Delete(':assetId')
  @RequirePermissions('image_drive.manage')
  @ApiOperation({ summary: 'Remove an image from the Image Drive' })
  async removeAsset(@Param('assetId') assetId: string) {
    const removed = await this.imageDriveService.removeAsset(assetId);
    if (!removed) {
      throw new NotFoundException(`Image Drive asset ${assetId} not found`);
    }
    return { deleted: true };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search the Image Drive by part number' })
  async search(@Query() query: ImageDriveSearchDto) {
    if (!query.q?.trim()) {
      throw new BadRequestException('q (query) is required');
    }
    return this.imageDriveService.search(
      query.q,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  @Post('backfill')
  @RequirePermissions('image_drive.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Bulk-index all listing images into the Image Drive by part number. ' +
      'Reads S3 URLs from image_assets and listing_records.itemPhotoUrl — no files downloaded.',
  })
  async backfill(
    @Query('batchSize') batchSizeParam?: string,
    @Query('offset') offsetParam?: string,
  ) {
    const batchSize = Math.min(
      Math.max(parseInt(batchSizeParam ?? '200', 10) || 200, 1),
      1000,
    );
    const offset = Math.max(parseInt(offsetParam ?? '0', 10) || 0, 0);
    return this.imageDriveService.backfill(batchSize, offset);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get Image Drive statistics' })
  async getStats() {
    return this.imageDriveService.getStats();
  }
}

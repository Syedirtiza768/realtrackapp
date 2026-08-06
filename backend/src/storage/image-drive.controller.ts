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
  Patch,
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
import {
  AutoCreateUploadDto,
  CreateFolderDto,
  ImageDriveBatchLookupDto,
  ListFilesDto,
  SearchDriveDto,
  UpdateFolderDto,
} from './dto/image-drive.dto.js';

@ApiTags('Image Drive')
@Controller('image-drive')
@RequirePermissions('image_drive.view')
export class ImageDriveController {
  constructor(
    private readonly imageDriveService: ImageDriveService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Folders ─────────────────────────────────────────────────

  @Get('folders')
  @ApiOperation({ summary: 'List all folders' })
  async listFolders() {
    return this.imageDriveService.listFolders();
  }

  @Post('folders')
  @RequirePermissions('image_drive.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new folder' })
  async createFolder(@Body() dto: CreateFolderDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Folder name is required');
    }
    return this.imageDriveService.createFolder(dto.name, dto.linkedPartNumber);
  }

  @Patch('folders/:folderId')
  @RequirePermissions('image_drive.manage')
  @ApiOperation({ summary: 'Update folder name or linked part number' })
  async updateFolder(
    @Param('folderId') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.imageDriveService.updateFolder(folderId, {
      name: dto.name,
      linkedPartNumber: dto.linkedPartNumber,
    });
  }

  @Delete('folders/:folderId')
  @RequirePermissions('image_drive.manage')
  @ApiOperation({ summary: 'Delete a folder and all its files' })
  async deleteFolder(@Param('folderId') folderId: string) {
    await this.imageDriveService.deleteFolder(folderId);
    return { deleted: true };
  }

  // ─── Files ───────────────────────────────────────────────────

  @Get('folders/:folderId/files')
  @ApiOperation({ summary: 'List files in a folder' })
  async listFiles(
    @Param('folderId') folderId: string,
    @Query() query: ListFilesDto,
  ) {
    return this.imageDriveService.listFiles(
      folderId,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  @Post('folders/:folderId/upload')
  @RequirePermissions('image_drive.upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload files to a folder' })
  async uploadToFolder(
    @Param('folderId') folderId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required');
    }

    const folder = await this.imageDriveService.getFolder(folderId);
    if (!folder) {
      throw new NotFoundException(`Folder ${folderId} not found`);
    }

    const uploaded: Array<{
      filename: string;
      cdnUrl: string;
      s3Key: string;
      fileSizeBytes: number;
    }> = [];

    for (const file of files) {
      const mimeType = file.mimetype || 'image/jpeg';
      const ext = this.storageService.sanitizeExtension(file.originalname);
      const s3Key = `${folder.s3Prefix}${file.originalname}`;

      await this.storageService.putObject(s3Key, file.buffer, mimeType);
      const cdnUrl = this.storageService.getCdnUrl(s3Key);

      const entry = await this.imageDriveService.addFile(folderId, {
        filename: file.originalname,
        s3Key,
        cdnUrl,
        mimeType,
        fileSizeBytes: file.size,
      });

      this.storageService
        .queueDriveVariantGeneration(entry.id, s3Key)
        .catch((err) =>
          this.storageService['logger']?.warn?.(
            `Variant queue failed for ${s3Key}: ${err}`,
          ),
        );

      uploaded.push({
        filename: file.originalname,
        cdnUrl,
        s3Key,
        fileSizeBytes: file.size,
      });
    }

    return { uploaded: uploaded.length, files: uploaded };
  }

  @Post('upload')
  @RequirePermissions('image_drive.upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload files with auto-create folder. If folderId="auto", creates folder from folderName.',
  })
  async uploadAutoCreate(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderId') folderId: string,
    @Body('folderName') folderName: string,
    @Body('partNumber') partNumber: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required');
    }

    let resolvedFolderId = folderId;

    if (folderId === 'auto' || !folderId) {
      if (!folderName?.trim()) {
        throw new BadRequestException(
          'folderName is required when folderId is "auto"',
        );
      }
      const folder = await this.imageDriveService.findOrCreateFolder(
        folderName,
        partNumber,
      );
      resolvedFolderId = folder.id;
    }

    const folder = await this.imageDriveService.getFolder(resolvedFolderId);
    if (!folder) {
      throw new NotFoundException(`Folder ${resolvedFolderId} not found`);
    }

    const uploaded: Array<{ filename: string; cdnUrl: string; s3Key: string }> =
      [];

    for (const file of files) {
      const mimeType = file.mimetype || 'image/jpeg';
      const s3Key = `${folder.s3Prefix}${file.originalname}`;

      await this.storageService.putObject(s3Key, file.buffer, mimeType);
      const cdnUrl = this.storageService.getCdnUrl(s3Key);

      const entry = await this.imageDriveService.addFile(resolvedFolderId, {
        filename: file.originalname,
        s3Key,
        cdnUrl,
        mimeType,
        fileSizeBytes: file.size,
      });

      this.storageService
        .queueDriveVariantGeneration(entry.id, s3Key)
        .catch(() => {});

      uploaded.push({ filename: file.originalname, cdnUrl, s3Key });
    }

    return {
      folderId: resolvedFolderId,
      folderName: folder.name,
      uploaded: uploaded.length,
      files: uploaded,
    };
  }

  @Delete('files/:fileId')
  @RequirePermissions('image_drive.manage')
  @ApiOperation({ summary: 'Delete a single file' })
  async deleteFile(@Param('fileId') fileId: string) {
    const removed = await this.imageDriveService.deleteFile(fileId);
    if (!removed) {
      throw new NotFoundException(`File ${fileId} not found`);
    }
    return { deleted: true };
  }

  // ─── Lookup (auto-attach) ────────────────────────────────────

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
      const normalized = ImageDriveService.normalizePartNumber(pn);
      const images = result[normalized] ?? [];
      return { partNumber: pn, count: images.length };
    });

    return { results: result, summary };
  }

  // ─── Search ──────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Search Image Drive by folder name or part number' })
  async search(@Query() query: SearchDriveDto) {
    if (!query.q?.trim()) {
      throw new BadRequestException('q (query) is required');
    }
    return this.imageDriveService.search(
      query.q,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  // ─── Stats ───────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get Image Drive statistics' })
  async getStats() {
    return this.imageDriveService.getStats();
  }
}

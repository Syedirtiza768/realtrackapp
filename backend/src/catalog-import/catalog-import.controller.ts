import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CatalogImportService } from './catalog-import.service.js';
import {
  BackfillListingsDto,
  ClearCatalogDto,
  ImportQueryDto,
  ImportRowQueryDto,
  StartImportDto,
} from './dto/catalog-import.dto.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';

@ApiTags('Catalog Import')
@Controller('catalog-import')
@RequirePermissions('catalog.view')
export class CatalogImportController {
  constructor(
    private readonly importService: CatalogImportService,
    private readonly rbac: RbacService,
  ) {}

  /* ── Upload ────────────────────────────────────────────── */

  @Post('upload')
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @RequirePermissions('catalog.import')
  @UseInterceptors(
    FileInterceptor('file', {
      // Use diskStorage so multer streams the file directly to disk.
      // In multer 2.x, omitting storage leaves file.buffer undefined;
      // diskStorage populates file.path instead, which handleUpload reads.
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir =
            process.env.CATALOG_UPLOAD_DIR ??
            path.resolve(process.cwd(), 'uploads', 'catalog');
          fs.mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const safeFileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          cb(null, safeFileName);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB max
      fileFilter: (_req, file, cb) => {
        const name = file.originalname.toLowerCase();
        if (
          file.mimetype === 'text/csv' ||
          name.endsWith('.csv') ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          name.endsWith('.xlsx') ||
          file.mimetype === 'application/vnd.ms-excel' ||
          name.endsWith('.xls')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV and Excel (.xlsx, .xls) files are accepted'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CSV or Excel catalog file for import' })
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Body('columnMapping') columnMappingStr?: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV or Excel file is required');
    }

    let columnMapping: Record<string, string> | undefined;
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr);
      } catch {
        // Ignore — will use auto-mapping
      }
    }

    const importRecord = await this.importService.handleUpload(
      file,
      columnMapping,
      user.id,
    );
    return {
      import: importRecord,
      detectedHeaders: importRecord.detectedHeaders,
      columnMapping: importRecord.columnMapping,
      catalogFields: this.importService.getCatalogFields(),
    };
  }

  /* ── Start processing ──────────────────────────────────── */

  @Post('start')
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('catalog.import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start processing an uploaded CSV import' })
  async startImport(@Body() dto: StartImportDto, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    const importRecord = await this.importService.startImport(
      dto.importId,
      dto.columnMapping,
      user.id,
      viewAll,
    );
    return { import: importRecord };
  }

  @Post('backfill-listings')
  @RequirePermissions('catalog.import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backfill listing_records from existing catalog imports' })
  async backfillListings(@Body() dto: BackfillListingsDto) {
    const result = await this.importService.backfillListings(dto.importId);
    return { result };
  }

  @Post('clear-all')
  @RequirePermissions('catalog.clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete all catalog_products, CSV import jobs/rows, compliance audit logs, and every listing_record (browse /catalog)',
  })
  async clearAllCatalog(@Body() dto: ClearCatalogDto) {
    const result = await this.importService.clearAllCatalog(dto.confirm);
    return { result };
  }

  /* ── List imports ──────────────────────────────────────── */

  @Get()
  @ApiOperation({ summary: 'List catalog imports' })
  async listImports(
    @CurrentUser() user: User,
    @Query() query: ImportQueryDto,
  ) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    return this.importService.listImports(
      query.status,
      query.limit ?? 20,
      query.offset ?? 0,
      user.id,
      viewAll,
    );
  }

  /* ── Get single import ─────────────────────────────────── */

  @Get('stats')
  @ApiOperation({ summary: 'Get catalog import aggregate stats' })
  async getStats() {
    return this.importService.getImportStats();
  }

  @Get('fields')
  @ApiOperation({ summary: 'Get available catalog fields for column mapping' })
  getCatalogFields() {
    return { fields: this.importService.getCatalogFields() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific catalog import' })
  async getImport(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    return this.importService.getImport(id, user.id, viewAll);
  }

  /* ── Import rows ───────────────────────────────────────── */

  @Get(':id/rows')
  @ApiOperation({ summary: 'Get rows for a specific import' })
  async getImportRows(
    @Param('id') id: string,
    @Query() query: ImportRowQueryDto,
  ) {
    return this.importService.getImportRows(
      id,
      query.status,
      query.limit ?? 50,
      query.offset ?? 0,
    );
  }

  /* ── Cancel import ─────────────────────────────────────── */

  @Post(':id/cancel')
  @RequirePermissions('catalog.import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or processing import' })
  async cancelImport(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    const importRecord = await this.importService.cancelImport(id, user.id, viewAll);
    return { import: importRecord };
  }

  /* ── Retry import ──────────────────────────────────────── */

  @Post(':id/retry')
  @RequirePermissions('catalog.import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed import (resumes from last row)' })
  async retryImport(@Param('id') id: string, @CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'users.view');
    const importRecord = await this.importService.retryImport(id, user.id, viewAll);
    return { import: importRecord };
  }
}

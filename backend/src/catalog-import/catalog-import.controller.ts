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
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogImportService } from './catalog-import.service.js';
import {
  BackfillListingsDto,
  ImportQueryDto,
  ImportRowQueryDto,
  StartImportDto,
} from './dto/catalog-import.dto.js';

@ApiTags('Catalog Import')
@Controller('catalog-import')
export class CatalogImportController {
  constructor(private readonly importService: CatalogImportService) {}

  /* ── Upload ────────────────────────────────────────────── */

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.originalname.toLowerCase().endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are accepted'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CSV catalog file for import' })
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('columnMapping') columnMappingStr?: string,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start processing an uploaded CSV import' })
  async startImport(@Body() dto: StartImportDto) {
    const importRecord = await this.importService.startImport(
      dto.importId,
      dto.columnMapping,
    );
    return { import: importRecord };
  }

  /* ── List imports ──────────────────────────────────────── */

  @Get()
  @ApiOperation({ summary: 'List catalog imports' })
  async listImports(@Query() query: ImportQueryDto) {
    return this.importService.listImports(
      query.status,
      query.limit ?? 20,
      query.offset ?? 0,
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
  async getImport(@Param('id') id: string) {
    return this.importService.getImport(id);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or processing import' })
  async cancelImport(@Param('id') id: string) {
    const importRecord = await this.importService.cancelImport(id);
    return { import: importRecord };
  }

  /* ── Retry import ──────────────────────────────────────── */

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed import (resumes from last row)' })
  async retryImport(@Param('id') id: string) {
    const importRecord = await this.importService.retryImport(id);
    return { import: importRecord };
  }

  @Post('backfill-listings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backfill listing_records from existing catalog imports' })
  async backfillListings(@Body() dto: BackfillListingsDto) {
    const result = await this.importService.backfillListings(dto.importId);
    return { result };
  }
}

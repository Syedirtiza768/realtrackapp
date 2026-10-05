import { VerticalsService } from '../verticals/verticals.service.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import {
  CatalogImportService,
  type ImportAccessScope,
} from './catalog-import.service.js';
import { IsIn, IsOptional } from 'class-validator';
import type { ProductVertical } from '../verticals/vertical.types.js';
import {
  BackfillListingsDto,
  ClearCatalogDto,
  ImportQueryDto,
  ImportRowQueryDto,
  StartImportDto,
} from './dto/catalog-import.dto.js';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';

export class ScopedImportQueryDto extends ImportQueryDto {
  @IsOptional()
  @IsIn(['automotive', 'fashion', 'business_industrial'])
  vertical?: ProductVertical;
}

@ApiTags('Catalog Import')
@Controller('catalog-import')
@RequireAnyPermission(
  'catalog.view',
  'fashion.import',
  'business_industrial.access',
)
export class CatalogImportController {
  constructor(
    private readonly importService: CatalogImportService,
    private readonly rbac: RbacService,
    private readonly userOrganizations: UserOrganizationService,
    private readonly verticals: VerticalsService,
  ) {}

  private async scope(
    user: User,
    vertical?: ProductVertical,
  ): Promise<ImportAccessScope> {
    const [organization, viewAll, catalog, fashion, businessIndustrial] =
      await Promise.all([
        this.userOrganizations.resolveOrganizationId(user.id),
        this.rbac.userHasPermission(user.id, 'users.view'),
        this.rbac.userHasPermission(user.id, 'catalog.view'),
        this.rbac.userHasPermission(user.id, 'fashion.import'),
        this.rbac.userHasPermission(user.id, 'business_industrial.access'),
      ]);
    const allowed: ProductVertical[] = catalog ? ['automotive'] : [];
    if (fashion) allowed.push('fashion');
    if (businessIndustrial) allowed.push('business_industrial');
    if (vertical && !allowed.includes(vertical))
      throw new ForbiddenException(
        'Import permission is required for this vertical',
      );
    return {
      organizationId: organization.organizationId,
      viewerId: user.id,
      viewAll,
      verticals: vertical ? [vertical] : allowed,
    };
  }

  private async accessibleImport(id: string, user: User, write = false) {
    const scope = await this.scope(user);
    // Import-only catalog/B&I users retain their existing write access.
    if (write) {
      if (await this.rbac.userHasPermission(user.id, 'catalog.import'))
        scope.verticals.push('automotive');
      if (
        await this.rbac.userHasPermission(user.id, 'business_industrial.import')
      )
        scope.verticals.push('business_industrial');
    }
    const result = await this.importService.getImport(
      id,
      user.id,
      scope.viewAll,
      scope,
    );
    if (write) {
      const vertical = result.import.vertical ?? 'automotive';
      const permission =
        vertical === 'fashion'
          ? 'fashion.import'
          : vertical === 'business_industrial'
            ? 'business_industrial.import'
            : 'catalog.import';
      if (!(await this.rbac.userHasPermission(user.id, permission)))
        throw new ForbiddenException(
          'Import permission is required for this vertical',
        );
      await this.verticals.assertIntakeVerticalEnabled(vertical);
    }
    return { ...result, viewAll: scope.viewAll };
  }

  private validateFashionMapping(
    mapping: Record<string, string>,
    headers: string[],
  ) {
    const fields = new Set(
      this.importService.getCatalogFields().map((field) => field.field),
    );
    const values = Object.values(mapping);
    if (
      !mapping ||
      Array.isArray(mapping) ||
      Object.entries(mapping).some(
        ([header, field]) =>
          !headers.includes(header) ||
          typeof field !== 'string' ||
          !fields.has(field),
      )
    ) {
      throw new BadRequestException(
        'Column mapping must use detected headers and supported catalog fields',
      );
    }
    if (!values.includes('title'))
      throw new BadRequestException(
        'Map a column to Product Title before starting',
      );
    if (new Set(values).size !== values.length)
      throw new BadRequestException('Map each catalog field only once');
  }

  /* ── Upload ────────────────────────────────────────────── */

  @Post('upload')
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @RequireAnyPermission(
    'catalog.import',
    'fashion.import',
    'business_industrial.import',
  )
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
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          name.endsWith('.xlsx') ||
          file.mimetype === 'application/vnd.ms-excel' ||
          name.endsWith('.xls')
        ) {
          cb(null, true);
        } else {
          cb(
            new Error('Only CSV and Excel (.xlsx, .xls) files are accepted'),
            false,
          );
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
    @Body('vertical') verticalRaw?: string,
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

    const organization = await this.userOrganizations.resolveOrganizationId(
      user.id,
    );
    const vertical = this.verticals.normalizeIntakeVertical(
      verticalRaw ?? 'automotive',
    );
    const hasFashionImport = await this.rbac.userHasPermission(
      user.id,
      'fashion.import',
    );
    const hasBusinessIndustrialImport = await this.rbac.userHasPermission(
      user.id,
      'business_industrial.import',
    );
    const hasCatalogImport = await this.rbac.userHasPermission(
      user.id,
      'catalog.import',
    );
    const allowed =
      vertical === 'fashion'
        ? hasFashionImport
        : vertical === 'business_industrial'
          ? hasBusinessIndustrialImport
          : hasCatalogImport;
    if (!allowed) {
      throw new BadRequestException(
        vertical === 'fashion'
          ? 'Fashion import permission is required for Fashion imports'
          : vertical === 'business_industrial'
            ? 'Business & Industrial import permission is required for Business & Industrial imports'
            : 'Catalog import permission is required for automotive imports',
      );
    }
    await this.verticals.assertIntakeVerticalEnabled(vertical);
    const importRecord = await this.importService.handleUpload(
      file,
      columnMapping,
      user.id,
      vertical,
      organization.organizationId,
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
  @RequireAnyPermission(
    'catalog.import',
    'fashion.import',
    'business_industrial.import',
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start processing an uploaded CSV import' })
  async startImport(@Body() dto: StartImportDto, @CurrentUser() user: User) {
    const importContext = await this.accessibleImport(dto.importId, user, true);
    const viewAll = importContext.viewAll;
    if (importContext.import.vertical === 'fashion') {
      if (!importContext.import.totalRows)
        throw new BadRequestException('The source file has no data rows');
      this.validateFashionMapping(
        dto.columnMapping ?? importContext.import.columnMapping ?? {},
        importContext.import.detectedHeaders,
      );
    }
    const isFashion = importContext.import.vertical === 'fashion';
    const isBusinessIndustrial =
      importContext.import.vertical === 'business_industrial';
    const allowed = await this.rbac.userHasPermission(
      user.id,
      isFashion
        ? 'fashion.import'
        : isBusinessIndustrial
          ? 'business_industrial.import'
          : 'catalog.import',
    );
    if (!allowed) {
      throw new BadRequestException(
        isFashion
          ? 'Fashion import permission is required for this import'
          : isBusinessIndustrial
            ? 'Business & Industrial import permission is required for this import'
            : 'Catalog import permission is required for this import',
      );
    }
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
  @ApiOperation({
    summary: 'Backfill listing_records from existing catalog imports',
  })
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
    @Query() query: ScopedImportQueryDto,
  ) {
    const scope = await this.scope(user, query.vertical);
    return this.importService.listImports(
      query.status,
      query.limit ?? 20,
      query.offset ?? 0,
      user.id,
      scope.viewAll,
      scope,
    );
  }

  /* ── Get single import ─────────────────────────────────── */

  @Get('stats')
  @ApiOperation({ summary: 'Get catalog import aggregate stats' })
  async getStats(
    @CurrentUser() user: User,
    @Query() query: ScopedImportQueryDto,
  ) {
    return this.importService.getImportStats(
      await this.scope(user, query.vertical),
    );
  }

  @Get('fields')
  @ApiOperation({ summary: 'Get available catalog fields for column mapping' })
  getCatalogFields() {
    return { fields: this.importService.getCatalogFields() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific catalog import' })
  async getImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const { import: record, verification } = await this.accessibleImport(
      id,
      user,
    );
    return { import: record, verification };
  }

  @Get(':id/preview')
  @RequireAnyPermission(
    'catalog.view',
    'fashion.import',
    'business_industrial.import',
  )
  @ApiOperation({
    summary: 'Preview the first five source rows of an accessible import',
  })
  async previewImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const { import: record } = await this.accessibleImport(id, user);
    return {
      rows: await this.importService.previewImport(record),
      fields: this.importService.getCatalogFields(),
    };
  }

  /* ── Import rows ───────────────────────────────────────── */

  @Get(':id/rows')
  @ApiOperation({ summary: 'Get rows for a specific import' })
  async getImportRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ImportRowQueryDto,
    @CurrentUser() user: User,
  ) {
    await this.accessibleImport(id, user);
    return this.importService.getImportRows(
      id,
      query.status,
      query.limit ?? 50,
      query.offset ?? 0,
    );
  }

  /* ── Cancel import ─────────────────────────────────────── */

  @Post(':id/cancel')
  @RequireAnyPermission(
    'catalog.import',
    'fashion.import',
    'business_industrial.import',
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or processing import' })
  async cancelImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const { viewAll } = await this.accessibleImport(id, user, true);
    const importRecord = await this.importService.cancelImport(
      id,
      user.id,
      viewAll,
    );
    return { import: importRecord };
  }

  /* ── Retry import ──────────────────────────────────────── */

  @Post(':id/retry')
  @RequireAnyPermission(
    'catalog.import',
    'fashion.import',
    'business_industrial.import',
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed import (resumes from last row)' })
  async retryImport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const { viewAll } = await this.accessibleImport(id, user, true);
    const importRecord = await this.importService.retryImport(
      id,
      user.id,
      viewAll,
    );
    return { import: importRecord };
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  CreateFashionIntakeDto,
  FashionImageBannerDto,
  FashionSizeChartDto,
  FashionWarehouseDto,
  NextFashionSkuDto,
  UpdateFashionWarehouseDto,
} from './fashion.dto.js';
import { FashionIntakeService } from './fashion-intake.service.js';
import { FashionIntakeImagesService } from './fashion-intake-images.service.js';
import { publicFashionMeasurementTemplates } from './fashion-measurements.js';

/**
 * Fashion quick capture: measurement charts, generated images, warehouses,
 * batch SKUs, photo-slot intake with background identification, and intake history.
 * Reuses existing Fashion permissions; no new permission keys.
 */
@Controller('fashion')
@RequirePermissions('fashion.access')
export class FashionIntakeController {
  constructor(
    private readonly intake: FashionIntakeService,
    private readonly generated: FashionIntakeImagesService,
  ) {}

  @Get('measurement-templates')
  measurementTemplates() {
    return publicFashionMeasurementTemplates();
  }

  @Get('warehouses')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  warehouses(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.intake.listWarehouses(
      user,
      organizationId,
      includeInactive === 'true',
    );
  }

  @Post('warehouses')
  @RequirePermissions('fashion.access', 'fashion.settings.manage')
  createWarehouse(
    @CurrentUser() user: User,
    @Body() dto: FashionWarehouseDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.createWarehouse(user, dto, organizationId);
  }

  @Patch('warehouses/:warehouseId')
  @RequirePermissions('fashion.access', 'fashion.settings.manage')
  updateWarehouse(
    @CurrentUser() user: User,
    @Param('warehouseId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFashionWarehouseDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.updateWarehouse(user, id, dto, organizationId);
  }

  @Get('intake/batches')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  batches(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.batches(user, organizationId);
  }

  @Post('intake/sku')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  nextSku(
    @CurrentUser() user: User,
    @Body() dto: NextFashionSkuDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.nextSku(user, dto, organizationId);
  }

  @Get('intake')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  history(
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
    @Query('batch') batch?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.intake.history(user, {
      organizationId,
      batch,
      status,
      q,
      source,
      page,
      pageSize,
    });
  }

  @Post('intake/:id/add-to-catalog')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  addToCatalog(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.addToCatalog(user, id, organizationId);
  }

  @Get('reports/activity')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  activityReport(
    @CurrentUser() user: User,
    @Query() params: Record<string, string | undefined>,
  ) {
    return this.intake.activityReport(user, params);
  }

  @Get('reports/activity/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="fashion-activity-report.csv"')
  @RequirePermissions('fashion.access', 'fashion.listings.view')
  exportActivityReport(
    @CurrentUser() user: User,
    @Query() params: Record<string, string | undefined>,
  ) {
    return this.intake.exportActivity(user, params);
  }

  @Post('intake')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateFashionIntakeDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.create(user, dto, organizationId);
  }

  @Post('listings/:id/identify')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('fashion.access', 'fashion.listings.update')
  identify(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.intake.requestIdentification(user, id, organizationId);
  }

  @Post('listings/size-chart')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  sizeChart(
    @CurrentUser() user: User,
    @Body() dto: FashionSizeChartDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.generated.sizeChart(user, dto, organizationId);
  }

  @Post('listings/photos/banner')
  @RequirePermissions('fashion.access', 'fashion.listings.create')
  banner(
    @CurrentUser() user: User,
    @Body() dto: FashionImageBannerDto,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.generated.banner(user, dto, organizationId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { RbacService } from '../rbac/rbac.service.js';
import {
  AdjustDto,
  BootstrapDto,
  CreateAdjustmentDocDto,
  CreateCountDto,
  CreateItemDto,
  CreateTransferDto,
  DamageDto,
  DocumentsQueryDto,
  GenerateLocationsDto,
  ItemSourceDto,
  ItemsQueryDto,
  LocationDto,
  MovementsQueryDto,
  MoveDto,
  ReceiveDocumentDto,
  ReceiveDto,
  RecordCountDto,
  ScanDto,
  SetStoreLinksDto,
  StorePolicyDto,
  UpdateItemDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
  WarehouseAssignmentsDto,
  WarehouseDto,
} from './dto/stock.dto.js';
import { StockAccessService } from './stock-access.service.js';
import { WarehousesService } from './warehouses.service.js';
import { InventoryItemsService } from './inventory-items.service.js';
import { SuppliersService } from './suppliers.service.js';
import { StockOperationsService } from './stock-operations.service.js';
import { StockReportsService } from './stock-reports.service.js';
import { StockSetupService } from './stock-setup.service.js';

/**
 * Warehouse inventory core. Every route takes an optional `organizationId` query param
 * (the active workspace); see StockAccessService for warehouse scoping.
 * Prefix: /api/stock (deliberately not /api/inventory, which is the Auto Parts workbench).
 */
@ApiTags('stock')
@Controller('stock')
@RequirePermissions('stock.view')
export class StockController {
  constructor(
    private readonly access: StockAccessService,
    private readonly rbac: RbacService,
    private readonly warehouses: WarehousesService,
    private readonly items: InventoryItemsService,
    private readonly suppliers: SuppliersService,
    private readonly ops: StockOperationsService,
    private readonly reports: StockReportsService,
    private readonly setup: StockSetupService,
  ) {}

  private scope(user: User, organizationId?: string) {
    return this.access.scope(user, organizationId);
  }

  private async can(user: User, key: string) {
    return (await this.rbac.getPermissionKeysForUser(user.id)).has(key);
  }

  /* ── Overview & setup ───────────────────────────────────────────── */

  @Get('summary')
  async summary(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.reports.summary(await this.scope(user, org), await this.can(user, 'stock.valuation.view'));
  }

  @Get('setup/status')
  async setupStatus(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.setup.status(await this.scope(user, org));
  }

  @Post('setup/bootstrap')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async bootstrap(@CurrentUser() user: User, @Body() dto: BootstrapDto, @Query('organizationId') org?: string) {
    return this.setup.bootstrap(await this.scope(user, org), dto);
  }

  /* ── Warehouses & bins ──────────────────────────────────────────── */

  @Get('warehouses')
  async listWarehouses(@CurrentUser() user: User, @Query('organizationId') org?: string, @Query('includeInactive') inactive?: string) {
    return this.warehouses.list(await this.scope(user, org), inactive === 'true');
  }

  @Post('warehouses')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async createWarehouse(@CurrentUser() user: User, @Body() dto: WarehouseDto, @Query('organizationId') org?: string) {
    return this.warehouses.create(await this.scope(user, org), dto);
  }

  @Patch('warehouses/:id')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async updateWarehouse(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto, @Query('organizationId') org?: string) {
    return this.warehouses.update(await this.scope(user, org), id, dto);
  }

  @Get('warehouses/:id/locations')
  async listLocations(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string, @Query('includeInactive') inactive?: string) {
    return this.warehouses.listLocations(await this.scope(user, org), id, inactive === 'true');
  }

  @Post('warehouses/:id/locations')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async createLocation(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LocationDto, @Query('organizationId') org?: string) {
    return this.warehouses.createLocation(await this.scope(user, org), id, dto);
  }

  @Post('warehouses/:id/locations/generate')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async generateLocations(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateLocationsDto, @Query('organizationId') org?: string) {
    return this.warehouses.generateLocations(await this.scope(user, org), id, dto);
  }

  @Patch('locations/:id')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async updateLocation(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto, @Query('organizationId') org?: string) {
    return this.warehouses.updateLocation(await this.scope(user, org), id, dto);
  }

  /* ── Stores (channel quantity policy) ───────────────────────────── */

  @Get('stores')
  async stores(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.warehouses.storeOverview(await this.scope(user, org));
  }

  @Put('stores/:storeId/links')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async setStoreLinks(@CurrentUser() user: User, @Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: SetStoreLinksDto, @Query('organizationId') org?: string) {
    return this.warehouses.setStoreLinks(await this.scope(user, org), storeId, dto);
  }

  @Patch('stores/:storeId/policy')
  @RequirePermissions('stock.view', 'stock.channel_sync.manage')
  async setStorePolicy(@CurrentUser() user: User, @Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: StorePolicyDto, @Query('organizationId') org?: string) {
    return this.warehouses.setStorePolicy(await this.scope(user, org), storeId, dto);
  }

  /* ── Warehouse access ───────────────────────────────────────────── */

  @Get('users/:userId/warehouses')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async getAssignments(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string, @Query('organizationId') org?: string) {
    return this.warehouses.getAssignments(await this.scope(user, org), userId);
  }

  @Put('users/:userId/warehouses')
  @RequirePermissions('stock.view', 'stock.warehouses.manage')
  async setAssignments(@CurrentUser() user: User, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: WarehouseAssignmentsDto, @Query('organizationId') org?: string) {
    return this.warehouses.setAssignments(await this.scope(user, org), userId, dto.warehouseIds);
  }

  /* ── Items ──────────────────────────────────────────────────────── */

  @Get('items')
  async listItems(@CurrentUser() user: User, @Query() q: ItemsQueryDto, @Query('organizationId') org?: string) {
    return this.items.list(await this.scope(user, org), q, await this.can(user, 'stock.valuation.view'));
  }

  @Post('items')
  @RequirePermissions('stock.view', 'stock.receive')
  async createItem(@CurrentUser() user: User, @Body() dto: CreateItemDto, @Query('organizationId') org?: string) {
    return this.items.create(await this.scope(user, org), dto);
  }

  @Get('items/:id')
  async itemDetail(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    const keys = await this.rbac.getPermissionKeysForUser(user.id);
    return this.items.detail(await this.scope(user, org), id, {
      canSeeCost: keys.has('stock.valuation.view'),
      canSeePrivateSerials: keys.has('stock.serials.private'),
    });
  }

  @Patch('items/:id')
  @RequirePermissions('stock.view', 'stock.receive')
  async updateItem(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto, @Query('organizationId') org?: string) {
    return this.items.update(await this.scope(user, org), id, dto);
  }

  @Post('scan')
  async scan(@CurrentUser() user: User, @Body() dto: ScanDto, @Query('organizationId') org?: string) {
    return this.items.scan(await this.scope(user, org), dto.code, await this.can(user, 'stock.serials.private'));
  }

  @Get('items/:id/sources')
  async listSources(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.suppliers.listForItem(await this.scope(user, org), id);
  }

  @Put('items/:id/sources')
  @RequirePermissions('stock.view', 'stock.procure')
  async upsertSource(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ItemSourceDto, @Query('organizationId') org?: string) {
    return this.suppliers.upsertSource(await this.scope(user, org), id, dto);
  }

  @Delete('items/:id/sources/:sourceId')
  @RequirePermissions('stock.view', 'stock.procure')
  async removeSource(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Param('sourceId', ParseUUIDPipe) sourceId: string, @Query('organizationId') org?: string) {
    return this.suppliers.removeSource(await this.scope(user, org), id, sourceId);
  }

  /* ── Quick operations ───────────────────────────────────────────── */

  @Post('receive')
  @RequirePermissions('stock.view', 'stock.receive')
  async receive(@CurrentUser() user: User, @Body() dto: ReceiveDto, @Query('organizationId') org?: string) {
    return this.ops.receive(await this.scope(user, org), dto);
  }

  @Post('adjust')
  @RequirePermissions('stock.view', 'stock.adjust')
  async adjust(@CurrentUser() user: User, @Body() dto: AdjustDto, @Query('organizationId') org?: string) {
    return this.ops.adjust(await this.scope(user, org), dto, { canApprove: await this.can(user, 'stock.adjust.approve') });
  }

  @Post('move')
  @RequirePermissions('stock.view', 'stock.move')
  async move(@CurrentUser() user: User, @Body() dto: MoveDto, @Query('organizationId') org?: string) {
    return this.ops.move(await this.scope(user, org), dto);
  }

  @Post('damage')
  @RequirePermissions('stock.view', 'stock.adjust')
  async damage(@CurrentUser() user: User, @Body() dto: DamageDto, @Query('organizationId') org?: string) {
    return this.ops.damage(await this.scope(user, org), dto);
  }

  /* ── Documents ──────────────────────────────────────────────────── */

  @Get('documents')
  async listDocuments(@CurrentUser() user: User, @Query() q: DocumentsQueryDto, @Query('organizationId') org?: string) {
    return this.ops.listDocuments(await this.scope(user, org), q);
  }

  @Get('documents/:id')
  async getDocument(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    const doc = await this.ops.getDocument(await this.scope(user, org), id);
    // Blind counts: counters do not see system quantities until submission.
    if (doc.docType === 'count' && doc.status === 'draft' && !(await this.can(user, 'stock.adjust.approve')))
      doc.lines = (doc.lines as Array<Record<string, unknown>>).map((l) => ({ ...l, systemQty: null }));
    return doc;
  }

  @Post('documents/:id/cancel')
  @RequirePermissions('stock.view', 'stock.move')
  async cancelDocument(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.ops.cancelDocument(await this.scope(user, org), id);
  }

  @Post('adjustments')
  @RequirePermissions('stock.view', 'stock.adjust')
  async createAdjustment(@CurrentUser() user: User, @Body() dto: CreateAdjustmentDocDto, @Query('organizationId') org?: string) {
    return this.ops.createAdjustmentDocument(await this.scope(user, org), dto, { canApprove: await this.can(user, 'stock.adjust.approve') });
  }

  @Post('adjustments/:id/approve')
  @RequirePermissions('stock.view', 'stock.adjust.approve')
  async approveAdjustment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.ops.approveAdjustment(await this.scope(user, org), id, { canApprove: true });
  }

  @Post('transfers')
  @RequirePermissions('stock.view', 'stock.move')
  async createTransfer(@CurrentUser() user: User, @Body() dto: CreateTransferDto, @Query('organizationId') org?: string) {
    return this.ops.createTransfer(await this.scope(user, org), dto);
  }

  @Post('transfers/:id/ship')
  @RequirePermissions('stock.view', 'stock.move')
  async shipTransfer(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.ops.shipTransfer(await this.scope(user, org), id);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions('stock.view', 'stock.receive')
  async receiveTransfer(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveDocumentDto, @Query('organizationId') org?: string) {
    return this.ops.receiveTransfer(await this.scope(user, org), id, dto);
  }

  @Post('counts')
  @RequirePermissions('stock.view', 'stock.count')
  async createCount(@CurrentUser() user: User, @Body() dto: CreateCountDto, @Query('organizationId') org?: string) {
    return this.ops.createCount(await this.scope(user, org), dto);
  }

  @Put('counts/:id/lines')
  @RequirePermissions('stock.view', 'stock.count')
  async recordCount(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordCountDto, @Query('organizationId') org?: string) {
    return this.ops.recordCount(await this.scope(user, org), id, dto);
  }

  @Post('counts/:id/submit')
  @RequirePermissions('stock.view', 'stock.count')
  async submitCount(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.ops.submitCount(await this.scope(user, org), id, { canApprove: await this.can(user, 'stock.adjust.approve') });
  }

  /* ── Ledger & reports ───────────────────────────────────────────── */

  @Get('movements')
  async movements(@CurrentUser() user: User, @Query() q: MovementsQueryDto, @Query('organizationId') org?: string) {
    return this.ops.listMovements(await this.scope(user, org), q);
  }

  @Get('reports/valuation')
  @RequirePermissions('stock.view', 'stock.valuation.view')
  async valuation(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.reports.valuation(await this.scope(user, org));
  }

  @Get('reports/aging')
  async aging(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.reports.aging(await this.scope(user, org));
  }
}

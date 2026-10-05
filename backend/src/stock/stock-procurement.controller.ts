import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import {
  CreateProcurementRequestDto,
  CreatePurchaseOrderDto,
  DropshipDto,
  FromRequestsDto,
  ProcurementQueryDto,
  ReceiveDocumentDto,
  ReorderSuggestDto,
  SupplierDto,
  UpdateProcurementRequestDto,
  UpdateSupplierDto,
} from './dto/stock.dto.js';
import { StockAccessService } from './stock-access.service.js';
import { SuppliersService } from './suppliers.service.js';
import { ProcurementService } from './procurement.service.js';
import { OrderStockService } from './order-stock.service.js';
import { ChannelStockSyncService } from './channel-stock-sync.service.js';

class LinkLineDto {
  @IsUUID() itemId!: string;
}

/** Suppliers, procurement requests and purchase orders: acquiring stock that is not on hand. */
@ApiTags('stock')
@Controller('stock')
@RequirePermissions('stock.view')
export class StockProcurementController {
  constructor(
    private readonly access: StockAccessService,
    private readonly suppliers: SuppliersService,
    private readonly procurement: ProcurementService,
    private readonly orders: OrderStockService,
    private readonly channels: ChannelStockSyncService,
  ) {}

  private scope(user: User, organizationId?: string) {
    return this.access.scope(user, organizationId);
  }

  /* ── Suppliers ──────────────────────────────────────────────────── */

  @Get('suppliers')
  async listSuppliers(@CurrentUser() user: User, @Query('organizationId') org?: string, @Query('includeInactive') inactive?: string) {
    return this.suppliers.list(await this.scope(user, org), inactive === 'true');
  }

  @Post('suppliers')
  @RequirePermissions('stock.view', 'stock.procure')
  async createSupplier(@CurrentUser() user: User, @Body() dto: SupplierDto, @Query('organizationId') org?: string) {
    return this.suppliers.create(await this.scope(user, org), dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions('stock.view', 'stock.procure')
  async updateSupplier(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto, @Query('organizationId') org?: string) {
    return this.suppliers.update(await this.scope(user, org), id, dto);
  }

  /* ── Procurement requests ───────────────────────────────────────── */

  @Get('procurement/summary')
  async procurementSummary(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.procurement.summary(await this.scope(user, org));
  }

  @Get('procurement/requests')
  async listRequests(@CurrentUser() user: User, @Query() q: ProcurementQueryDto, @Query('organizationId') org?: string) {
    return this.procurement.listRequests(await this.scope(user, org), q);
  }

  @Post('procurement/requests')
  @RequirePermissions('stock.view', 'stock.procure')
  async createRequest(@CurrentUser() user: User, @Body() dto: CreateProcurementRequestDto, @Query('organizationId') org?: string) {
    return this.procurement.createRequest(await this.scope(user, org), dto);
  }

  @Patch('procurement/requests/:id')
  @RequirePermissions('stock.view', 'stock.procure')
  async updateRequest(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProcurementRequestDto, @Query('organizationId') org?: string) {
    return this.procurement.updateRequest(await this.scope(user, org), id, dto);
  }

  @Post('procurement/requests/:id/cancel')
  @RequirePermissions('stock.view', 'stock.procure')
  async cancelRequest(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.procurement.cancelRequest(await this.scope(user, org), id);
  }

  @Post('procurement/requests/:id/dropship')
  @RequirePermissions('stock.view', 'stock.procure')
  async dropship(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DropshipDto, @Query('organizationId') org?: string) {
    return this.procurement.markDropshipped(await this.scope(user, org), id, dto);
  }

  @Get('procurement/reorder')
  async reorder(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.procurement.reorderSuggestions(await this.scope(user, org), false);
  }

  @Post('procurement/reorder')
  @RequirePermissions('stock.view', 'stock.procure')
  async createReorder(@CurrentUser() user: User, @Body() dto: ReorderSuggestDto, @Query('organizationId') org?: string) {
    return this.procurement.reorderSuggestions(await this.scope(user, org), dto.createRequests ?? true);
  }

  /* ── Purchase orders ────────────────────────────────────────────── */

  @Post('purchase-orders')
  @RequirePermissions('stock.view', 'stock.procure')
  async createPo(@CurrentUser() user: User, @Body() dto: CreatePurchaseOrderDto, @Query('organizationId') org?: string) {
    return this.procurement.createPurchaseOrder(await this.scope(user, org), dto);
  }

  @Post('purchase-orders/from-requests')
  @RequirePermissions('stock.view', 'stock.procure')
  async poFromRequests(@CurrentUser() user: User, @Body() dto: FromRequestsDto, @Query('organizationId') org?: string) {
    return this.procurement.purchaseOrdersFromRequests(await this.scope(user, org), dto);
  }

  @Post('purchase-orders/:id/order')
  @RequirePermissions('stock.view', 'stock.procure')
  async orderPo(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.procurement.orderPurchaseOrder(await this.scope(user, org), id);
  }

  @Post('purchase-orders/:id/receive')
  @RequirePermissions('stock.view', 'stock.receive')
  async receivePo(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveDocumentDto, @Query('organizationId') org?: string) {
    return this.procurement.receivePurchaseOrder(await this.scope(user, org), id, dto);
  }

  @Post('purchase-orders/:id/cancel')
  @RequirePermissions('stock.view', 'stock.procure')
  async cancelPo(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) {
    return this.procurement.cancelPurchaseOrder(await this.scope(user, org), id);
  }

  /* ── Orders ─────────────────────────────────────────────────────── */

  @Get('orders/exceptions')
  async exceptions(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.orders.exceptions(await this.scope(user, org));
  }

  @Get('orders/pick-list')
  async pickList(@CurrentUser() user: User, @Query('warehouseId') warehouseId?: string, @Query('organizationId') org?: string) {
    return this.orders.pickList(await this.scope(user, org), warehouseId);
  }

  @Get('orders/:orderId')
  async orderStock(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string, @Query('organizationId') org?: string) {
    return this.orders.orderStock(await this.scope(user, org), orderId);
  }

  @Post('orders/:orderId/allocate')
  @RequirePermissions('stock.view', 'stock.fulfil')
  async allocate(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string, @Query('organizationId') org?: string) {
    await this.orders.orderStock(await this.scope(user, org), orderId);
    return this.orders.allocateOrder(orderId, { reclaimOpenRequests: true });
  }

  @Post('orders/:orderId/pick')
  @RequirePermissions('stock.view', 'stock.fulfil')
  async pick(@CurrentUser() user: User, @Param('orderId', ParseUUIDPipe) orderId: string, @Query('organizationId') org?: string) {
    return this.orders.pickOrder(await this.scope(user, org), orderId);
  }

  @Post('orders/:orderId/lines/:orderItemId/link')
  @RequirePermissions('stock.view', 'stock.fulfil')
  async linkLine(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('orderItemId', ParseUUIDPipe) orderItemId: string,
    @Body() dto: LinkLineDto,
    @Query('organizationId') org?: string,
  ) {
    return this.orders.linkLine(await this.scope(user, org), orderId, orderItemId, dto.itemId);
  }

  /* ── Channel quantity sync ──────────────────────────────────────── */

  @Get('channel-sync')
  async channelSync(
    @CurrentUser() user: User,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('driftOnly') driftOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('organizationId') org?: string,
  ) {
    return this.channels.list(await this.scope(user, org), {
      storeId,
      status,
      driftOnly: driftOnly === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('channel-sync/summary')
  async channelSummary(@CurrentUser() user: User, @Query('organizationId') org?: string) {
    return this.channels.summary(await this.scope(user, org));
  }

  @Post('channel-sync/resync')
  @RequirePermissions('stock.view', 'stock.channel_sync.manage')
  async resync(@CurrentUser() user: User, @Query('storeId') storeId?: string, @Query('organizationId') org?: string) {
    return this.channels.resync(await this.scope(user, org), storeId);
  }
}

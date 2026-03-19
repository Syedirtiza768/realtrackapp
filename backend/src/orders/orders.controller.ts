import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { EbayOrderImportService } from './order-import-ebay.service.js';
import {
  OrdersQueryDto,
  UpdateOrderStatusDto,
  UpdateShippingDto,
  RefundDto,
  BulkShipDto,
  BulkCancelDto,
  CsvTrackingUploadDto,
  ManualImportDto,
} from './dto/orders.dto.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly ebayImportService: EbayOrderImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders (paginated, filtered)' })
  findAll(@Query() dto: OrdersQueryDto) {
    return this.ordersService.findAll(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Order count by status' })
  getStats() {
    return this.ordersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail with items' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition order status (FSM enforced)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.transitionStatus(id, dto.status, dto.reason);
  }

  @Patch(':id/shipping')
  @ApiOperation({ summary: 'Add/update tracking number (auto-ships if processing)' })
  updateShipping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.ordersService.updateShipping(id, dto);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Process refund' })
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
  ) {
    return this.ordersService.processRefund(id, dto);
  }

  /* ─── Phase 4: Bulk Operations ─── */

  @Post(':id/ship')
  @ApiOperation({ summary: 'Mark single order as shipped (pushes tracking to eBay)' })
  shipOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.fulfillmentService.markShipped(id, {
      carrier: dto.trackingCarrier ?? 'OTHER',
      trackingNumber: dto.trackingNumber,
    });
  }

  @Post('bulk/ship')
  @ApiOperation({ summary: 'Bulk ship multiple orders with tracking info' })
  bulkShip(@Body() dto: BulkShipDto) {
    return this.fulfillmentService.bulkShip(dto.items);
  }

  @Post('bulk/cancel')
  @ApiOperation({ summary: 'Bulk cancel multiple orders' })
  bulkCancel(@Body() dto: BulkCancelDto) {
    return this.fulfillmentService.bulkCancel(dto.orderIds, dto.reason);
  }

  @Post('bulk/tracking-upload')
  @ApiOperation({ summary: 'Upload CSV tracking file to bulk-ship orders' })
  trackingUpload(@Body() dto: CsvTrackingUploadDto) {
    return this.fulfillmentService.processTrackingCsv(dto.csvContent);
  }

  @Post('import/ebay')
  @ApiOperation({ summary: 'Manually trigger eBay order import (all stores or one store)' })
  importEbayOrders(@Body() dto: ManualImportDto) {
    if (dto.storeId) {
      return this.ebayImportService.importFromStore(dto.storeId);
    }
    return this.ebayImportService.importFromAllStores();
  }
}

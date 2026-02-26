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
import {
  OrdersQueryDto,
  UpdateOrderStatusDto,
  UpdateShippingDto,
  RefundDto,
} from './dto/orders.dto.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
}

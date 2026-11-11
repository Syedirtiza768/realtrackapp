import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { User } from '../../auth/entities/user.entity.js';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';
import { EbayIntegrationPermissionsService } from '../ebay/services/ebay-integration-permissions.service.js';
import { MotoarkOrderEventDto } from './motoark.dto.js';
import { MotoarkService } from './motoark.service.js';

@ApiTags('motoark')
@ApiBearerAuth()
@Controller('integrations/motoark')
export class MotoarkController {
  constructor(
    private readonly service: MotoarkService,
    private readonly permissions: EbayIntegrationPermissionsService,
  ) {}
  @Post('order-events')
  @HttpCode(202)
  @RequirePermissions('motoark.orders.notify')
  async accept(
    @Body() dto: MotoarkOrderEventDto,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId: string | undefined,
    @Headers('x-primemotive-timestamp') timestamp: string | undefined,
    @Headers('x-primemotive-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    const org = (await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    )) as { organizationId: string };
    return this.service.accept(
      org.organizationId,
      user,
      dto,
      request.rawBody ?? Buffer.alloc(0),
      timestamp,
      signature,
    );
  }
  @Get('order-events/:eventId')
  @RequirePermissions('motoark.orders.view')
  async get(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = (await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    )) as { organizationId: string };
    return this.service.get(org.organizationId, user, eventId);
  }
  @Get('quantities/:listingId')
  @RequirePermissions('motoark.orders.view')
  async quantity(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @CurrentUser() user: User,
    @Query('organizationId') organizationId?: string,
  ) {
    const org = (await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    )) as { organizationId: string };
    return this.service.quantity(org.organizationId, user, listingId);
  }
}

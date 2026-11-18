import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../auth/decorators/public.decorator.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import { User } from '../../../auth/entities/user.entity.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayPlatformNotificationsService } from '../services/ebay-platform-notifications.service.js';
import { EbayOrderNotificationsSubscribeDto } from '../dto/ebay-order-notifications.dto.js';

/**
 * eBay Platform Notifications for sales.
 *
 * - POST platform-notifications: public SOAP receiver eBay calls (signature
 *   checked in the service, no JWT).
 * - accounts/:id/order-notifications: admin-only subscribe / unsubscribe /
 *   status for one connected account. Subscribing changes the seller's
 *   notification settings on eBay.
 */
@ApiTags('integrations-ebay')
@Controller('integrations/ebay')
export class EbayPlatformNotificationsController {
  constructor(
    private readonly notifications: EbayPlatformNotificationsService,
    private readonly permissions: EbayIntegrationPermissionsService,
  ) {}

  @Public()
  @SkipThrottle({ short: true, medium: true, long: true })
  @Post('platform-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'eBay Platform Notification receiver (SOAP XML; FixedPriceTransaction / AuctionCheckoutComplete / ItemSold queue an order import)',
  })
  async receive(@Req() req: RawBodyRequest<Request>) {
    const body = req.body as unknown;
    const xml =
      req.rawBody?.toString('utf8') ?? (typeof body === 'string' ? body : '');
    return this.notifications.handleNotification(xml);
  }

  @Get('accounts/:id/order-notifications')
  @ApiBearerAuth()
  @RequirePermissions('ebay.notifications.manage')
  @ApiOperation({
    summary: 'Read eBay sale-notification settings for a connected account',
  })
  async status(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.notifications.getStatus(id, orgId);
  }

  @Post('accounts/:id/order-notifications')
  @ApiBearerAuth()
  @RequirePermissions('ebay.notifications.manage')
  @ApiOperation({
    summary:
      'Subscribe a connected eBay account to sale notifications (changes settings on eBay)',
  })
  async subscribe(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @Body() dto: EbayOrderNotificationsSubscribeDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.notifications.subscribe(id, orgId, {
      replaceApplicationUrl: dto.replaceApplicationUrl === true,
      actorUserId: user.id,
    });
  }

  @Delete('accounts/:id/order-notifications')
  @ApiBearerAuth()
  @RequirePermissions('ebay.notifications.manage')
  @ApiOperation({
    summary:
      'Turn off sale notifications for a connected eBay account (changes settings on eBay)',
  })
  async unsubscribe(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.notifications.unsubscribe(id, orgId, { actorUserId: user.id });
  }
}

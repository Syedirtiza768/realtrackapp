import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../auth/decorators/public.decorator.js';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../../rbac/decorators/require-permissions.decorator.js';
import { User } from '../../../auth/entities/user.entity.js';
import {
  EbayOAuthStartDto,
  EbayReconnectBodyDto,
  EbayDefaultPoliciesPatchDto,
} from '../dto/ebay-integrations.dto.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';
import { EbaySyncService } from '../services/ebay-sync.service.js';
import { EbayApiAuditService } from '../services/ebay-api-audit.service.js';
import { UserOrganizationService } from '../../../auth/user-organization.service.js';

@ApiTags('integrations-ebay')
@ApiBearerAuth()
@Controller('integrations/ebay')
@RequirePermissions('ebay.view')
export class IntegrationsEbayController {
  private readonly logger = new Logger(IntegrationsEbayController.name);

  constructor(
    private readonly oauth: EbayIntegrationsOAuthService,
    private readonly permissions: EbayIntegrationPermissionsService,
    private readonly accounts: EbayIntegrationAccountService,
    private readonly policySync: EbayPolicySyncService,
    private readonly ebaySync: EbaySyncService,
    private readonly apiAuditService: EbayApiAuditService,
    private readonly config: ConfigService,
    private readonly userOrgs: UserOrganizationService,
  ) {}

  @Get('workspace')
  @ApiOperation({
    summary:
      'Resolve RealTrack workspace for the signed-in user (not an eBay seller ID)',
  })
  async workspace(@CurrentUser() user: User) {
    return this.userOrgs.getWorkspaceContext(user.id);
  }

  @Post('oauth/start')
  @RequirePermissions('ebay.connect')
  @ApiOperation({ summary: 'Start eBay OAuth (returns consent URL)' })
  async oauthStart(@Body() dto: EbayOAuthStartDto, @CurrentUser() user: User) {
    const { organizationId, member } = await this.permissions.resolveOrganization(
      user.id,
      dto.organizationId,
    );
    this.permissions.assertCanConnect(member.role);
    return this.oauth.startOAuth({
      userId: user.id,
      organizationId,
      internalStoreId: dto.internalStoreId ?? null,
      marketplaceId: dto.marketplaceId,
      environment: dto.environment,
      accountDisplayName: dto.accountDisplayName?.trim() || 'eBay store',
    });
  }

  @Public()
  @Get('oauth/callback')
  @ApiOperation({ summary: 'OAuth callback (browser redirect, no JWT)' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const base = this.config.get<string>(
      'FRONTEND_BASE_URL',
      'http://localhost:3911',
    );
    try {
      if (!code || !state) {
        res.redirect(`${base}/settings/integrations/ebay?error=missing_code_or_state`);
        return;
      }
      const result = await this.oauth.handleCallback({ code, state });
      res.redirect(
        `${base}/settings/integrations/ebay?success=1&accountId=${result.connectedEbayAccountId}`,
      );
    } catch (err) {
      this.logger.error({ err, code: !!code, state: !!state }, 'eBay OAuth callback failed');
      res.redirect(`${base}/settings/integrations/ebay?error=oauth_failed`);
    }
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List connected eBay seller accounts for your workspace' })
  async listAccounts(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    return this.accounts.listForOrganization(orgId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get one connected eBay account' })
  async getAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.assertAccountAccess(
      user.id,
      id,
      organizationId,
    );
    return this.accounts.getOne(id, orgId);
  }

  @Patch('accounts/:id')
  @RequirePermissions('ebay.manage')
  @ApiOperation({ summary: 'Update connected eBay account metadata' })
  async patchAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
    @Body() body: { accountDisplayName?: string; connectionStatus?: string },
  ) {
    const { organizationId: orgId } = await this.permissions.assertAccountAccess(
      user.id,
      id,
      organizationId,
    );
    return this.accounts.patch(id, orgId, body as never);
  }

  @Get('accounts/:id/policies')
  @ApiOperation({ summary: 'List cached business policies for an account' })
  async getPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.assertAccountAccess(
      user.id,
      id,
      organizationId,
    );
    const account = await this.accounts.getOne(id, orgId);
    const policies = await this.accounts.getPolicies(id, orgId);
    return { account, ...policies };
  }

  @Patch('accounts/:id/default-policies')
  @RequirePermissions('ebay.manage')
  @ApiOperation({ summary: 'Set default payment/return/fulfillment/location for a marketplace' })
  async patchDefaultPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @Body() body: EbayDefaultPoliciesPatchDto,
    @CurrentUser() user: User,
    @Headers('x-forwarded-for') xf?: string,
    @Headers('user-agent') ua?: string,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.accounts.patchDefaultPolicies(id, orgId, body, {
      userId: user.id,
      ip: xf ?? null,
      userAgent: ua ?? null,
    });
  }

  @Post('accounts/:id/disconnect')
  @RequirePermissions('ebay.manage')
  @ApiOperation({ summary: 'Disable a connected eBay account' })
  async disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
    @Headers('x-forwarded-for') xf?: string,
    @Headers('user-agent') ua?: string,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.accounts.disconnect(id, orgId, user.id, {
      ip: xf ?? null,
      userAgent: ua ?? null,
    });
  }

  @Post('accounts/:id/reconnect')
  @RequirePermissions('ebay.connect')
  @ApiOperation({ summary: 'Start OAuth again for reconnect' })
  async reconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @Body() body: EbayReconnectBodyDto,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanConnect(member.role);
    await this.accounts.getOne(id, orgId);
    return this.oauth.startOAuth({
      userId: user.id,
      organizationId: orgId,
      internalStoreId: body.internalStoreId ?? null,
      marketplaceId: body.marketplaceId,
      environment: body.environment,
      accountDisplayName: body.accountDisplayName,
    });
  }

  @Post('accounts/:id/sync-listings')
  @RequirePermissions('ebay.sync')
  @ApiOperation({ summary: 'Enqueue background sync of eBay inventory/offers' })
  async syncListings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @Query('marketplaceId') marketplaceId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.ebaySync.enqueueListingSync(
      id,
      orgId,
      user.id,
      marketplaceId,
    );
  }

  @Post('accounts/:id/sync-orders')
  @RequirePermissions('ebay.sync')
  @ApiOperation({ summary: 'Enqueue background import of eBay orders (Fulfillment API)' })
  async syncOrders(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.ebaySync.enqueueOrderSync(id, orgId, user.id);
  }

  @Get('accounts/:id/sync-logs')
  @ApiOperation({ summary: 'Recent listing/policy sync logs for an account' })
  async syncLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.assertAccountAccess(
      user.id,
      id,
      organizationId,
    );
    await this.accounts.getOne(id, orgId);
    return this.ebaySync.listSyncLogs(id, orgId);
  }

  @Get('accounts/:id/api-audit')
  @ApiOperation({ summary: 'Recent eBay API audit log entries (no secrets)' })
  async listApiAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.assertAccountAccess(
      user.id,
      id,
      organizationId,
    );
    return this.apiAuditService.listForAccount(id, orgId);
  }

  @Post('accounts/:id/sync-policies')
  @RequirePermissions('ebay.sync')
  @ApiOperation({ summary: 'Sync business policies from eBay Account API' })
  async syncPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } =
      await this.permissions.assertAccountAccess(user.id, id, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.policySync.syncPolicies(id, orgId, user.id);
  }
}

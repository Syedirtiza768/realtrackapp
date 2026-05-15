import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { EbayOAuthStartDto, EbayReconnectBodyDto, EbayDefaultPoliciesPatchDto } from '../dto/ebay-integrations.dto.js';
import { EbayIntegrationsOAuthService } from '../services/ebay-integrations-oauth.service.js';
import { EbayIntegrationPermissionsService } from '../services/ebay-integration-permissions.service.js';
import { EbayIntegrationAccountService } from '../services/ebay-integration-account.service.js';
import { EbayPolicySyncService } from '../services/ebay-policy-sync.service.js';

@ApiTags('integrations-ebay')
@Controller('integrations/ebay')
export class IntegrationsEbayController {
  constructor(
    private readonly oauth: EbayIntegrationsOAuthService,
    private readonly permissions: EbayIntegrationPermissionsService,
    private readonly accounts: EbayIntegrationAccountService,
    private readonly policySync: EbayPolicySyncService,
    private readonly config: ConfigService,
  ) {}

  @Post('oauth/start')
  @ApiOperation({ summary: 'Start eBay OAuth (returns consent URL)' })
  async oauthStart(
    @Body() dto: EbayOAuthStartDto,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const userId = dto.userId ?? headerUserId;
    if (!userId) {
      return { error: 'userId required (body.userId or x-user-id header) until JWT is wired' };
    }
    const member = await this.permissions.assertOrgMember(userId, dto.organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.oauth.startOAuth({
      userId,
      organizationId: dto.organizationId,
      internalStoreId: dto.internalStoreId ?? null,
      marketplaceId: dto.marketplaceId,
      environment: dto.environment,
      accountDisplayName: dto.accountDisplayName,
    });
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'OAuth callback (browser redirect)' })
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
    } catch {
      res.redirect(`${base}/settings/integrations/ebay?error=oauth_failed`);
    }
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List connected eBay accounts for an organization' })
  async listAccounts(
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    return this.accounts.listForOrganization(organizationId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get one connected eBay account' })
  async getAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    return this.accounts.getOne(id, organizationId);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update connected eBay account metadata' })
  async patchAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: { accountDisplayName?: string; connectionStatus?: string },
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    return this.accounts.patch(id, organizationId, body as never);
  }

  @Get('accounts/:id/policies')
  @ApiOperation({ summary: 'List cached business policies for an account' })
  async getPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    await this.permissions.assertOrgMember(userId, organizationId);
    const account = await this.accounts.getOne(id, organizationId);
    const policies = await this.accounts.getPolicies(id, organizationId);
    return { account, ...policies };
  }

  @Patch('accounts/:id/default-policies')
  @ApiOperation({ summary: 'Set default payment/return/fulfillment/location for a marketplace' })
  async patchDefaultPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: EbayDefaultPoliciesPatchDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-forwarded-for') xf?: string,
    @Headers('user-agent') ua?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    const member = await this.permissions.assertOrgMember(userId, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.accounts.patchDefaultPolicies(id, organizationId, body, {
      userId,
      ip: xf ?? null,
      userAgent: ua ?? null,
    });
  }

  @Post('accounts/:id/disconnect')
  @ApiOperation({ summary: 'Disable a connected eBay account' })
  async disconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-forwarded-for') xf?: string,
    @Headers('user-agent') ua?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    const member = await this.permissions.assertOrgMember(userId, organizationId);
    this.permissions.assertCanConnect(member.role);
    return this.accounts.disconnect(id, organizationId, userId, {
      ip: xf ?? null,
      userAgent: ua ?? null,
    });
  }

  @Post('accounts/:id/reconnect')
  @ApiOperation({ summary: 'Start OAuth again for reconnect' })
  async reconnect(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() body: EbayReconnectBodyDto,
    @Headers('x-user-id') headerUserId?: string,
  ) {
    const userId = body.userId ?? headerUserId;
    if (!userId) return { error: 'userId required' };
    const member = await this.permissions.assertOrgMember(userId, organizationId);
    this.permissions.assertCanConnect(member.role);
    await this.accounts.getOne(id, organizationId);
    return this.oauth.startOAuth({
      userId,
      organizationId,
      internalStoreId: body.internalStoreId ?? null,
      marketplaceId: body.marketplaceId,
      environment: body.environment,
      accountDisplayName: body.accountDisplayName,
    });
  }

  @Post('accounts/:id/sync-policies')
  @ApiOperation({ summary: 'Sync business policies from eBay Account API' })
  async syncPolicies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!userId) return { error: 'x-user-id header required' };
    const member = await this.permissions.assertOrgMember(userId, organizationId);
    this.permissions.assertCanManageStorePolicies(member.role);
    return this.policySync.syncPolicies(id, organizationId, userId);
  }
}

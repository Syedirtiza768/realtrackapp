import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';
import { User } from '../../auth/entities/user.entity.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayIntegrationPermissionsService } from '../ebay/services/ebay-integration-permissions.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditAccountSyncService } from './sellerpundit-account-sync.service.js';
import { SellerpunditPolicySyncService } from './sellerpundit-policy-sync.service.js';

@ApiTags('integrations-ebay-sellerpundit')
@ApiBearerAuth()
@Controller('integrations/ebay/sellerpundit')
@RequirePermissions('ebay.view')
export class SellerpunditEbayController {
  constructor(
    private readonly auth: SellerpunditAuthService,
    private readonly accounts: SellerpunditAccountSyncService,
    private readonly policies: SellerpunditPolicySyncService,
    private readonly permissions: EbayIntegrationPermissionsService,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'SellerPundit integration status for workspace' })
  async getConfig(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    return this.auth.getConfigView(orgId);
  }

  @Put('config')
  @RequirePermissions('ebay.manage')
  @ApiOperation({ summary: 'Save org-level SellerPundit credentials (optional)' })
  async putConfig(
    @Query('organizationId') organizationId: string | undefined,
    @Body() body: { email?: string; password?: string; enabled?: boolean },
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    this.permissions.assertCanConnect(member.role);
    if (body.email && body.password) {
      await this.auth.saveOrgCredentials(orgId, body.email.trim(), body.password);
    }
    if (body.enabled != null) {
      await this.auth.upsertConfig(orgId, { enabled: body.enabled });
    }
    return this.auth.getConfigView(orgId);
  }

  @Post('test-connection')
  @RequirePermissions('ebay.connect')
  async testConnection(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    this.permissions.assertCanConnect(member.role);
    return this.accounts.testConnection(orgId);
  }

  @Post('sync/stores')
  @RequirePermissions('ebay.connect')
  @ApiOperation({ summary: 'Import connected eBay stores from SellerPundit' })
  async syncStores(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    this.permissions.assertCanConnect(member.role);
    return this.accounts.syncStores(orgId, user.id);
  }

  @Post('sync/policies')
  @RequirePermissions('ebay.sync')
  @ApiOperation({ summary: 'Sync SellerPundit policies for all SP accounts in workspace' })
  async syncAllPolicies(
    @Query('organizationId') organizationId: string | undefined,
    @Query('accountId') accountId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    this.permissions.assertCanManageStorePolicies(member.role);

    if (accountId) {
      const { organizationId: accOrg } = await this.permissions.assertAccountAccess(
        user.id,
        accountId,
        organizationId,
      );
      return this.policies.syncPolicies(accountId, accOrg, user.id);
    }

    const rows = await this.accountRepo.find({
      where: { organizationId: orgId, connectionSource: 'sellerpundit' },
    });
    let total = 0;
    const results: { accountId: string; synced: number; ok: boolean }[] = [];
    for (const row of rows) {
      const r = await this.policies.syncPolicies(row.id, orgId, user.id);
      total += r.synced;
      results.push({ accountId: row.id, synced: r.synced, ok: r.ok });
    }
    return { ok: true, synced: total, accounts: results };
  }

  @Post('sync/all')
  @RequirePermissions('ebay.sync')
  async syncAll(
    @Query('organizationId') organizationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    const { organizationId: orgId, member } = await this.permissions.resolveOrganization(
      user.id,
      organizationId,
    );
    this.permissions.assertCanConnect(member.role);
    const stores = await this.accounts.syncStores(orgId, user.id);
    const policies = await this.syncAllPolicies(organizationId, undefined, user);
    return { stores, policies };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ChannelConnection } from '../../channels/entities/channel-connection.entity.js';
import { Store } from '../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../ebay/entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../ebay/entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../ebay/entities/ebay-account-marketplace.entity.js';
import { EbayMarketplaceConfigService } from '../ebay/services/ebay-marketplace-config.service.js';
import { ListingActionLogWriterService } from '../ebay/services/listing-action-log-writer.service.js';
import { SellerpunditAuthService } from './sellerpundit-auth.service.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';
import { SellerpunditMarketplaceRegistry } from './sellerpundit-marketplace.registry.js';
import { SellerpunditTokenSyncService } from './sellerpundit-token-sync.service.js';
import type { SellerpunditTokenRow } from './sellerpundit.types.js';

@Injectable()
export class SellerpunditAccountSyncService {
  private readonly logger = new Logger(SellerpunditAccountSyncService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly auth: SellerpunditAuthService,
    private readonly http: SellerpunditHttpClient,
    private readonly tokenSync: SellerpunditTokenSyncService,
    private readonly encryption: TokenEncryptionService,
    private readonly mpConfig: EbayMarketplaceConfigService,
    private readonly registry: SellerpunditMarketplaceRegistry,
    private readonly dataSource: DataSource,
    private readonly logWriter: ListingActionLogWriterService,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(EbayOAuthToken)
    private readonly oauthRepo: Repository<EbayOAuthToken>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
  ) {}

  async syncStores(
    organizationId: string,
    userId: string | null,
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    accounts: string[];
  }> {
    const jwt = await this.auth.getJwt(organizationId);
    const raw = await this.http.get<unknown>(jwt, '/token/get-all-tokens');
    const tokens = this.tokenSync.unwrapTokenList(raw);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const accountIds: string[] = [];

    const environment =
      this.config.get<string>('SELLERPUNDIT_ENVIRONMENT', 'production') ===
      'sandbox'
        ? 'sandbox'
        : 'production';

    const configDefaultMp =
      this.config.get<string>(
        'SELLERPUNDIT_DEFAULT_MARKETPLACE_ID',
        'EBAY_MOTORS_US',
      ) || 'EBAY_MOTORS_US';

    for (const row of tokens) {
      if (row.status && row.status !== 'active') {
        skipped++;
        continue;
      }
      if (!row.accountName?.trim()) {
        skipped++;
        continue;
      }

      const existing = await this.accountRepo.findOne({
        where: { organizationId, sellerpunditTokenId: row.id },
      });

      if (existing) {
        await this.tokenSync.persistTokenRow(existing, row);
        const displayName = row.accountName.trim();
        existing.accountDisplayName = displayName;
        existing.sellerpunditAccountName = displayName;
        existing.sellerpunditMarketplaceId = row.marketPlaceId;
        existing.sellerpunditLastSyncAt = new Date();
        if (row.sellerId) existing.ebayUserId = String(row.sellerId);
        await this.accountRepo.save(existing);
        const marketplaceId = this.registry.resolveMarketplaceForAccount(
          displayName,
          configDefaultMp,
        );
        await this.alignAccountMarketplace(existing, marketplaceId);
        updated++;
        accountIds.push(existing.id);
        continue;
      }

      const ebayUserId = row.sellerId ? String(row.sellerId) : `sp-${row.id}`;

      const dup = await this.accountRepo.findOne({
        where: { organizationId, ebayUserId },
      });
      if (dup) {
        this.logger.warn(
          `Skip SP token ${row.id}: ebay_user_id ${ebayUserId} already used by ${dup.id}`,
        );
        skipped++;
        continue;
      }

      const marketplaceId = this.registry.resolveMarketplaceForAccount(
        row.accountName.trim(),
        configDefaultMp,
      );
      const acctId = await this.createAccountFromToken({
        organizationId,
        userId,
        row,
        ebayUserId,
        environment,
        defaultMarketplaceId: marketplaceId,
      });
      imported++;
      accountIds.push(acctId);
    }

    await this.auth.upsertConfig(organizationId, {
      lastSyncAt: new Date(),
      lastError: null,
    });

    await this.logWriter.write({
      organizationId,
      userId,
      action: 'sellerpundit_stores_synced',
      result: 'success',
      afterSnapshot: { imported, updated, skipped, total: tokens.length },
    });

    return { imported, updated, skipped, accounts: accountIds };
  }

  private async createAccountFromToken(input: {
    organizationId: string;
    userId: string | null;
    row: SellerpunditTokenRow;
    ebayUserId: string;
    environment: 'sandbox' | 'production';
    defaultMarketplaceId: string;
  }): Promise<string> {
    const displayName = input.row.accountName.trim();
    const accessToken = (input.row.token ?? input.row.accessToken ?? '').trim();
    const refreshToken = input.row.refreshToken?.trim() ?? '';
    const expiresInSec = input.row.expiresIn ?? 300;
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);

    const tokenBlob = {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
    };

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const connection = this.connectionRepo.create({
        channel: 'ebay',
        userId: input.userId ?? input.organizationId,
        organizationId: input.organizationId,
        accountName: displayName,
        externalAccountId: input.ebayUserId,
        encryptedTokens: this.encryption.encrypt(JSON.stringify(tokenBlob)),
        tokenExpiresAt: expiresAt,
        scope: null,
        status: 'active',
      });
      const savedConn = await qr.manager.save(connection);

      const store = this.storeRepo.create({
        connectionId: savedConn.id,
        organizationId: input.organizationId,
        channel: 'ebay',
        storeName: displayName,
        externalStoreId: input.ebayUserId,
        status: 'active',
        isPrimary: false,
        ebayUserId: input.ebayUserId,
        ebayMarketplaceId: input.defaultMarketplaceId,
        config: {
          marketplace: input.defaultMarketplaceId,
          sellerpundit: true,
          sellerpunditTokenId: input.row.id,
        },
      });
      const savedStore = await qr.manager.save(store);

      const acct = this.accountRepo.create({
        organizationId: input.organizationId,
        internalStoreId: null,
        channelConnectionId: savedConn.id,
        primaryStoreId: savedStore.id,
        ebayUserId: input.ebayUserId,
        ebayUsername: null,
        accountDisplayName: displayName,
        environment: input.environment,
        connectionStatus: 'active',
        connectedByUserId: input.userId,
        connectedAt: new Date(),
        connectionSource: 'sellerpundit',
        sellerpunditTokenId: input.row.id,
        sellerpunditAccountName: displayName,
        sellerpunditMarketplaceId: input.row.marketPlaceId,
        sellerpunditLastSyncAt: new Date(),
      });
      const savedAcct = await qr.manager.save(acct);

      const oauthRow = this.oauthRepo.create({
        ebayAccountId: savedAcct.id,
        accessTokenEncrypted: this.encryption.encrypt(accessToken),
        accessTokenExpiresAt: expiresAt,
        refreshTokenEncrypted: this.encryption.encrypt(refreshToken),
        refreshTokenExpiresAt: input.row.refreshTokenExpiresIn
          ? new Date(Date.now() + input.row.refreshTokenExpiresIn * 1000)
          : null,
        grantedScopes: [],
        lastRefreshedAt: input.row.lastTokenRefreshDate
          ? new Date(input.row.lastTokenRefreshDate)
          : new Date(),
        reconnectRequired: false,
      });
      await qr.manager.save(oauthRow);

      for (const mpId of this.registry.defaultMarketplacesForImport()) {
        try {
          const mp = this.mpConfig.require(mpId);
          const mpRow = this.mpRepo.create({
            ebayAccountId: savedAcct.id,
            marketplaceId: mpId,
            currency: mp.currency,
            locale: mp.locale,
            enabled: mpId === input.defaultMarketplaceId,
          });
          await qr.manager.save(mpRow);
        } catch {
          /* skip unknown mp */
        }
      }

      savedStore.ebayMarketplaceId = input.defaultMarketplaceId;
      savedStore.config = {
        ...(savedStore.config ?? {}),
        marketplace: input.defaultMarketplaceId,
        sellerpundit: true,
        sellerpunditTokenId: input.row.id,
      };
      await qr.manager.save(savedStore);

      await qr.commitTransaction();
      return savedAcct.id;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /** Ensure the inferred marketplace row exists and the primary store points at it. */
  private async alignAccountMarketplace(
    account: ConnectedEbayAccount,
    marketplaceId: string,
  ): Promise<void> {
    let mpRow = await this.mpRepo.findOne({
      where: { ebayAccountId: account.id, marketplaceId },
    });
    if (!mpRow) {
      const mp = this.mpConfig.require(marketplaceId);
      mpRow = this.mpRepo.create({
        ebayAccountId: account.id,
        marketplaceId,
        currency: mp.currency,
        locale: mp.locale,
        enabled: true,
      });
      await this.mpRepo.save(mpRow);
    } else if (!mpRow.enabled) {
      mpRow.enabled = true;
      await this.mpRepo.save(mpRow);
    }

    if (account.primaryStoreId) {
      const store = await this.storeRepo.findOne({
        where: { id: account.primaryStoreId },
      });
      if (store && store.ebayMarketplaceId !== marketplaceId) {
        store.ebayMarketplaceId = marketplaceId;
        store.config = {
          ...(store.config ?? {}),
          marketplace: marketplaceId,
        };
        await this.storeRepo.save(store);
      }
    }
  }

  async testConnection(
    organizationId: string,
  ): Promise<{ ok: boolean; storeCount: number }> {
    const jwt = await this.auth.getJwt(organizationId);
    const raw = await this.http.get<unknown>(jwt, '/token/get-all-tokens');
    const tokens = this.tokenSync.unwrapTokenList(raw);
    return { ok: true, storeCount: tokens.length };
  }
}

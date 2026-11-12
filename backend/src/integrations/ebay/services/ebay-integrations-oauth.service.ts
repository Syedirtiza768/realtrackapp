import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { ChannelConnection } from '../../../channels/entities/channel-connection.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { TokenEncryptionService } from '../../../channels/token-encryption.service.js';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { EbayOAuthToken } from '../entities/ebay-oauth-token.entity.js';
import { EbayAccountMarketplace } from '../entities/ebay-account-marketplace.entity.js';
import { EbayBusinessPolicy } from '../entities/ebay-business-policy.entity.js';
import {
  EbayOAuthStateStore,
  type EbayOAuthPendingPayload,
} from './ebay-oauth-state.store.js';
import { EbayAccountTokenService } from './ebay-account-token.service.js';
import { EbayMarketplaceConfigService } from './ebay-marketplace-config.service.js';
import { EbayPolicySyncService } from './ebay-policy-sync.service.js';
import { ListingActionLogWriterService } from './listing-action-log-writer.service.js';
import type { ProductVertical } from '../../../verticals/vertical.types.js';

interface TokenBlob {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scope?: string;
  tokenType?: string;
}

interface SellerIdentity {
  userId: string | null;
  username: string | null;
}

/** Placeholder seller IDs written when eBay's Identity API did not answer. */
export function isPlaceholderEbayUserId(value: string | null | undefined) {
  return !value || value === 'unknown' || value.startsWith('unknown_');
}

const POLICY_LIST_FIELDS: Record<string, { list: string; id: string }> = {
  fulfillment: { list: 'fulfillmentPolicies', id: 'fulfillmentPolicyId' },
  payment: { list: 'paymentPolicies', id: 'paymentPolicyId' },
  return: { list: 'returnPolicies', id: 'returnPolicyId' },
};

/**
 * OAuth callback failure that knows which page to send the browser back to,
 * so the user sees the reason on the page they started from.
 */
export class EbayOAuthCallbackFailure extends Error {
  constructor(
    message: string,
    readonly reason: 'conflict' | 'oauth_failed',
    readonly redirectPath: string,
    /** Safe to show the user (our own 4xx message, never an upstream body). */
    readonly userMessage: string | null,
  ) {
    super(message);
  }
}

function verticalRedirectPath(vertical?: ProductVertical) {
  return vertical === 'fashion'
    ? '/fashion/stores'
    : vertical === 'business_industrial'
      ? '/business-industrial/stores'
      : '/settings/integrations/ebay';
}

@Injectable()
export class EbayIntegrationsOAuthService {
  private readonly logger = new Logger(EbayIntegrationsOAuthService.name);

  constructor(
    private readonly stateStore: EbayOAuthStateStore,
    private readonly tokenService: EbayAccountTokenService,
    private readonly encryption: TokenEncryptionService,
    private readonly mpConfig: EbayMarketplaceConfigService,
    private readonly dataSource: DataSource,
    private readonly logWriter: ListingActionLogWriterService,
    private readonly policySync: EbayPolicySyncService,
    @InjectRepository(ChannelConnection)
    private readonly connectionRepo: Repository<ChannelConnection>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(EbayOAuthToken)
    private readonly oauthRepo: Repository<EbayOAuthToken>,
    @InjectRepository(EbayAccountMarketplace)
    private readonly mpRepo: Repository<EbayAccountMarketplace>,
    @InjectRepository(EbayBusinessPolicy)
    private readonly policyRepo: Repository<EbayBusinessPolicy>,
  ) {}

  async startOAuth(input: {
    userId: string;
    organizationId: string;
    internalStoreId: string | null;
    marketplaceId: string;
    environment: 'sandbox' | 'production';
    accountDisplayName: string;
    vertical?: ProductVertical;
    /** Re-authorize this existing account in place (no new store/account). */
    reconnectAccountId?: string | null;
  }): Promise<{ authUrl: string; state: string }> {
    this.mpConfig.require(input.marketplaceId);
    const state = crypto.randomBytes(32).toString('hex');
    await this.stateStore.save(state, {
      userId: input.userId,
      organizationId: input.organizationId,
      internalStoreId: input.internalStoreId,
      marketplaceId: input.marketplaceId,
      environment: input.environment,
      scopes: this.tokenService.getDefaultScopes(),
      accountDisplayName: input.accountDisplayName,
      vertical: input.vertical ?? 'automotive',
      reconnectAccountId: input.reconnectAccountId ?? null,
    });
    const authUrl = this.tokenService.buildAuthorizeUrl({
      state,
      environment: input.environment,
    });
    return { authUrl, state };
  }

  async handleCallback(params: {
    code: string;
    state: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ connectedEbayAccountId: string; redirectUrl?: string }> {
    const pending = await this.stateStore.consume(params.state);
    if (!pending) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    try {
      return await this.handlePendingCallback(pending, params);
    } catch (e: unknown) {
      const userMessage =
        e instanceof HttpException && e.getStatus() < 500 ? e.message : null;
      throw new EbayOAuthCallbackFailure(
        (e as Error)?.message ?? String(e),
        e instanceof ConflictException ? 'conflict' : 'oauth_failed',
        verticalRedirectPath(pending.vertical),
        userMessage,
      );
    }
  }

  private async handlePendingCallback(
    pending: EbayOAuthPendingPayload,
    params: {
      code: string;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ): Promise<{ connectedEbayAccountId: string; redirectUrl?: string }> {
    let tokens: TokenBlob;
    try {
      const result = await this.tokenService.exchangeCode({
        code: params.code,
        environment: pending.environment,
      });
      tokens = result.tokens;
    } catch (e: unknown) {
      this.logger.warn(
        { errMsg: (e as Error)?.message },
        'eBay token exchange failed',
      );
      throw e;
    }

    const identity = await this.fetchSellerIdentity(
      tokens.accessToken,
      pending.environment,
    );

    if (pending.reconnectAccountId) {
      return this.reconnectExistingAccount(pending, tokens, identity, params);
    }

    const ebayUserId = identity.userId ?? `unknown_${Date.now()}`;
    const ebayUsername = identity.username;

    const existingSellerStores = await this.storeRepo.find({
      where: {
        organizationId: pending.organizationId,
        ebayUserId,
      },
      select: ['id', 'storeName', 'verticalConfig'],
    });
    if (existingSellerStores.length > 0) {
      throw new ConflictException(
        'This eBay seller account is already connected in this workspace and cannot be reused across verticals',
      );
    }

    const tokenBlob: TokenBlob = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
    };

    const displayName =
      pending.accountDisplayName?.trim() ||
      ebayUsername ||
      `eBay — ${ebayUserId}`;

    const allMpConfigs = this.mpConfig.all();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const connection = this.connectionRepo.create({
        channel: 'ebay',
        userId: pending.userId,
        organizationId: pending.organizationId,
        accountName: displayName,
        externalAccountId: ebayUserId,
        encryptedTokens: this.encryption.encrypt(JSON.stringify(tokenBlob)),
        tokenExpiresAt: new Date(tokenBlob.expiresAt),
        scope: tokens.scope ?? null,
        status: 'active',
      });
      const savedConn = await qr.manager.save(connection);

      const store = this.storeRepo.create({
        connectionId: savedConn.id,
        organizationId: pending.organizationId,
        channel: 'ebay',
        storeName: displayName,
        externalStoreId: ebayUserId,
        status: 'active',
        isPrimary: false,
        ebayUserId,
        ebayMarketplaceId: pending.marketplaceId,
        verticalConfig:
          pending.vertical === 'fashion'
            ? {
                enabledVerticals: ['fashion'],
                defaultVertical: 'fashion',
                ownerVertical: 'fashion',
                workflows: {},
              }
            : pending.vertical === 'business_industrial'
              ? {
                  enabledVerticals: ['business_industrial'],
                  defaultVertical: 'business_industrial',
                  ownerVertical: 'business_industrial',
                  workflows: {},
                }
              : null,
        config: {
          marketplace: pending.marketplaceId,
          sandbox: pending.environment === 'sandbox',
          ebayUserId,
        },
      });
      const savedStore = await qr.manager.save(store);

      const acct = this.accountRepo.create({
        organizationId: pending.organizationId,
        internalStoreId: pending.internalStoreId,
        channelConnectionId: savedConn.id,
        primaryStoreId: savedStore.id,
        ebayUserId,
        ebayUsername,
        accountDisplayName: displayName,
        environment: pending.environment,
        connectionStatus: 'active',
        connectedByUserId: pending.userId,
        connectedAt: new Date(),
      });
      const savedAcct = await qr.manager.save(acct);

      const scopeList = (tokens.scope ?? '')
        .split(/[\s]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      const oauthRow = this.oauthRepo.create({
        ebayAccountId: savedAcct.id,
        accessTokenEncrypted: this.encryption.encrypt(tokens.accessToken),
        accessTokenExpiresAt: new Date(tokenBlob.expiresAt),
        refreshTokenEncrypted: this.encryption.encrypt(tokens.refreshToken),
        refreshTokenExpiresAt: null,
        grantedScopes: scopeList.length
          ? scopeList
          : ['https://api.ebay.com/oauth/api_scope'],
        lastRefreshedAt: new Date(),
        reconnectRequired: false,
      });
      await qr.manager.save(oauthRow);

      for (const cfg of allMpConfigs) {
        const mpRow = this.mpRepo.create({
          ebayAccountId: savedAcct.id,
          marketplaceId: cfg.marketplaceId,
          currency: cfg.currency,
          locale: cfg.locale,
          enabled: true,
        });
        await qr.manager.save(mpRow);
      }

      await qr.commitTransaction();

      await this.logWriter.write({
        organizationId: pending.organizationId,
        userId: pending.userId,
        ebayAccountId: savedAcct.id,
        marketplaceId: pending.marketplaceId,
        action: 'ebay_account_connected',
        result: 'success',
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        afterSnapshot: {
          ebayUserId,
          marketplaceId: pending.marketplaceId,
          environment: pending.environment,
        },
      });

      this.queuePolicySync(savedAcct.id, pending);

      return {
        connectedEbayAccountId: savedAcct.id,
        redirectUrl: verticalRedirectPath(pending.vertical),
      };
    } catch (e: unknown) {
      await qr.rollbackTransaction();
      this.logger.warn(
        { errMsg: (e as Error)?.message },
        'eBay OAuth DB transaction failed',
      );
      throw e;
    } finally {
      await qr.release();
    }
  }

  /**
   * Re-authorize an existing connection in place: new tokens go onto the same
   * account, channel connection and store, so its store ID, listing mirrors,
   * policies, warehouse links and store assignments all stay attached.
   *
   * Fails closed unless the eBay login can be shown to be the same seller:
   * by seller user ID when both sides have a real one, otherwise by the new
   * token seeing at least one of the business-policy IDs cached for the account.
   */
  private async reconnectExistingAccount(
    pending: EbayOAuthPendingPayload,
    tokens: TokenBlob,
    identity: SellerIdentity,
    params: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ connectedEbayAccountId: string; redirectUrl?: string }> {
    const account = await this.accountRepo.findOne({
      where: {
        id: pending.reconnectAccountId!,
        organizationId: pending.organizationId,
      },
    });
    if (!account)
      throw new BadRequestException(
        'The eBay connection being reconnected no longer exists',
      );
    if (account.connectionSource === 'sellerpundit')
      throw new BadRequestException(
        'SellerPundit connections are re-authorized through SellerPundit',
      );
    if (account.environment !== pending.environment)
      throw new BadRequestException(
        `This connection is ${account.environment}; reconnect it in the same environment`,
      );

    const mismatch = () =>
      new ConflictException(
        `You signed in to eBay as a different seller than "${account.accountDisplayName}". ` +
          'Sign out of eBay, sign in with that store’s seller account and reconnect again.',
      );

    let verifiedBy: 'ebay_user_id' | 'business_policies';
    if (identity.userId && !isPlaceholderEbayUserId(account.ebayUserId)) {
      if (identity.userId !== account.ebayUserId) throw mismatch();
      verifiedBy = 'ebay_user_id';
    } else {
      const owns = await this.tokenSeesCachedPolicies(
        account.id,
        tokens.accessToken,
        pending.environment,
      );
      if (owns === 'no_cache')
        throw new ConflictException(
          `Cannot confirm the eBay login belongs to "${account.accountDisplayName}": ` +
            'eBay did not return a seller ID and no business policies are cached for this connection.',
        );
      if (!owns) throw mismatch();
      verifiedBy = 'business_policies';
    }

    // Replace a placeholder seller ID with the real one when eBay returned it.
    const adoptUserId =
      identity.userId && isPlaceholderEbayUserId(account.ebayUserId)
        ? identity.userId
        : null;
    if (adoptUserId) {
      const [otherAccount, otherStore] = await Promise.all([
        this.accountRepo.findOne({
          where: {
            organizationId: pending.organizationId,
            ebayUserId: adoptUserId,
          },
          select: ['id', 'accountDisplayName'],
        }),
        this.storeRepo.findOne({
          where: {
            organizationId: pending.organizationId,
            ebayUserId: adoptUserId,
          },
          select: ['id', 'storeName'],
        }),
      ]);
      if (
        (otherAccount && otherAccount.id !== account.id) ||
        (otherStore && otherStore.id !== account.primaryStoreId)
      )
        throw new ConflictException(
          `This eBay seller is already connected in this workspace as "${otherAccount?.accountDisplayName ?? otherStore?.storeName}"`,
        );
    }

    const now = new Date();
    const expiresAt = new Date(tokens.expiresAt);
    const scopeList = (tokens.scope ?? '')
      .split(/[\s]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    await this.dataSource.transaction(async (m) => {
      const tokenRepo = m.getRepository(EbayOAuthToken);
      const tokenRow =
        (await tokenRepo.findOne({ where: { ebayAccountId: account.id } })) ??
        tokenRepo.create({
          ebayAccountId: account.id,
          refreshTokenExpiresAt: null,
        });
      tokenRow.accessTokenEncrypted = this.encryption.encrypt(
        tokens.accessToken,
      );
      tokenRow.accessTokenExpiresAt = expiresAt;
      tokenRow.refreshTokenEncrypted = this.encryption.encrypt(
        tokens.refreshToken,
      );
      if (scopeList.length) tokenRow.grantedScopes = scopeList;
      else if (!tokenRow.grantedScopes?.length)
        tokenRow.grantedScopes = ['https://api.ebay.com/oauth/api_scope'];
      tokenRow.lastRefreshedAt = now;
      tokenRow.reconnectRequired = false;
      await tokenRepo.save(tokenRow);

      await m
        .getRepository(ChannelConnection)
        .update(account.channelConnectionId, {
          encryptedTokens: this.encryption.encrypt(JSON.stringify(tokens)),
          tokenExpiresAt: expiresAt,
          scope: tokens.scope ?? null,
          status: 'active',
          lastError: null,
          ...(adoptUserId ? { externalAccountId: adoptUserId } : {}),
        });

      await m.getRepository(ConnectedEbayAccount).update(account.id, {
        connectionStatus: 'active',
        lastTokenRefreshAt: now,
        lastVerifiedAt: now,
        lastErrorMessage: null,
        ...(identity.username ? { ebayUsername: identity.username } : {}),
        ...(adoptUserId ? { ebayUserId: adoptUserId } : {}),
      });

      if (adoptUserId) {
        const storeRepo = m.getRepository(Store);
        const store = await storeRepo.findOne({
          where: { id: account.primaryStoreId },
        });
        if (store) {
          store.ebayUserId = adoptUserId;
          store.externalStoreId = adoptUserId;
          store.config = { ...(store.config ?? {}), ebayUserId: adoptUserId };
          await storeRepo.save(store);
        }
      }
    });

    await this.logWriter.write({
      organizationId: pending.organizationId,
      userId: pending.userId,
      ebayAccountId: account.id,
      marketplaceId: pending.marketplaceId,
      action: 'ebay_account_reconnected',
      result: 'success',
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      beforeSnapshot: {
        connectionStatus: account.connectionStatus,
        ebayUserId: account.ebayUserId,
      },
      afterSnapshot: {
        connectionStatus: 'active',
        verifiedBy,
        ebayUserId: adoptUserId ?? account.ebayUserId,
      },
    });

    this.queuePolicySync(account.id, pending);

    return {
      connectedEbayAccountId: account.id,
      redirectUrl: verticalRedirectPath(pending.vertical),
    };
  }

  /**
   * Does the new access token see at least one business-policy ID that is
   * cached for this account? Policy IDs are unique to an eBay seller, so a
   * match shows the login is the same seller. Returns 'no_cache' when there is
   * nothing to compare against.
   */
  private async tokenSeesCachedPolicies(
    ebayAccountId: string,
    accessToken: string,
    environment: 'sandbox' | 'production',
  ): Promise<boolean | 'no_cache'> {
    const cached = await this.policyRepo.find({
      where: { ebayAccountId },
      select: ['marketplaceId', 'policyType', 'ebayPolicyId'],
    });
    const known = new Set(cached.map((p) => p.ebayPolicyId));
    const pairs = [
      ...new Set(
        cached
          .filter((p) => POLICY_LIST_FIELDS[p.policyType])
          .map((p) => `${p.marketplaceId}|${p.policyType}`),
      ),
    ];
    if (!pairs.length) return 'no_cache';

    const apiBase =
      environment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';
    let answered = 0;
    for (const pair of pairs) {
      const [marketplaceId, policyType] = pair.split('|');
      const fields = POLICY_LIST_FIELDS[policyType];
      try {
        const { data } = await axios.get<
          Record<string, Record<string, unknown>[] | undefined>
        >(`${apiBase}/sell/account/v1/${policyType}_policy`, {
          params: { marketplace_id: marketplaceId },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15_000,
        });
        answered++;
        const rows = data?.[fields.list] ?? [];
        if (
          rows.some((row) => {
            const id = row[fields.id];
            return typeof id === 'string' && known.has(id);
          })
        )
          return true;
      } catch (e: unknown) {
        const status =
          (e as { response?: { status?: number } })?.response?.status ?? '?';
        this.logger.warn(
          `Reconnect seller check: ${policyType} policies for ${marketplaceId} failed (${status})`,
        );
      }
    }
    if (!answered)
      throw new ServiceUnavailableException(
        'Could not reach eBay to confirm the seller account. Try reconnecting again.',
      );
    return false;
  }

  /**
   * eBay's Identity API is served from apiz.ebay.com, not api.ebay.com.
   * Calling api.ebay.com is why older connections carry `unknown_<ms>` IDs.
   */
  private async fetchSellerIdentity(
    accessToken: string,
    environment: 'sandbox' | 'production',
  ): Promise<SellerIdentity> {
    const base =
      environment === 'production'
        ? 'https://apiz.ebay.com'
        : 'https://apiz.sandbox.ebay.com';
    try {
      const { data } = await axios.get<{
        userId?: unknown;
        username?: unknown;
      }>(`${base}/commerce/identity/v1/user/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15_000,
      });
      return {
        userId:
          typeof data?.userId === 'string' && data.userId ? data.userId : null,
        username:
          typeof data?.username === 'string' && data.username
            ? data.username
            : null,
      };
    } catch (e: unknown) {
      const status =
        (e as { response?: { status?: number } })?.response?.status ?? '?';
      this.logger.warn(
        { status, errMsg: (e as Error)?.message ?? String(e) },
        `eBay identity API failed (${status})`,
      );
      return { userId: null, username: null };
    }
  }

  private queuePolicySync(
    ebayAccountId: string,
    pending: EbayOAuthPendingPayload,
  ) {
    this.logger.log(`Queuing policy sync for account ${ebayAccountId}`);
    // Defer sync to next tick so it fully detaches from the HTTP request context.
    // Running async work inside an @Res() controller can deadlock TypeORM's
    // connection pool because NestJS never "completes" the request observable.
    const orgId = pending.organizationId;
    const usrId = pending.userId;
    setTimeout(() => {
      this.policySync
        .syncPolicies(ebayAccountId, orgId, usrId)
        .then((result) => {
          this.logger.log(
            `Auto-policy sync complete for ${ebayAccountId}: ${result.synced} policies — ${result.message}`,
          );
        })
        .catch((err: unknown) => {
          this.logger.error(
            `Auto-policy sync failed for ${ebayAccountId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }, 1000);
  }
}

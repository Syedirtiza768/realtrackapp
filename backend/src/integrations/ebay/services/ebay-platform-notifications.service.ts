import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import axios, { type AxiosInstance } from 'axios';
import { In, Not, Repository } from 'typeorm';
import { ConnectedEbayAccount } from '../entities/connected-ebay-account.entity.js';
import { Store } from '../../../channels/entities/store.entity.js';
import { EbayAuthService } from '../../../channels/ebay/ebay-auth.service.js';
import type { EbayOrderSyncJobPayload } from './ebay-sync.service.js';
import {
  ORDER_NOTIFICATION_EVENTS,
  buildGetNotificationPreferencesRequest,
  buildGetUserRequest,
  buildSetNotificationPreferencesRequest,
  isNoPreferencesError,
  isOrderNotificationEvent,
  parseApplicationPreferences,
  parseGetUserLogin,
  parsePlatformNotification,
  parseUserEventPreferences,
  tradingFailure,
  verifyNotificationSignature,
  type NotificationKeys,
} from './ebay-platform-notification.util.js';

/**
 * Notifications for one account inside this window share one import job, so a
 * multi-item checkout (several FixedPriceTransaction + ItemSold) costs one
 * Fulfillment API pass. The job runs when the window closes, plus a short
 * settle delay so the new order is visible to getOrders.
 */
const COALESCE_WINDOW_MS = 10_000;
const SETTLE_DELAY_MS = 3_000;
/** Second import pass, after the first, for orders eBay had not published yet. */
const RECHECK_DELAY_MS = 30_000;

export interface OrderNotificationStatus {
  ebayAccountId: string;
  /**
   * Seller's eBay login stored in Omni. Notifications are matched to the
   * account by it; subscribing records it from eBay when missing.
   */
  ebayUsername: string | null;
  /** EBAY_PLATFORM_NOTIFICATION_URL — where Omni wants eBay to deliver. */
  expectedUrl: string | null;
  /** eBay app-wide delivery URL (shared by every seller on this eBay app). */
  applicationUrl: string | null;
  applicationEnabled: boolean;
  /** Per-seller event switches for the order events. */
  events: Record<string, boolean>;
  /**
   * True when eBay delivers all order events for this seller to Omni and Omni
   * can match them to this account (ebayUsername known).
   */
  subscribed: boolean;
}

export type NotificationOutcome =
  | { status: 'ignored'; reason: string; eventName?: string | null }
  | { status: 'queued'; eventName: string; ebayAccountIds: string[] };

/**
 * eBay Platform Notifications for sales (Trading API).
 *
 * - subscribe/unsubscribe/getStatus: SetNotificationPreferences /
 *   GetNotificationPreferences with the seller's own token.
 * - handleNotification: verifies an incoming SOAP notification and queues the
 *   existing Fulfillment API order import for the seller's account. The poll
 *   (ORDER_IMPORT_CRON) stays as the safety net; import is idempotent.
 */
@Injectable()
export class EbayPlatformNotificationsService {
  private readonly logger = new Logger(EbayPlatformNotificationsService.name);
  private readonly http: AxiosInstance;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: EbayAuthService,
    @InjectRepository(ConnectedEbayAccount)
    private readonly accountRepo: Repository<ConnectedEbayAccount>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    @InjectQueue('ebay-order-sync')
    private readonly orderSyncQueue: Queue<EbayOrderSyncJobPayload>,
  ) {
    this.http = axios.create({ timeout: 30_000 });
  }

  // ─── Incoming notifications ───

  /** DevId + AppId + CertId of this server's eBay app, or null if incomplete. */
  private notificationKeys(): NotificationKeys | null {
    const { clientId, clientSecret } = this.auth.getApiConfig();
    const devId = this.config.get<string>('EBAY_DEV_ID', '').trim();
    if (!devId || !clientId || !clientSecret) return null;
    return { devId, appId: clientId, certId: clientSecret };
  }

  async handleNotification(rawXml: string): Promise<NotificationOutcome> {
    const parsed = parsePlatformNotification(rawXml);
    if (!parsed) {
      throw new BadRequestException('Expected an eBay SOAP notification');
    }

    const keys = this.notificationKeys();
    if (!keys) {
      this.logger.error(
        'eBay notification rejected: EBAY_DEV_ID / EBAY_CLIENT_ID / EBAY_CLIENT_SECRET not all set, cannot verify NotificationSignature',
      );
      throw new ServiceUnavailableException(
        'eBay notification verification is not configured',
      );
    }

    const check = verifyNotificationSignature({
      signature: parsed.signature,
      timestamp: parsed.timestamp,
      keys,
    });
    if (!check.ok) {
      this.logger.warn(
        `eBay notification rejected (${check.reason}): event=${parsed.eventName ?? '?'} timestamp=${parsed.timestamp ?? '?'}`,
      );
      throw new UnauthorizedException('Invalid eBay notification signature');
    }

    if (!isOrderNotificationEvent(parsed.eventName)) {
      return {
        status: 'ignored',
        reason: 'not an order event',
        eventName: parsed.eventName,
      };
    }

    const sellerUserId = parsed.recipientUserId ?? parsed.sellerUserId;
    if (!sellerUserId) {
      this.logger.warn(
        `eBay ${parsed.eventName} notification has no RecipientUserID — left to the order poll`,
      );
      return {
        status: 'ignored',
        reason: 'no seller in payload',
        eventName: parsed.eventName,
      };
    }

    const accounts = await this.resolveAccountsForSeller(sellerUserId);
    if (!accounts.length) {
      this.logger.warn(
        `eBay ${parsed.eventName} for seller "${sellerUserId}" matches no active connected account — ignored`,
      );
      return {
        status: 'ignored',
        reason: 'unknown seller',
        eventName: parsed.eventName,
      };
    }

    for (const account of accounts) {
      await this.queueOrderImport(account);
    }
    this.logger.log(
      `eBay ${parsed.eventName} for seller "${sellerUserId}" (item ${parsed.itemId ?? '?'}) → order import queued for ${accounts.length} account(s)`,
    );
    return {
      status: 'queued',
      eventName: parsed.eventName,
      ebayAccountIds: accounts.map((a) => a.id),
    };
  }

  /**
   * Active connected accounts whose eBay username (or stored eBay user id)
   * equals the notification's seller, case-insensitively, and whose primary
   * store is not archived. Usually one; the same seller connected in two
   * organizations yields both, exactly as the order poll would.
   */
  async resolveAccountsForSeller(
    sellerUserId: string,
  ): Promise<ConnectedEbayAccount[]> {
    const wanted = sellerUserId.trim().toLowerCase();
    if (!wanted) return [];
    const active = await this.accountRepo.find({
      where: { connectionStatus: 'active' },
    });
    const matches = active.filter(
      (a) =>
        a.ebayUsername?.trim().toLowerCase() === wanted ||
        a.ebayUserId?.trim().toLowerCase() === wanted,
    );
    if (!matches.length) return [];

    const stores = await this.storeRepo.find({
      where: {
        id: In([...new Set(matches.map((a) => a.primaryStoreId))]),
        channel: 'ebay',
        status: Not('archived'),
      },
    });
    const usable = new Set(stores.map((s) => s.id));
    return matches.filter((a) => usable.has(a.primaryStoreId));
  }

  private async queueOrderImport(account: ConnectedEbayAccount): Promise<void> {
    const now = Date.now();
    const window = Math.floor(now / COALESCE_WINDOW_MS);
    const runAt = (window + 1) * COALESCE_WINDOW_MS + SETTLE_DELAY_MS;
    const payload = {
      ebayAccountId: account.id,
      organizationId: account.organizationId,
      userId: null,
    };
    const options = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 15_000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    };
    // Same id inside one window → BullMQ keeps the first job only.
    await this.orderSyncQueue.add('sync-orders', payload, {
      ...options,
      jobId: `ebay-notify-orders-${account.id}-${window}`,
      delay: runAt - now,
    });
    // eBay can notify before getOrders shows the order. A second pass picks it
    // up then, instead of leaving it to the next scheduled poll (5 minutes),
    // so the cross-store sale sync still runs within a minute of the sale.
    // The import is idempotent, so a pass that finds nothing new is harmless.
    await this.orderSyncQueue.add('sync-orders', payload, {
      ...options,
      jobId: `ebay-notify-orders-${account.id}-${window}-recheck`,
      delay: runAt - now + RECHECK_DELAY_MS,
    });
  }

  // ─── Subscription management (admin) ───

  private expectedUrl(): string | null {
    const url = this.config
      .get<string>('EBAY_PLATFORM_NOTIFICATION_URL', '')
      .trim();
    return url || null;
  }

  private async loadAccount(
    ebayAccountId: string,
    organizationId: string,
  ): Promise<ConnectedEbayAccount> {
    const account = await this.accountRepo.findOne({
      where: { id: ebayAccountId, organizationId },
    });
    if (!account) throw new NotFoundException('eBay account not found');
    if (account.connectionStatus !== 'active') {
      throw new BadRequestException(
        `eBay account is not active (${account.connectionStatus}) — reconnect it first`,
      );
    }
    if (account.connectionSource === 'sellerpundit') {
      // Its token belongs to SellerPundit's eBay app: the call would move
      // SellerPundit's delivery URL, and its signatures use their keys.
      throw new BadRequestException(
        'This account is connected through SellerPundit. Connect it with native eBay OAuth to receive sale notifications.',
      );
    }
    return account;
  }

  private async postTrading(
    account: ConnectedEbayAccount,
    callName: string,
    body: string,
  ): Promise<string> {
    const token = await this.auth.getAccessToken(account.primaryStoreId);
    const baseUrl = await this.auth.getApiBaseUrlForStore(
      account.primaryStoreId,
    );
    let xml: string;
    try {
      const { data } = await this.http.post<string>(
        `${baseUrl}/ws/api.dll`,
        body,
        {
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': callName,
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-IAF-TOKEN': token,
          },
          responseType: 'text',
          transformResponse: [(r: unknown) => r],
        },
      );
      xml = String(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`eBay ${callName} request failed: ${msg}`);
    }
    const failure = tradingFailure(xml);
    if (failure) {
      throw new BadGatewayException(`eBay ${callName} failed: ${failure}`);
    }
    return xml;
  }

  /**
   * GetNotificationPreferences. eBay answers error 12209 ("There is no valid
   * preference found for your request") when nothing was ever set at that
   * level — for a new eBay app, or a seller never subscribed. That means "no
   * preferences", so it reads as an empty response instead of a failure;
   * otherwise the first subscribe could never get past its pre-check.
   */
  private async getPreferences(
    account: ConnectedEbayAccount,
    level: 'Application' | 'User',
  ): Promise<string> {
    try {
      return await this.postTrading(
        account,
        'GetNotificationPreferences',
        buildGetNotificationPreferencesRequest(level),
      );
    } catch (err) {
      if (isNoPreferencesError(err)) return '';
      throw err;
    }
  }

  async getStatus(
    ebayAccountId: string,
    organizationId: string,
  ): Promise<OrderNotificationStatus> {
    const account = await this.loadAccount(ebayAccountId, organizationId);
    return this.readStatus(account);
  }

  private async readStatus(
    account: ConnectedEbayAccount,
  ): Promise<OrderNotificationStatus> {
    const appXml = await this.getPreferences(account, 'Application');
    const userXml = await this.getPreferences(account, 'User');
    const app = parseApplicationPreferences(appXml);
    const userEvents = parseUserEventPreferences(userXml);
    const events = Object.fromEntries(
      ORDER_NOTIFICATION_EVENTS.map((e) => [e, userEvents[e] === true]),
    );
    const expectedUrl = this.expectedUrl();
    return {
      ebayAccountId: account.id,
      ebayUsername: account.ebayUsername?.trim() || null,
      expectedUrl,
      applicationUrl: app.applicationUrl,
      applicationEnabled: app.applicationEnabled,
      events,
      subscribed:
        !!account.ebayUsername?.trim() &&
        !!expectedUrl &&
        app.applicationUrl === expectedUrl &&
        app.applicationEnabled &&
        Object.values(events).every(Boolean),
    };
  }

  /**
   * Point this eBay app's notifications at Omni and enable the order events
   * for one seller. Refuses to move an app-wide delivery URL that points
   * somewhere else unless replaceApplicationUrl is true.
   */
  async subscribe(
    ebayAccountId: string,
    organizationId: string,
    options: { replaceApplicationUrl?: boolean; actorUserId?: string | null },
  ): Promise<OrderNotificationStatus> {
    const expectedUrl = this.expectedUrl();
    if (!expectedUrl || !/^https:\/\/[^\s]+$/i.test(expectedUrl)) {
      throw new BadRequestException(
        'Set EBAY_PLATFORM_NOTIFICATION_URL to the public https URL of POST /api/integrations/ebay/platform-notifications first',
      );
    }
    if (!this.notificationKeys()) {
      throw new BadRequestException(
        'Set EBAY_DEV_ID (with EBAY_CLIENT_ID / EBAY_CLIENT_SECRET) first — without it incoming notifications cannot be verified',
      );
    }
    const account = await this.loadAccount(ebayAccountId, organizationId);
    // Before changing anything on eBay: make sure this seller's notifications
    // can be matched back to the account.
    await this.recordSellerLogin(account);

    const current = parseApplicationPreferences(
      await this.getPreferences(account, 'Application'),
    );
    if (
      current.applicationUrl &&
      current.applicationUrl !== expectedUrl &&
      !options.replaceApplicationUrl
    ) {
      throw new ConflictException(
        `This eBay app already delivers notifications to ${current.applicationUrl}. That URL is shared by every seller on the app. Send replaceApplicationUrl: true to move it to ${expectedUrl}.`,
      );
    }

    await this.postTrading(
      account,
      'SetNotificationPreferences',
      buildSetNotificationPreferencesRequest({
        enable: true,
        applicationUrl: expectedUrl,
      }),
    );
    this.logger.log(
      `eBay sale notifications enabled for account ${account.id} (${account.ebayUsername ?? account.ebayUserId}) → ${expectedUrl}` +
        (current.applicationUrl && current.applicationUrl !== expectedUrl
          ? ` (app URL moved from ${current.applicationUrl})`
          : '') +
        ` by user ${options.actorUserId ?? 'unknown'}`,
    );
    return this.readStatus(account);
  }

  /**
   * Notifications name the seller by eBay login (RecipientUserID), but many
   * accounts were connected when the identity lookup failed and store only an
   * `unknown_<ts>` placeholder. Ask eBay who owns the token and store the login
   * in connected_ebay_accounts.ebay_username when it is missing or different.
   */
  private async recordSellerLogin(
    account: ConnectedEbayAccount,
  ): Promise<void> {
    const login = parseGetUserLogin(
      await this.postTrading(account, 'GetUser', buildGetUserRequest()),
    );
    const stored = account.ebayUsername?.trim() || null;
    if (!login) {
      if (stored) return;
      throw new BadGatewayException(
        "eBay GetUser did not return the seller's username, so notifications could not be matched to this account",
      );
    }
    if (stored?.toLowerCase() === login.toLowerCase()) return;
    await this.accountRepo.update(account.id, { ebayUsername: login });
    this.logger.log(
      `eBay account ${account.id}: ebay_username ${stored ?? '(none)'} → ${login} (from GetUser)`,
    );
    account.ebayUsername = login;
  }

  /**
   * Turn the order events off for one seller. The app-wide delivery URL is
   * left alone — other sellers may still use it.
   */
  async unsubscribe(
    ebayAccountId: string,
    organizationId: string,
    options: { actorUserId?: string | null } = {},
  ): Promise<OrderNotificationStatus> {
    const account = await this.loadAccount(ebayAccountId, organizationId);
    await this.postTrading(
      account,
      'SetNotificationPreferences',
      buildSetNotificationPreferencesRequest({ enable: false }),
    );
    this.logger.log(
      `eBay sale notifications disabled for account ${account.id} (${account.ebayUsername ?? account.ebayUserId}) by user ${options.actorUserId ?? 'unknown'}`,
    );
    return this.readStatus(account);
  }
}

import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { In, Not } from 'typeorm';
import { EbayPlatformNotificationsService } from './ebay-platform-notifications.service';
import { computeNotificationSignature } from './ebay-platform-notification.util';

const KEYS = { devId: 'dev-1', appId: 'app-1', certId: 'cert-1' };

function soap(opts: {
  timestamp: string;
  signature: string;
  eventName?: string;
  recipient?: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
 <soapenv:Header><ebl:RequesterCredentials xmlns:ebl="urn:ebay:apis:eBLBaseComponents"><ebl:NotificationSignature>${opts.signature}</ebl:NotificationSignature></ebl:RequesterCredentials></soapenv:Header>
 <soapenv:Body><GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>${opts.timestamp}</Timestamp><Ack>Success</Ack>
  <NotificationEventName>${opts.eventName ?? 'FixedPriceTransaction'}</NotificationEventName>
  <RecipientUserID>${opts.recipient ?? 'Acme_Parts'}</RecipientUserID>
  <Item><ItemID>1100</ItemID></Item>
 </GetItemTransactionsResponse></soapenv:Body>
</soapenv:Envelope>`;
}

function signed(opts: Omit<Parameters<typeof soap>[0], 'signature'>) {
  return soap({
    ...opts,
    signature: computeNotificationSignature(opts.timestamp, KEYS),
  });
}

type AddCall = [
  string,
  Record<string, unknown>,
  { jobId: string; delay: number },
];
type PostCall = [string, string, { headers: Record<string, string> }];

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'acct-1',
  organizationId: 'org-1',
  primaryStoreId: 'store-1',
  ebayUserId: 'immutable-id-1',
  ebayUsername: 'acme_parts',
  connectionStatus: 'active',
  connectionSource: 'native_oauth',
  ...overrides,
});

describe('EbayPlatformNotificationsService', () => {
  let env: Record<string, string>;
  let accountRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let storeRepo: { find: jest.Mock };
  let queue: { add: jest.Mock };
  let auth: {
    getApiConfig: jest.Mock;
    getAccessToken: jest.Mock;
    getApiBaseUrlForStore: jest.Mock;
  };
  let service: EbayPlatformNotificationsService;
  let http: { post: jest.Mock };
  const addCalls = () => queue.add.mock.calls as unknown as AddCall[];
  const postCalls = () => http.post.mock.calls as unknown as PostCall[];

  beforeEach(() => {
    env = {
      EBAY_DEV_ID: KEYS.devId,
      EBAY_PLATFORM_NOTIFICATION_URL:
        'https://omni.example.com/api/integrations/ebay/platform-notifications',
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
    };
    auth = {
      getApiConfig: jest.fn(() => ({
        clientId: KEYS.appId,
        clientSecret: KEYS.certId,
      })),
      getAccessToken: jest.fn(() => Promise.resolve('token')),
      getApiBaseUrlForStore: jest.fn(() =>
        Promise.resolve('https://api.ebay.com'),
      ),
    };
    accountRepo = {
      find: jest.fn(() => Promise.resolve([account()])),
      findOne: jest.fn(() => Promise.resolve(account())),
      update: jest.fn(() => Promise.resolve(undefined)),
    };
    storeRepo = {
      find: jest.fn(() => Promise.resolve([{ id: 'store-1' }])),
    };
    queue = { add: jest.fn(() => Promise.resolve({ id: 'job' })) };
    service = new EbayPlatformNotificationsService(
      config as never,
      auth as never,
      accountRepo as never,
      storeRepo as never,
      queue as never,
    );
    http = { post: jest.fn() };
    (service as unknown as { http: typeof http }).http = http;
  });

  describe('resolveAccountsForSeller', () => {
    it('matches the eBay username case-insensitively', async () => {
      const found = await service.resolveAccountsForSeller('ACME_PARTS');
      expect(found.map((a) => a.id)).toEqual(['acct-1']);
      expect(accountRepo.find).toHaveBeenCalledWith({
        where: { connectionStatus: 'active' },
      });
      expect(storeRepo.find).toHaveBeenCalledWith({
        where: {
          id: In(['store-1']),
          channel: 'ebay',
          status: Not('archived'),
        },
      });
    });

    it('falls back to the stored eBay user id', async () => {
      accountRepo.find.mockResolvedValue([
        account({ ebayUsername: null, ebayUserId: 'acme_parts' }),
      ]);
      const found = await service.resolveAccountsForSeller('acme_parts');
      expect(found).toHaveLength(1);
    });

    it('treats "_" literally, not as a wildcard', async () => {
      accountRepo.find.mockResolvedValue([
        account({ ebayUsername: 'acmexparts' }),
      ]);
      expect(await service.resolveAccountsForSeller('acme_parts')).toEqual([]);
      expect(storeRepo.find).not.toHaveBeenCalled();
    });

    it('drops accounts whose primary store is archived or missing', async () => {
      accountRepo.find.mockResolvedValue([
        account(),
        account({ id: 'acct-2', primaryStoreId: 'store-archived' }),
      ]);
      const found = await service.resolveAccountsForSeller('acme_parts');
      expect(found.map((a) => a.id)).toEqual(['acct-1']);
    });

    it('returns every org that connected the same seller', async () => {
      accountRepo.find.mockResolvedValue([
        account(),
        account({
          id: 'acct-2',
          organizationId: 'org-2',
          primaryStoreId: 'store-2',
        }),
      ]);
      storeRepo.find.mockResolvedValue([{ id: 'store-1' }, { id: 'store-2' }]);
      const found = await service.resolveAccountsForSeller('acme_parts');
      expect(found.map((a) => a.id)).toEqual(['acct-1', 'acct-2']);
    });

    it('returns nothing for a blank seller id', async () => {
      expect(await service.resolveAccountsForSeller('  ')).toEqual([]);
      expect(accountRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('handleNotification', () => {
    const fresh = () => new Date().toISOString();

    it('queues one coalesced order import for the seller account', async () => {
      const result = await service.handleNotification(
        signed({ timestamp: fresh() }),
      );
      expect(result).toEqual({
        status: 'queued',
        eventName: 'FixedPriceTransaction',
        ebayAccountIds: ['acct-1'],
      });
      // One import when the window closes, one recheck 30 s later.
      expect(queue.add).toHaveBeenCalledTimes(2);
      const [name, data, opts] = addCalls()[0];
      expect(name).toBe('sync-orders');
      expect(data).toEqual({
        ebayAccountId: 'acct-1',
        organizationId: 'org-1',
        userId: null,
      });
      expect(opts.jobId).toMatch(/^ebay-notify-orders-acct-1-\d+$/);
      expect(opts.jobId).not.toContain(':');
      expect(opts.delay).toBeGreaterThan(0);
      expect(opts.delay).toBeLessThanOrEqual(13_000);
      const [recheckName, recheckData, recheck] = addCalls()[1];
      expect(recheckName).toBe('sync-orders');
      expect(recheckData).toEqual(data);
      expect(recheck.jobId).toBe(`${opts.jobId}-recheck`);
      expect(recheck.delay).toBe(opts.delay + 30_000);
    });

    it('gives notifications in the same window the same job id', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-18T10:00:00.500Z') });
      try {
        const ts = new Date().toISOString();
        await service.handleNotification(signed({ timestamp: ts }));
        jest.setSystemTime(new Date('2026-11-18T10:00:08.000Z'));
        await service.handleNotification(
          signed({
            timestamp: new Date().toISOString(),
            eventName: 'ItemSold',
          }),
        );
        // [first import, recheck] per notification, same ids in one window.
        expect(addCalls()[0][2].jobId).toBe(addCalls()[2][2].jobId);
        expect(addCalls()[1][2].jobId).toBe(addCalls()[3][2].jobId);
      } finally {
        jest.useRealTimers();
      }
    });

    it('rejects a bad signature without touching the database', async () => {
      const xml = soap({
        timestamp: fresh(),
        signature: 'AAAAAAAAAAAAAAAAAAAAAA==',
      });
      await expect(service.handleNotification(xml)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(accountRepo.find).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects a stale notification', async () => {
      const old = new Date(Date.now() - 11 * 60_000).toISOString();
      await expect(
        service.handleNotification(signed({ timestamp: old })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('refuses to accept anything when EBAY_DEV_ID is not set', async () => {
      delete env.EBAY_DEV_ID;
      await expect(
        service.handleNotification(signed({ timestamp: fresh() })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('rejects a body that is not SOAP', async () => {
      await expect(service.handleNotification('{}')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('ignores non-sale events', async () => {
      const result = await service.handleNotification(
        signed({ timestamp: fresh(), eventName: 'ItemListed' }),
      );
      expect(result).toMatchObject({ status: 'ignored' });
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('ignores a seller with no connected account', async () => {
      const result = await service.handleNotification(
        signed({ timestamp: fresh(), recipient: 'stranger' }),
      );
      expect(result).toMatchObject({
        status: 'ignored',
        reason: 'unknown seller',
      });
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    const appPrefs = (url: string | null) =>
      `<GetNotificationPreferencesResponse><Ack>Success</Ack><ApplicationDeliveryPreferences>${url ? `<ApplicationURL>${url}</ApplicationURL>` : ''}<ApplicationEnable>Enable</ApplicationEnable></ApplicationDeliveryPreferences></GetNotificationPreferencesResponse>`;
    const userPrefs = `<GetNotificationPreferencesResponse><Ack>Success</Ack><UserDeliveryPreferenceArray><NotificationEnable><EventType>FixedPriceTransaction</EventType><EventEnable>Enable</EventEnable></NotificationEnable><NotificationEnable><EventType>AuctionCheckoutComplete</EventType><EventEnable>Enable</EventEnable></NotificationEnable><NotificationEnable><EventType>ItemSold</EventType><EventEnable>Enable</EventEnable></NotificationEnable></UserDeliveryPreferenceArray></GetNotificationPreferencesResponse>`;
    const ours =
      'https://omni.example.com/api/integrations/ebay/platform-notifications';
    const getUser = (login: string | null) =>
      `<GetUserResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><User><EIASToken>x</EIASToken>${login ? `<UserID>${login}</UserID>` : ''}<UserIDChanged>false</UserIDChanged></User></GetUserResponse>`;
    const setOk =
      '<SetNotificationPreferencesResponse><Ack>Success</Ack></SetNotificationPreferencesResponse>';
    const callNames = () =>
      postCalls().map((c) => c[2].headers['X-EBAY-API-CALL-NAME']);

    function reply(sequence: string[]) {
      for (const data of sequence) http.post.mockResolvedValueOnce({ data });
    }

    it('refuses to move an app URL that points elsewhere', async () => {
      reply([
        getUser('acme_parts'),
        appPrefs('https://other.example.com/hook'),
      ]);
      await expect(
        service.subscribe('acct-1', 'org-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      // Only reads happened — nothing was written to eBay.
      expect(callNames()).toEqual(['GetUser', 'GetNotificationPreferences']);
    });

    it('sets preferences with the seller token and reports subscribed', async () => {
      reply([
        getUser('acme_parts'),
        appPrefs(null),
        setOk,
        appPrefs(ours),
        userPrefs,
      ]);
      const status = await service.subscribe('acct-1', 'org-1', {
        actorUserId: 'user-1',
      });
      expect(auth.getAccessToken).toHaveBeenCalledWith('store-1');
      expect(callNames()).toEqual([
        'GetUser',
        'GetNotificationPreferences',
        'SetNotificationPreferences',
        'GetNotificationPreferences',
        'GetNotificationPreferences',
      ]);
      // Username already stored → nothing to record.
      expect(accountRepo.update).not.toHaveBeenCalled();
      const [url, body, opts] = postCalls()[2];
      expect(url).toBe('https://api.ebay.com/ws/api.dll');
      expect(opts.headers['X-EBAY-API-CALL-NAME']).toBe(
        'SetNotificationPreferences',
      );
      expect(opts.headers['X-EBAY-API-IAF-TOKEN']).toBe('token');
      expect(body).toContain(`<ApplicationURL>${ours}</ApplicationURL>`);
      expect(status).toMatchObject({
        subscribed: true,
        applicationUrl: ours,
        ebayUsername: 'acme_parts',
      });
    });

    it('subscribes when eBay has no preferences yet (error 12209)', async () => {
      // A new eBay app answers GetNotificationPreferences with 12209 until
      // something was set; seen on every production account 2026-11-21.
      const none =
        '<GetNotificationPreferencesResponse><Ack>Failure</Ack><Errors><ShortMessage>No valid preference found.</ShortMessage><LongMessage>There is no valid preference found for your request.</LongMessage><ErrorCode>12209</ErrorCode></Errors></GetNotificationPreferencesResponse>';
      reply([getUser('acme_parts'), none, setOk, appPrefs(ours), userPrefs]);
      const status = await service.subscribe('acct-1', 'org-1', {});
      expect(callNames()).toEqual([
        'GetUser',
        'GetNotificationPreferences',
        'SetNotificationPreferences',
        'GetNotificationPreferences',
        'GetNotificationPreferences',
      ]);
      expect(status).toMatchObject({ subscribed: true, applicationUrl: ours });
    });

    it('still fails on other GetNotificationPreferences errors', async () => {
      reply([
        getUser('acme_parts'),
        '<GetNotificationPreferencesResponse><Ack>Failure</Ack><Errors><LongMessage>Invalid token.</LongMessage><ErrorCode>931</ErrorCode></Errors></GetNotificationPreferencesResponse>',
      ]);
      await expect(service.subscribe('acct-1', 'org-1', {})).rejects.toThrow(
        /931/,
      );
      expect(callNames()).not.toContain('SetNotificationPreferences');
    });

    it('records the seller login from GetUser when the account has none', async () => {
      // Prod accounts connected while the identity lookup failed store only a
      // placeholder id and no username.
      accountRepo.findOne.mockResolvedValue(
        account({ ebayUsername: null, ebayUserId: 'unknown_1786954617061' }),
      );
      reply([
        getUser('Acme_Parts'),
        appPrefs(null),
        setOk,
        appPrefs(ours),
        userPrefs,
      ]);
      const status = await service.subscribe('acct-1', 'org-1', {});
      expect(accountRepo.update).toHaveBeenCalledWith('acct-1', {
        ebayUsername: 'Acme_Parts',
      });
      expect(status).toMatchObject({
        subscribed: true,
        ebayUsername: 'Acme_Parts',
      });
    });

    it('does not touch eBay settings when the seller login is unknown', async () => {
      accountRepo.findOne.mockResolvedValue(account({ ebayUsername: null }));
      reply([getUser(null)]);
      await expect(service.subscribe('acct-1', 'org-1', {})).rejects.toThrow(
        /username/,
      );
      expect(callNames()).toEqual(['GetUser']);
      expect(accountRepo.update).not.toHaveBeenCalled();
    });

    it('reports not subscribed while the account has no username', async () => {
      accountRepo.findOne.mockResolvedValue(account({ ebayUsername: null }));
      reply([appPrefs(ours), userPrefs]);
      const status = await service.getStatus('acct-1', 'org-1');
      expect(status).toMatchObject({
        subscribed: false,
        ebayUsername: null,
        applicationUrl: ours,
      });
    });

    it('needs EBAY_PLATFORM_NOTIFICATION_URL to be an https URL', async () => {
      env.EBAY_PLATFORM_NOTIFICATION_URL = 'http://insecure.example.com/x';
      await expect(
        service.subscribe('acct-1', 'org-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(http.post).not.toHaveBeenCalled();
    });

    it('refuses SellerPundit-connected accounts', async () => {
      accountRepo.findOne.mockResolvedValue(
        account({ connectionSource: 'sellerpundit' }),
      );
      await expect(
        service.subscribe('acct-1', 'org-1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(http.post).not.toHaveBeenCalled();
    });
  });
});

import { createHash } from 'node:crypto';
import {
  buildGetNotificationPreferencesRequest,
  buildGetUserRequest,
  buildSetNotificationPreferencesRequest,
  computeNotificationSignature,
  isOrderNotificationEvent,
  parseApplicationPreferences,
  parseGetUserLogin,
  parsePlatformNotification,
  parseUserEventPreferences,
  tradingFailure,
  verifyNotificationSignature,
} from './ebay-platform-notification.util';

const keys = { devId: 'dev-123', appId: 'app-456', certId: 'cert-789' };

function notificationXml(opts: {
  timestamp: string;
  signature: string;
  eventName?: string;
  recipient?: string | null;
  seller?: string;
}): string {
  const recipient =
    opts.recipient === null
      ? ''
      : `<RecipientUserID>${opts.recipient ?? 'acme_parts'}</RecipientUserID>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
 <soapenv:Header>
  <ebl:RequesterCredentials soapenv:mustUnderstand="0" xmlns:ns="urn:ebay:apis:eBLBaseComponents" xmlns:ebl="urn:ebay:apis:eBLBaseComponents">
   <ebl:NotificationSignature xmlns:ebl="urn:ebay:apis:eBLBaseComponents">${opts.signature}</ebl:NotificationSignature>
  </ebl:RequesterCredentials>
 </soapenv:Header>
 <soapenv:Body>
  <GetItemTransactionsResponse xmlns="urn:ebay:apis:eBLBaseComponents">
   <Timestamp>${opts.timestamp}</Timestamp>
   <Ack>Success</Ack>
   <CorrelationID>123</CorrelationID>
   <Version>1193</Version>
   <NotificationEventName>${opts.eventName ?? 'FixedPriceTransaction'}</NotificationEventName>
   ${recipient}
   <Item>
    <ItemID>110012345678</ItemID>
    <Seller><UserID>${opts.seller ?? 'acme_parts'}</UserID><Email>seller@example.com</Email></Seller>
    <ListingDetails><StartTime>2026-11-01T00:00:00.000Z</StartTime></ListingDetails>
   </Item>
   <TransactionArray>
    <Transaction><TransactionID>0</TransactionID><Buyer><UserID>buyer_x</UserID></Buyer></Transaction>
   </TransactionArray>
  </GetItemTransactionsResponse>
 </soapenv:Body>
</soapenv:Envelope>`;
}

describe('eBay platform notification signature', () => {
  const timestamp = '2026-11-18T10:00:00.000Z';
  const now = new Date('2026-11-18T10:02:00.000Z');

  it('is Base64(MD5(Timestamp + DevId + AppId + CertId))', () => {
    const expected = createHash('md5')
      .update(`${timestamp}dev-123app-456cert-789`)
      .digest('base64');
    expect(computeNotificationSignature(timestamp, keys)).toBe(expected);
  });

  it('accepts a matching, fresh signature', () => {
    const signature = computeNotificationSignature(timestamp, keys);
    expect(
      verifyNotificationSignature({ signature, timestamp, keys, now }),
    ).toEqual({ ok: true });
  });

  it('rejects a signature made with other keys', () => {
    const signature = computeNotificationSignature(timestamp, {
      ...keys,
      certId: 'someone-else',
    });
    expect(
      verifyNotificationSignature({ signature, timestamp, keys, now }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects a signature for a different timestamp (tampered body)', () => {
    const signature = computeNotificationSignature(timestamp, keys);
    expect(
      verifyNotificationSignature({
        signature,
        timestamp: '2026-11-18T10:01:00.000Z',
        keys,
        now,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects garbage that is not even 16 bytes of Base64', () => {
    expect(
      verifyNotificationSignature({
        signature: 'not-a-signature',
        timestamp,
        keys,
        now,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('rejects a valid signature older than 10 minutes (replay)', () => {
    const signature = computeNotificationSignature(timestamp, keys);
    expect(
      verifyNotificationSignature({
        signature,
        timestamp,
        keys,
        now: new Date('2026-11-18T10:10:01.000Z'),
      }),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects a timestamp too far in the future', () => {
    const future = '2026-11-18T10:30:00.000Z';
    const signature = computeNotificationSignature(future, keys);
    expect(
      verifyNotificationSignature({ signature, timestamp: future, keys, now }),
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects missing signature or timestamp', () => {
    expect(
      verifyNotificationSignature({ signature: null, timestamp, keys, now }),
    ).toEqual({ ok: false, reason: 'missing' });
    expect(
      verifyNotificationSignature({
        signature: 'abc',
        timestamp: null,
        keys,
        now,
      }),
    ).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects an unparseable timestamp', () => {
    const signature = computeNotificationSignature('yesterday', keys);
    expect(
      verifyNotificationSignature({
        signature,
        timestamp: 'yesterday',
        keys,
        now,
      }),
    ).toEqual({ ok: false, reason: 'bad_timestamp' });
  });
});

describe('parsePlatformNotification', () => {
  it('reads signature, timestamp, event, recipient, seller and item', () => {
    const xml = notificationXml({
      timestamp: '2026-11-18T10:00:00.000Z',
      signature: 'c2lnbmF0dXJl==',
    });
    expect(parsePlatformNotification(xml)).toEqual({
      eventName: 'FixedPriceTransaction',
      timestamp: '2026-11-18T10:00:00.000Z',
      signature: 'c2lnbmF0dXJl==',
      recipientUserId: 'acme_parts',
      sellerUserId: 'acme_parts',
      itemId: '110012345678',
    });
  });

  it('uses the body-level Timestamp, not other dates in the item', () => {
    const xml = notificationXml({
      timestamp: '2026-11-18T10:00:00.000Z',
      signature: 'x',
    });
    expect(parsePlatformNotification(xml)?.timestamp).toBe(
      '2026-11-18T10:00:00.000Z',
    );
  });

  it('decodes XML entities in the seller id', () => {
    const xml = notificationXml({
      timestamp: '2026-11-18T10:00:00.000Z',
      signature: 'x',
      recipient: 'parts&amp;more',
    });
    expect(parsePlatformNotification(xml)?.recipientUserId).toBe('parts&more');
  });

  it('leaves recipient null when the payload has none', () => {
    const xml = notificationXml({
      timestamp: '2026-11-18T10:00:00.000Z',
      signature: 'x',
      recipient: null,
      seller: 'fallback_seller',
    });
    const parsed = parsePlatformNotification(xml);
    expect(parsed?.recipientUserId).toBeNull();
    expect(parsed?.sellerUserId).toBe('fallback_seller');
  });

  it('works without namespace prefixes', () => {
    const xml = `<Envelope><Header><NotificationSignature>abc</NotificationSignature></Header><Body><GetItemResponse><Timestamp>t</Timestamp><NotificationEventName>ItemSold</NotificationEventName><RecipientUserID>s1</RecipientUserID></GetItemResponse></Body></Envelope>`;
    expect(parsePlatformNotification(xml)).toMatchObject({
      eventName: 'ItemSold',
      signature: 'abc',
      timestamp: 't',
      recipientUserId: 's1',
    });
  });

  it('returns null for something that is not a SOAP envelope', () => {
    expect(parsePlatformNotification('')).toBeNull();
    expect(parsePlatformNotification('{"metadata":{}}')).toBeNull();
  });

  it('knows which events are sales', () => {
    expect(isOrderNotificationEvent('FixedPriceTransaction')).toBe(true);
    expect(isOrderNotificationEvent('AuctionCheckoutComplete')).toBe(true);
    expect(isOrderNotificationEvent('ItemSold')).toBe(true);
    expect(isOrderNotificationEvent('ItemListed')).toBe(false);
    expect(isOrderNotificationEvent(null)).toBe(false);
  });
});

describe('notification preference requests', () => {
  it('subscribe sets the app URL and enables the three order events', () => {
    const xml = buildSetNotificationPreferencesRequest({
      enable: true,
      applicationUrl: 'https://omni.example.com/api/x?a=1&b=2',
    });
    expect(xml).toContain('<SetNotificationPreferencesRequest');
    expect(xml).toContain(
      '<ApplicationURL>https://omni.example.com/api/x?a=1&amp;b=2</ApplicationURL>',
    );
    expect(xml).toContain('<ApplicationEnable>Enable</ApplicationEnable>');
    for (const event of [
      'FixedPriceTransaction',
      'AuctionCheckoutComplete',
      'ItemSold',
    ]) {
      expect(xml).toContain(`<EventType>${event}</EventType>`);
    }
    expect(xml.match(/<EventEnable>Enable<\/EventEnable>/g)).toHaveLength(3);
  });

  it('unsubscribe only disables the user events and leaves the app URL alone', () => {
    const xml = buildSetNotificationPreferencesRequest({ enable: false });
    expect(xml).not.toContain('ApplicationDeliveryPreferences');
    expect(xml.match(/<EventEnable>Disable<\/EventEnable>/g)).toHaveLength(3);
  });

  it('builds GetNotificationPreferences for a level', () => {
    expect(buildGetNotificationPreferencesRequest('User')).toContain(
      '<PreferenceLevel>User</PreferenceLevel>',
    );
  });

  it('parses application and user preferences', () => {
    const app = `<GetNotificationPreferencesResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ApplicationDeliveryPreferences><ApplicationURL>https://omni.example.com/n</ApplicationURL><ApplicationEnable>Enable</ApplicationEnable><DeviceType>Platform</DeviceType></ApplicationDeliveryPreferences></GetNotificationPreferencesResponse>`;
    expect(parseApplicationPreferences(app)).toEqual({
      applicationUrl: 'https://omni.example.com/n',
      applicationEnabled: true,
    });
    expect(parseApplicationPreferences('<Ack>Success</Ack>')).toEqual({
      applicationUrl: null,
      applicationEnabled: false,
    });

    const user = `<GetNotificationPreferencesResponse><Ack>Success</Ack><UserDeliveryPreferenceArray><NotificationEnable><EventType>FixedPriceTransaction</EventType><EventEnable>Enable</EventEnable></NotificationEnable><NotificationEnable><EventType>ItemSold</EventType><EventEnable>Disable</EventEnable></NotificationEnable></UserDeliveryPreferenceArray></GetNotificationPreferencesResponse>`;
    expect(parseUserEventPreferences(user)).toEqual({
      FixedPriceTransaction: true,
      ItemSold: false,
    });
  });

  it('reads the token owner login from GetUser, not UserIDChanged', () => {
    expect(buildGetUserRequest()).toContain('<GetUserRequest');
    expect(buildGetUserRequest()).not.toContain('<UserID>');
    expect(
      parseGetUserLogin(
        '<GetUserResponse><Ack>Success</Ack><User><EIASToken>e</EIASToken><UserIDChanged>false</UserIDChanged><UserID>acme_parts</UserID></User></GetUserResponse>',
      ),
    ).toBe('acme_parts');
    expect(
      parseGetUserLogin(
        '<GetUserResponse><Ack>Success</Ack></GetUserResponse>',
      ),
    ).toBeNull();
  });

  it('reports Trading failures and passes successes/warnings', () => {
    expect(tradingFailure('<Ack>Success</Ack>')).toBeNull();
    expect(tradingFailure('<Ack>Warning</Ack>')).toBeNull();
    expect(
      tradingFailure(
        '<Ack>Failure</Ack><Errors><ShortMessage>Bad</ShortMessage><LongMessage>Invalid URL.</LongMessage><ErrorCode>12345</ErrorCode></Errors>',
      ),
    ).toBe('(12345) Invalid URL.');
    expect(tradingFailure('<html>gateway</html>')).toBe(
      'Unexpected Trading API response',
    );
  });
});

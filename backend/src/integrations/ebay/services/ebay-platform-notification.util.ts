import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * eBay Trading API Platform Notifications that mean "a sale happened".
 * Any of them makes Omni re-run the Fulfillment API order import for the
 * seller's store; the notification body itself is not turned into an order.
 */
export const ORDER_NOTIFICATION_EVENTS = [
  'FixedPriceTransaction',
  'AuctionCheckoutComplete',
  'ItemSold',
] as const;

export type OrderNotificationEvent = (typeof ORDER_NOTIFICATION_EVENTS)[number];

/** eBay's guidance: discard notifications whose Timestamp is older than 10 minutes. */
export const NOTIFICATION_MAX_AGE_MS = 10 * 60_000;

export function isOrderNotificationEvent(
  eventName: string | null | undefined,
): eventName is OrderNotificationEvent {
  return (ORDER_NOTIFICATION_EVENTS as readonly string[]).includes(
    eventName ?? '',
  );
}

export interface ParsedPlatformNotification {
  /** NotificationEventName, e.g. FixedPriceTransaction. */
  eventName: string | null;
  /** Body-level Timestamp, exactly as sent — it is part of the signature. */
  timestamp: string | null;
  /** SOAP header NotificationSignature (Base64 MD5). */
  signature: string | null;
  /** RecipientUserID — the eBay user the notification is for (the seller). */
  recipientUserId: string | null;
  /** Item.Seller.UserID, used when RecipientUserID is missing. */
  sellerUserId: string | null;
  /** First ItemID in the payload, for logging only. */
  itemId: string | null;
}

const NS_PREFIX = '(?:[A-Za-z_][\\w.-]*:)?';

function decodeXmlText(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Inner XML of the first `<tag>` (any namespace prefix), or null. */
function firstElement(xml: string, tag: string): string | null {
  const m = xml.match(
    new RegExp(
      `<${NS_PREFIX}${tag}\\b[^>]*>([\\s\\S]*?)</${NS_PREFIX}${tag}>`,
      'i',
    ),
  );
  return m ? m[1] : null;
}

/** Trimmed, entity-decoded text of the first `<tag>`, or null when empty. */
export function firstTagText(xml: string, tag: string): string | null {
  const inner = firstElement(xml, tag);
  if (inner == null) return null;
  const text = decodeXmlText(inner.trim()).trim();
  return text || null;
}

/** Every `<tag>` block's inner XML (any namespace prefix). */
function allElements(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<${NS_PREFIX}${tag}\\b[^>]*>([\\s\\S]*?)</${NS_PREFIX}${tag}>`,
    'gi',
  );
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/**
 * Parse an eBay Platform Notification SOAP envelope. Returns null when the
 * body is not a SOAP envelope at all.
 */
export function parsePlatformNotification(
  xml: string,
): ParsedPlatformNotification | null {
  if (!xml || !new RegExp(`<${NS_PREFIX}Envelope\\b`, 'i').test(xml)) {
    return null;
  }
  const header = firstElement(xml, 'Header') ?? '';
  const body = firstElement(xml, 'Body') ?? '';
  const seller = firstElement(body, 'Seller');
  return {
    eventName: firstTagText(body, 'NotificationEventName'),
    // The response-level Timestamp is the first one in the body.
    timestamp: firstTagText(body, 'Timestamp'),
    signature: firstTagText(header, 'NotificationSignature'),
    recipientUserId: firstTagText(body, 'RecipientUserID'),
    sellerUserId: seller ? firstTagText(seller, 'UserID') : null,
    itemId: firstTagText(body, 'ItemID'),
  };
}

export interface NotificationKeys {
  devId: string;
  appId: string;
  certId: string;
}

/** Base64(MD5(Timestamp + DevId + AppId + CertId)) — eBay's NotificationSignature. */
export function computeNotificationSignature(
  timestamp: string,
  keys: NotificationKeys,
): string {
  return createHash('md5')
    .update(`${timestamp}${keys.devId}${keys.appId}${keys.certId}`, 'utf8')
    .digest('base64');
}

export type SignatureCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing' | 'mismatch' | 'bad_timestamp' | 'stale';
    };

/**
 * Check a notification's signature and freshness. A notification whose
 * Timestamp is more than maxAgeMs away from now (either direction, to allow
 * clock skew) is rejected even when the signature matches — that blocks
 * replays of a captured notification.
 */
export function verifyNotificationSignature(input: {
  signature: string | null | undefined;
  timestamp: string | null | undefined;
  keys: NotificationKeys;
  now?: Date;
  maxAgeMs?: number;
}): SignatureCheck {
  const { signature, timestamp, keys } = input;
  if (!signature || !timestamp) return { ok: false, reason: 'missing' };

  const sentAt = Date.parse(timestamp);
  if (Number.isNaN(sentAt)) return { ok: false, reason: 'bad_timestamp' };

  const expected = Buffer.from(
    computeNotificationSignature(timestamp, keys),
    'base64',
  );
  const provided = Buffer.from(signature.trim(), 'base64');
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, reason: 'mismatch' };
  }

  const now = (input.now ?? new Date()).getTime();
  const maxAgeMs = input.maxAgeMs ?? NOTIFICATION_MAX_AGE_MS;
  if (Math.abs(now - sentAt) > maxAgeMs) return { ok: false, reason: 'stale' };

  return { ok: true };
}

// ─── Trading API: SetNotificationPreferences / GetNotificationPreferences ───

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * SetNotificationPreferences body.
 *
 * - `applicationUrl` set → also writes ApplicationDeliveryPreferences. That
 *   block is application-wide on eBay: it moves the delivery URL for every
 *   user of this eBay app, not just this seller.
 * - The user-level block enables/disables the order events for the seller
 *   whose token signs the call.
 */
export function buildSetNotificationPreferencesRequest(input: {
  enable: boolean;
  applicationUrl?: string | null;
}): string {
  const eventEnable = input.enable ? 'Enable' : 'Disable';
  const application = input.applicationUrl
    ? `  <ApplicationDeliveryPreferences>
    <ApplicationEnable>Enable</ApplicationEnable>
    <ApplicationURL>${escapeXml(input.applicationUrl)}</ApplicationURL>
    <DeviceType>Platform</DeviceType>
  </ApplicationDeliveryPreferences>
`
    : '';
  const events = ORDER_NOTIFICATION_EVENTS.map(
    (event) => `    <NotificationEnable>
      <EventType>${event}</EventType>
      <EventEnable>${eventEnable}</EventEnable>
    </NotificationEnable>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${application}  <UserDeliveryPreferenceArray>
${events}
  </UserDeliveryPreferenceArray>
</SetNotificationPreferencesRequest>`;
}

export function buildGetNotificationPreferencesRequest(
  level: 'Application' | 'User',
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <PreferenceLevel>${level}</PreferenceLevel>
</GetNotificationPreferencesRequest>`;
}

export interface ApplicationNotificationPreferences {
  applicationUrl: string | null;
  applicationEnabled: boolean;
}

export function parseApplicationPreferences(
  xml: string,
): ApplicationNotificationPreferences {
  const block = firstElement(xml, 'ApplicationDeliveryPreferences') ?? '';
  return {
    applicationUrl: firstTagText(block, 'ApplicationURL'),
    applicationEnabled:
      (firstTagText(block, 'ApplicationEnable') ?? '').toLowerCase() ===
      'enable',
  };
}

/** EventType → enabled, for every event the user-level preferences list. */
export function parseUserEventPreferences(
  xml: string,
): Record<string, boolean> {
  const events: Record<string, boolean> = {};
  for (const block of allElements(xml, 'NotificationEnable')) {
    const type = firstTagText(block, 'EventType');
    if (!type) continue;
    events[type] =
      (firstTagText(block, 'EventEnable') ?? '').toLowerCase() === 'enable';
  }
  return events;
}

/**
 * GetUser without a UserID returns the user who owns the token — the seller's
 * eBay login. Notifications name the seller by that login (RecipientUserID).
 */
export function buildGetUserRequest(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <DetailLevel>ReturnSummary</DetailLevel>
</GetUserRequest>`;
}

/** The token owner's eBay login from a GetUser response, or null. */
export function parseGetUserLogin(xml: string): string | null {
  const user = firstElement(xml, 'User');
  return user ? firstTagText(user, 'UserID') : null;
}

/**
 * Trading error 12209 ("There is no valid preference found for your
 * request"): no notification preferences were ever set at that level.
 * Matches the "(12209)" code that tradingFailure puts in the message.
 */
export function isNoPreferencesError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return /\(12209\)/.test(message);
}

/** Error text when a Trading response has Ack=Failure, else null. */
export function tradingFailure(xml: string): string | null {
  const ack = firstTagText(xml, 'Ack');
  if (ack && ack.toLowerCase() !== 'failure') return null;
  if (!ack && !/<Errors\b/i.test(xml)) return 'Unexpected Trading API response';
  const code = firstTagText(xml, 'ErrorCode');
  const message =
    firstTagText(xml, 'LongMessage') ??
    firstTagText(xml, 'ShortMessage') ??
    'Trading API call failed';
  return code ? `(${code}) ${message}` : message;
}

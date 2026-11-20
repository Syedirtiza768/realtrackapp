"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_MAX_AGE_MS = exports.ORDER_NOTIFICATION_EVENTS = void 0;
exports.isOrderNotificationEvent = isOrderNotificationEvent;
exports.firstTagText = firstTagText;
exports.parsePlatformNotification = parsePlatformNotification;
exports.computeNotificationSignature = computeNotificationSignature;
exports.verifyNotificationSignature = verifyNotificationSignature;
exports.buildSetNotificationPreferencesRequest = buildSetNotificationPreferencesRequest;
exports.buildGetNotificationPreferencesRequest = buildGetNotificationPreferencesRequest;
exports.parseApplicationPreferences = parseApplicationPreferences;
exports.parseUserEventPreferences = parseUserEventPreferences;
exports.buildGetUserRequest = buildGetUserRequest;
exports.parseGetUserLogin = parseGetUserLogin;
exports.isNoPreferencesError = isNoPreferencesError;
exports.tradingFailure = tradingFailure;
const node_crypto_1 = require("node:crypto");
exports.ORDER_NOTIFICATION_EVENTS = [
    'FixedPriceTransaction',
    'AuctionCheckoutComplete',
    'ItemSold',
];
exports.NOTIFICATION_MAX_AGE_MS = 10 * 60_000;
function isOrderNotificationEvent(eventName) {
    return exports.ORDER_NOTIFICATION_EVENTS.includes(eventName ?? '');
}
const NS_PREFIX = '(?:[A-Za-z_][\\w.-]*:)?';
function decodeXmlText(value) {
    return value
        .replace(/^<!\[CDATA\[|\]\]>$/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}
function firstElement(xml, tag) {
    const m = xml.match(new RegExp(`<${NS_PREFIX}${tag}\\b[^>]*>([\\s\\S]*?)</${NS_PREFIX}${tag}>`, 'i'));
    return m ? m[1] : null;
}
function firstTagText(xml, tag) {
    const inner = firstElement(xml, tag);
    if (inner == null)
        return null;
    const text = decodeXmlText(inner.trim()).trim();
    return text || null;
}
function allElements(xml, tag) {
    const re = new RegExp(`<${NS_PREFIX}${tag}\\b[^>]*>([\\s\\S]*?)</${NS_PREFIX}${tag}>`, 'gi');
    return [...xml.matchAll(re)].map((m) => m[1]);
}
function parsePlatformNotification(xml) {
    if (!xml || !new RegExp(`<${NS_PREFIX}Envelope\\b`, 'i').test(xml)) {
        return null;
    }
    const header = firstElement(xml, 'Header') ?? '';
    const body = firstElement(xml, 'Body') ?? '';
    const seller = firstElement(body, 'Seller');
    return {
        eventName: firstTagText(body, 'NotificationEventName'),
        timestamp: firstTagText(body, 'Timestamp'),
        signature: firstTagText(header, 'NotificationSignature'),
        recipientUserId: firstTagText(body, 'RecipientUserID'),
        sellerUserId: seller ? firstTagText(seller, 'UserID') : null,
        itemId: firstTagText(body, 'ItemID'),
    };
}
function computeNotificationSignature(timestamp, keys) {
    return (0, node_crypto_1.createHash)('md5')
        .update(`${timestamp}${keys.devId}${keys.appId}${keys.certId}`, 'utf8')
        .digest('base64');
}
function verifyNotificationSignature(input) {
    const { signature, timestamp, keys } = input;
    if (!signature || !timestamp)
        return { ok: false, reason: 'missing' };
    const sentAt = Date.parse(timestamp);
    if (Number.isNaN(sentAt))
        return { ok: false, reason: 'bad_timestamp' };
    const expected = Buffer.from(computeNotificationSignature(timestamp, keys), 'base64');
    const provided = Buffer.from(signature.trim(), 'base64');
    if (provided.length !== expected.length ||
        !(0, node_crypto_1.timingSafeEqual)(provided, expected)) {
        return { ok: false, reason: 'mismatch' };
    }
    const now = (input.now ?? new Date()).getTime();
    const maxAgeMs = input.maxAgeMs ?? exports.NOTIFICATION_MAX_AGE_MS;
    if (Math.abs(now - sentAt) > maxAgeMs)
        return { ok: false, reason: 'stale' };
    return { ok: true };
}
function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
function buildSetNotificationPreferencesRequest(input) {
    const eventEnable = input.enable ? 'Enable' : 'Disable';
    const application = input.applicationUrl
        ? `  <ApplicationDeliveryPreferences>
    <ApplicationEnable>Enable</ApplicationEnable>
    <ApplicationURL>${escapeXml(input.applicationUrl)}</ApplicationURL>
    <DeviceType>Platform</DeviceType>
  </ApplicationDeliveryPreferences>
`
        : '';
    const events = exports.ORDER_NOTIFICATION_EVENTS.map((event) => `    <NotificationEnable>
      <EventType>${event}</EventType>
      <EventEnable>${eventEnable}</EventEnable>
    </NotificationEnable>`).join('\n');
    return `<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
${application}  <UserDeliveryPreferenceArray>
${events}
  </UserDeliveryPreferenceArray>
</SetNotificationPreferencesRequest>`;
}
function buildGetNotificationPreferencesRequest(level) {
    return `<?xml version="1.0" encoding="utf-8"?>
<GetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <PreferenceLevel>${level}</PreferenceLevel>
</GetNotificationPreferencesRequest>`;
}
function parseApplicationPreferences(xml) {
    const block = firstElement(xml, 'ApplicationDeliveryPreferences') ?? '';
    return {
        applicationUrl: firstTagText(block, 'ApplicationURL'),
        applicationEnabled: (firstTagText(block, 'ApplicationEnable') ?? '').toLowerCase() ===
            'enable',
    };
}
function parseUserEventPreferences(xml) {
    const events = {};
    for (const block of allElements(xml, 'NotificationEnable')) {
        const type = firstTagText(block, 'EventType');
        if (!type)
            continue;
        events[type] =
            (firstTagText(block, 'EventEnable') ?? '').toLowerCase() === 'enable';
    }
    return events;
}
function buildGetUserRequest() {
    return `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <DetailLevel>ReturnSummary</DetailLevel>
</GetUserRequest>`;
}
function parseGetUserLogin(xml) {
    const user = firstElement(xml, 'User');
    return user ? firstTagText(user, 'UserID') : null;
}
function isNoPreferencesError(err) {
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    return /\(12209\)/.test(message);
}
function tradingFailure(xml) {
    const ack = firstTagText(xml, 'Ack');
    if (ack && ack.toLowerCase() !== 'failure')
        return null;
    if (!ack && !/<Errors\b/i.test(xml))
        return 'Unexpected Trading API response';
    const code = firstTagText(xml, 'ErrorCode');
    const message = firstTagText(xml, 'LongMessage') ??
        firstTagText(xml, 'ShortMessage') ??
        'Trading API call failed';
    return code ? `(${code}) ${message}` : message;
}
//# sourceMappingURL=ebay-platform-notification.util.js.map
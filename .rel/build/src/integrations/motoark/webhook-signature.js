"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhook = verifyWebhook;
exports.payloadHash = payloadHash;
exports.cents = cents;
exports.money = money;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
function verifyWebhook(secret, body, timestamp, signature) {
    if (!secret?.trim())
        throw new common_1.ServiceUnavailableException('Webhook signing secret is not configured');
    if (!timestamp ||
        !/^\d{10}$/.test(timestamp) ||
        Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000) {
        throw new common_1.UnauthorizedException('Valid webhook timestamp within five minutes is required');
    }
    const hex = signature?.replace(/^sha256=/i, '').trim();
    if (!hex || !/^[a-f0-9]{64}$/i.test(hex))
        throw new common_1.UnauthorizedException('Invalid webhook signature');
    const expected = (0, node_crypto_1.createHmac)('sha256', secret.trim())
        .update(timestamp)
        .update('.')
        .update(body)
        .digest();
    if (!(0, node_crypto_1.timingSafeEqual)(expected, Buffer.from(hex, 'hex')))
        throw new common_1.UnauthorizedException('Invalid webhook signature');
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonical(v)]));
    return value;
}
function payloadHash(value) {
    return (0, node_crypto_1.createHash)('sha256')
        .update(JSON.stringify(canonical(value)))
        .digest('hex');
}
function cents(value) {
    if (!/^(0|[1-9]\d{0,7})\.\d{2}$/.test(value))
        throw new Error('Expected a decimal amount with two fractional digits');
    return BigInt(value.replace('.', ''));
}
function money(value) {
    return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
//# sourceMappingURL=webhook-signature.js.map
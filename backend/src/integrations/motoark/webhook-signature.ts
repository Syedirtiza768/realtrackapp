import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export function verifyWebhook(
  secret: string | undefined,
  body: Buffer,
  timestamp?: string,
  signature?: string,
) {
  if (!secret?.trim())
    throw new ServiceUnavailableException(
      'Webhook signing secret is not configured',
    );
  if (
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000
  ) {
    throw new UnauthorizedException(
      'Valid webhook timestamp within five minutes is required',
    );
  }
  const hex = signature?.replace(/^sha256=/i, '').trim();
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex))
    throw new UnauthorizedException('Invalid webhook signature');
  const expected = createHmac('sha256', secret.trim())
    .update(timestamp)
    .update('.')
    .update(body)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(hex, 'hex')))
    throw new UnauthorizedException('Invalid webhook signature');
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function payloadHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export function cents(value: string): bigint {
  if (!/^(0|[1-9]\d{0,7})\.\d{2}$/.test(value))
    throw new Error('Expected a decimal amount with two fractional digits');
  return BigInt(value.replace('.', ''));
}
export function money(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

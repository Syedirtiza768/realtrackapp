import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate-limit by authenticated user id when available; fall back to client IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request & { user?: { id?: string } };
    const userId = request.user?.id;
    if (userId) {
      return Promise.resolve(`user:${userId}`);
    }
    const ip =
      (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown';
    return Promise.resolve(ip);
  }
}

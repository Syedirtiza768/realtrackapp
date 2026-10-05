import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { APP_REDIS } from '../common/redis/app-redis.constants.js';

type SessionPayload = { jti?: string; exp?: number };

@Injectable()
export class AuthSessionService {
  constructor(
    @Inject(APP_REDIS) private readonly redis: Redis,
    private readonly jwt: JwtService,
  ) {}

  async revokeBearerToken(authorization?: string): Promise<void> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return;
    const payload = this.jwt.decode<SessionPayload>(token);
    if (!payload?.jti) return;
    const ttlSeconds = Math.max(
      1,
      (payload.exp ?? Math.floor(Date.now() / 1000) + 14_400) -
        Math.floor(Date.now() / 1000),
    );
    await this.redis.set(`auth:revoked:${payload.jti}`, '1', 'EX', ttlSeconds);
  }

  async assertNotRevoked(jti?: string): Promise<void> {
    if (!jti) return; // Tokens issued before session IDs were introduced expire normally.
    if (await this.redis.exists(`auth:revoked:${jti}`)) {
      throw new UnauthorizedException('Session has been signed out');
    }
  }
}

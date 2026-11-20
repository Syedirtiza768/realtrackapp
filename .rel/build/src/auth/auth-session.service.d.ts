import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
export declare class AuthSessionService {
    private readonly redis;
    private readonly jwt;
    constructor(redis: Redis, jwt: JwtService);
    revokeBearerToken(authorization?: string): Promise<void>;
    assertNotRevoked(jti?: string): Promise<void>;
}

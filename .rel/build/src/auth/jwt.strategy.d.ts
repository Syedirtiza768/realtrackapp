import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthSessionService } from './auth-session.service.js';
interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    jti?: string;
}
export declare const fromAuthHeaderOrQueryParam: (req: Request) => string | null;
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly userRepo;
    private readonly sessions;
    constructor(config: ConfigService, userRepo: Repository<User>, sessions: AuthSessionService);
    validate(payload: JwtPayload): Promise<User>;
}
export {};

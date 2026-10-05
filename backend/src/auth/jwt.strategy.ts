import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
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

/**
 * Custom extractor: checks Authorization Bearer header first,
 * then accepts ?token= only on the EventSource progress endpoint.
 */
export const fromAuthHeaderOrQueryParam = (req: Request): string | null => {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;
  const path = req.originalUrl.split('?')[0] ?? '';
  const isMotorsProgressStream =
    req.method === 'GET' &&
    /\/motors-intelligence\/products\/[^/]+\/progress\/?$/.test(path);
  if (!isMotorsProgressStream) return null;
  return (req.query as Record<string, string>).token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly sessions: AuthSessionService,
  ) {
    const secret = config.get<string>(
      'JWT_SECRET',
      'dev-secret-change-in-production',
    );
    super({
      jwtFromRequest: fromAuthHeaderOrQueryParam,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    await this.sessions.assertNotRevoked(payload.jti);
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, active: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
  }
}

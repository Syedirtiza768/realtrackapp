import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Custom extractor: checks Authorization Bearer header first,
 * then falls back to ?token= query parameter (for EventSource SSE).
 */
const fromAuthHeaderOrQueryParam = (req: Request): string | null => {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;
  return (req.query as Record<string, string>).token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    const secret = config.get<string>('JWT_SECRET', 'dev-secret-change-in-production');
    console.log('[DEBUG] JWT Strategy - Secret:', secret.substring(0, 10) + '...');
    super({
      jwtFromRequest: fromAuthHeaderOrQueryParam,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, active: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return user;
  }
}

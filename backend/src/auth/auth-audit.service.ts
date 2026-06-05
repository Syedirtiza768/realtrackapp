import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditLog } from '../dashboard/entities/audit-log.entity.js';

@Injectable()
export class AuthAuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(
    action: string,
    opts: {
      actorId?: string | null;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
      req?: Request;
    },
  ): Promise<void> {
    const ip =
      (opts.req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      opts.req?.ip ??
      null;
    const userAgent = (opts.req?.headers['user-agent'] as string) ?? null;

    await this.auditRepo.save(
      this.auditRepo.create({
        action,
        entityType: opts.entityType ?? 'auth',
        entityId: opts.entityId ?? opts.actorId ?? '00000000-0000-0000-0000-000000000000',
        actorId: opts.actorId ?? null,
        actorType: opts.actorId ? 'user' : 'system',
        metadata: {
          ...(opts.metadata ?? {}),
          ...(userAgent ? { userAgent } : {}),
        },
        ipAddress: ip,
      }),
    );
  }
}

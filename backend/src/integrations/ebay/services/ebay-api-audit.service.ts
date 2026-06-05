import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EbayApiAuditLog } from '../entities/ebay-api-audit-log.entity.js';

export interface EbayApiAuditInput {
  organizationId: string;
  ebayAccountId?: string | null;
  userId?: string | null;
  httpMethod: string;
  apiFamily: string;
  endpointPath: string;
  marketplaceId?: string | null;
  responseStatus?: number | null;
  ebayErrorId?: string | null;
  ebayErrorMessage?: string | null;
  correlationId?: string | null;
  durationMs?: number | null;
  requestMetadata?: Record<string, unknown>;
}

@Injectable()
export class EbayApiAuditService {
  constructor(
    @InjectRepository(EbayApiAuditLog)
    private readonly repo: Repository<EbayApiAuditLog>,
  ) {}

  /**
   * Persist a sanitized API audit row. Never pass tokens or secrets in metadata.
   */
  async record(input: EbayApiAuditInput): Promise<void> {
    const meta = { ...(input.requestMetadata ?? {}) };
    for (const key of Object.keys(meta)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('authorization') ||
        lower.includes('password')
      ) {
        delete meta[key];
      }
    }

    await this.repo.save(
      this.repo.create({
        organizationId: input.organizationId,
        ebayAccountId: input.ebayAccountId ?? null,
        userId: input.userId ?? null,
        httpMethod: input.httpMethod,
        apiFamily: input.apiFamily,
        endpointPath: input.endpointPath.slice(0, 500),
        marketplaceId: input.marketplaceId ?? null,
        responseStatus: input.responseStatus ?? null,
        ebayErrorId: input.ebayErrorId ?? null,
        ebayErrorMessage: input.ebayErrorMessage?.slice(0, 2000) ?? null,
        correlationId: input.correlationId ?? null,
        durationMs: input.durationMs ?? null,
        requestMetadata: meta,
      }),
    );
  }

  async listForAccount(
    ebayAccountId: string,
    organizationId: string,
    limit = 50,
  ): Promise<EbayApiAuditLog[]> {
    return this.repo.find({
      where: { ebayAccountId, organizationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

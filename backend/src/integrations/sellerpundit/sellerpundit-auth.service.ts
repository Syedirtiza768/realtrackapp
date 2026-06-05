import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEncryptionService } from '../../channels/token-encryption.service.js';
import { OrganizationSellerpunditConfig } from './entities/organization-sellerpundit-config.entity.js';
import { SellerpunditHttpClient } from './sellerpundit-http.client.js';

interface SpCredentials {
  email: string;
  password: string;
}

@Injectable()
export class SellerpunditAuthService {
  private readonly logger = new Logger(SellerpunditAuthService.name);
  private readonly jwtByOrg = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly http: SellerpunditHttpClient,
    private readonly encryption: TokenEncryptionService,
    @InjectRepository(OrganizationSellerpunditConfig)
    private readonly configRepo: Repository<OrganizationSellerpunditConfig>,
  ) {}

  async getJwt(organizationId: string): Promise<string> {
    const cached = this.jwtByOrg.get(organizationId);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }

    const creds = await this.resolveCredentials(organizationId);
    const token = await this.http.login(creds.email, creds.password);
    const expiresAt = this.decodeJwtExpiry(token) ?? Date.now() + 23 * 60 * 60 * 1000;
    this.jwtByOrg.set(organizationId, { token, expiresAt });

    await this.upsertConfig(organizationId, { lastJwtRefreshAt: new Date(), lastError: null });
    return token;
  }

  invalidateJwt(organizationId: string): void {
    this.jwtByOrg.delete(organizationId);
  }

  private async resolveCredentials(organizationId: string): Promise<SpCredentials> {
    const row = await this.configRepo.findOne({ where: { organizationId } });
    if (row?.credentialsEncrypted) {
      try {
        const parsed = JSON.parse(
          this.encryption.decrypt(row.credentialsEncrypted),
        ) as SpCredentials;
        if (parsed.email && parsed.password) return parsed;
      } catch (e) {
        this.logger.warn(`Org ${organizationId} SellerPundit credentials decrypt failed`, e);
      }
    }

    const email = this.config.get<string>('SELLERPUNDIT_EMAIL', '').trim();
    const password = this.config.get<string>('SELLERPUNDIT_PASSWORD', '').trim();
    if (!email || !password) {
      throw new BadRequestException(
        'SellerPundit credentials not configured. Set SELLERPUNDIT_EMAIL and SELLERPUNDIT_PASSWORD in the project root .env (for Docker) or save org credentials in Settings.',
      );
    }
    return { email, password };
  }

  async upsertConfig(
    organizationId: string,
    patch: Partial<{
      enabled: boolean;
      credentialsEncrypted: string | null;
      lastJwtRefreshAt: Date | null;
      lastSyncAt: Date | null;
      lastError: string | null;
    }>,
  ): Promise<OrganizationSellerpunditConfig> {
    let row = await this.configRepo.findOne({ where: { organizationId } });
    if (!row) {
      row = this.configRepo.create({ organizationId, enabled: true });
    }
    Object.assign(row, patch);
    return this.configRepo.save(row);
  }

  async getConfigView(organizationId: string) {
    const row = await this.configRepo.findOne({ where: { organizationId } });
    const envConfigured =
      !!this.config.get<string>('SELLERPUNDIT_EMAIL', '').trim() &&
      !!this.config.get<string>('SELLERPUNDIT_PASSWORD', '').trim();
    return {
      enabled: row?.enabled ?? true,
      configured: envConfigured || !!row?.credentialsEncrypted,
      hasOrgCredentials: !!row?.credentialsEncrypted,
      lastJwtRefreshAt: row?.lastJwtRefreshAt ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
    };
  }

  async saveOrgCredentials(
    organizationId: string,
    email: string,
    password: string,
  ): Promise<void> {
    const credentialsEncrypted = this.encryption.encrypt(
      JSON.stringify({ email, password }),
    );
    await this.upsertConfig(organizationId, { credentialsEncrypted, enabled: true });
    this.invalidateJwt(organizationId);
  }

  private decodeJwtExpiry(token: string): number | null {
    try {
      const part = token.split('.')[1];
      if (!part) return null;
      const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as {
        exp?: number;
      };
      if (payload.exp) return payload.exp * 1000;
    } catch {
      /* ignore */
    }
    return null;
  }
}

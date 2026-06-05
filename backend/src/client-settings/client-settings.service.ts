import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClientSettings } from './entities/client-settings.entity.js';
import { UpdateClientSettingsDto } from './dto/client-settings.dto.js';

const DEFAULTS: Partial<ClientSettings> = {
  appName: 'RealTrackApp',
  clientName: 'RealTrack',
  shortName: 'RT',
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  accentColor: '#0ea5e9',
  themeMode: 'dark',
  sidebarTheme: 'slate',
  navbarTheme: 'slate',
  footerText: '© RealTrack',
  whiteLabelEnabled: true,
  poweredByVisible: false,
};

@Injectable()
export class ClientSettingsService {
  constructor(
    @InjectRepository(ClientSettings)
    private readonly repo: Repository<ClientSettings>,
  ) {}

  async getEffective(organizationId?: string | null): Promise<ClientSettings> {
    let row = await this.repo.findOne({
      where: organizationId
        ? { organizationId }
        : { organizationId: IsNull() },
    });
    if (!row && organizationId) {
      row = await this.repo.findOne({ where: { organizationId: IsNull() } });
    }
    if (!row) {
      row = await this.seedDefaults(organizationId ?? null);
    }
    return row;
  }

  async update(
    dto: UpdateClientSettingsDto,
    userId: string,
    organizationId?: string | null,
  ): Promise<ClientSettings> {
    const row = await this.getEffective(organizationId);
    Object.assign(row, dto, { updatedBy: userId });
    return this.repo.save(row);
  }

  /** Idempotent seed — does not overwrite customized rows. */
  async seedDefaults(organizationId: string | null = null): Promise<ClientSettings> {
    const existing = await this.repo.findOne({
      where: organizationId
        ? { organizationId }
        : { organizationId: IsNull() },
    });
    if (existing) return existing;

    return this.repo.save(
      this.repo.create({
        organizationId,
        ...DEFAULTS,
      } as ClientSettings),
    );
  }

  async getPublicBranding(): Promise<Pick<
    ClientSettings,
    | 'appName'
    | 'clientName'
    | 'shortName'
    | 'logoUrl'
    | 'faviconUrl'
    | 'loginLogoUrl'
    | 'primaryColor'
    | 'secondaryColor'
    | 'accentColor'
    | 'themeMode'
    | 'footerText'
    | 'poweredByVisible'
  >> {
    const row = await this.getEffective(null);
    return {
      appName: row.appName,
      clientName: row.clientName,
      shortName: row.shortName,
      logoUrl: row.logoUrl,
      faviconUrl: row.faviconUrl,
      loginLogoUrl: row.loginLogoUrl,
      primaryColor: row.primaryColor,
      secondaryColor: row.secondaryColor,
      accentColor: row.accentColor,
      themeMode: row.themeMode,
      footerText: row.footerText,
      poweredByVisible: row.poweredByVisible,
    };
  }
}

import { Repository } from 'typeorm';
import { ClientSettings } from './entities/client-settings.entity.js';
import { UpdateClientSettingsDto } from './dto/client-settings.dto.js';
export declare class ClientSettingsService {
    private readonly repo;
    constructor(repo: Repository<ClientSettings>);
    getEffective(organizationId?: string | null): Promise<ClientSettings>;
    update(dto: UpdateClientSettingsDto, userId: string, organizationId?: string | null): Promise<ClientSettings>;
    seedDefaults(organizationId?: string | null): Promise<ClientSettings>;
    getPublicBranding(): Promise<Pick<ClientSettings, 'appName' | 'clientName' | 'shortName' | 'logoUrl' | 'faviconUrl' | 'loginLogoUrl' | 'primaryColor' | 'secondaryColor' | 'accentColor' | 'themeMode' | 'footerText' | 'poweredByVisible'>>;
}

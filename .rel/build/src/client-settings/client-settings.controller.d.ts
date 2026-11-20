import { User } from '../auth/entities/user.entity.js';
import { ClientSettingsService } from './client-settings.service.js';
import { UpdateClientSettingsDto } from './dto/client-settings.dto.js';
export declare class ClientSettingsController {
    private readonly clientSettings;
    constructor(clientSettings: ClientSettingsService);
    getPublicBranding(): Promise<Pick<import("./entities/client-settings.entity.js").ClientSettings, "secondaryColor" | "appName" | "clientName" | "shortName" | "logoUrl" | "faviconUrl" | "loginLogoUrl" | "primaryColor" | "accentColor" | "themeMode" | "footerText" | "poweredByVisible">>;
    getSettings(): Promise<import("./entities/client-settings.entity.js").ClientSettings>;
    updateSettings(user: User, dto: UpdateClientSettingsDto): Promise<import("./entities/client-settings.entity.js").ClientSettings>;
}

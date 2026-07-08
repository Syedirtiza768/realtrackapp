import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { ClientSettingsService } from './client-settings.service.js';
import { UpdateClientSettingsDto } from './dto/client-settings.dto.js';

@ApiTags('client-settings')
@Controller('client-settings')
export class ClientSettingsController {
  constructor(private readonly clientSettings: ClientSettingsService) {}

  /** Public branding for login page (no secrets). */
  @Public()
  @Get('branding')
  @ApiOperation({ summary: 'Public branding/theme for login and shell' })
  getPublicBranding() {
    return this.clientSettings.getPublicBranding();
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('client_settings.view')
  @ApiOperation({ summary: 'View client settings (Super Admin)' })
  getSettings() {
    return this.clientSettings.getEffective(null);
  }

  @Patch()
  @ApiBearerAuth()
  @RequirePermissions('client_settings.manage')
  @ApiOperation({ summary: 'Update client settings (Super Admin)' })
  updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateClientSettingsDto,
  ) {
    return this.clientSettings.update(dto, user.id, null);
  }
}

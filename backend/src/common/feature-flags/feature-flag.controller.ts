import { Controller, Get, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeatureFlagService } from './feature-flag.service.js';
import { RequirePermissions } from '../../rbac/decorators/require-permissions.decorator.js';

@ApiTags('feature-flags')
@Controller('api/feature-flags')
@RequirePermissions('feature_flags.view')
export class FeatureFlagController {
  constructor(private readonly flagService: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  async list() {
    return this.flagService.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single feature flag by key' })
  async get(@Param('key') key: string) {
    return this.flagService.getByKey(key);
  }

  @Patch(':key')
  @RequirePermissions('feature_flags.manage')
  @ApiOperation({ summary: 'Update a feature flag' })
  async update(@Param('key') key: string, @Body() body: { enabled: boolean }) {
    return this.flagService.setEnabled(key, body.enabled);
  }

  @Patch(':key/toggle')
  @RequirePermissions('feature_flags.manage')
  @ApiOperation({ summary: 'Toggle a feature flag' })
  async toggle(@Param('key') key: string) {
    return this.flagService.toggle(key);
  }
}

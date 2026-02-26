import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service.js';
import {
  UpdateSettingDto,
  CreateShippingProfileDto,
  UpdateShippingProfileDto,
  CreatePricingRuleDto,
  UpdatePricingRuleDto,
} from './dto/settings.dto.js';

@ApiTags('Settings')
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /* ─── Tenant Settings ─── */

  @Get()
  @ApiOperation({ summary: 'Get all settings grouped by category' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Get(':category')
  @ApiOperation({ summary: 'Get settings for a category' })
  getByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  @Put(':category/:key')
  @ApiOperation({ summary: 'Update a setting value' })
  update(
    @Param('category') category: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.updateSetting(category, key, dto.value);
  }

  /* ─── Shipping Profiles ─── */

  @Get('shipping-profiles/list')
  @ApiOperation({ summary: 'List shipping profiles' })
  getShippingProfiles() {
    return this.settingsService.getShippingProfiles();
  }

  @Post('shipping-profiles')
  @ApiOperation({ summary: 'Create shipping profile' })
  createShippingProfile(@Body() dto: CreateShippingProfileDto) {
    return this.settingsService.createShippingProfile(dto);
  }

  @Put('shipping-profiles/:id')
  @ApiOperation({ summary: 'Update shipping profile' })
  updateShippingProfile(
    @Param('id') id: string,
    @Body() dto: UpdateShippingProfileDto,
  ) {
    return this.settingsService.updateShippingProfile(id, dto);
  }

  @Delete('shipping-profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shipping profile' })
  deleteShippingProfile(@Param('id') id: string) {
    return this.settingsService.deleteShippingProfile(id);
  }

  /* ─── Pricing Rules ─── */

  @Get('pricing-rules/list')
  @ApiOperation({ summary: 'List pricing rules' })
  getPricingRules() {
    return this.settingsService.getPricingRules();
  }

  @Post('pricing-rules')
  @ApiOperation({ summary: 'Create pricing rule' })
  createPricingRule(@Body() dto: CreatePricingRuleDto) {
    return this.settingsService.createPricingRule(dto);
  }

  @Put('pricing-rules/:id')
  @ApiOperation({ summary: 'Update pricing rule' })
  updatePricingRule(@Param('id') id: string, @Body() dto: UpdatePricingRuleDto) {
    return this.settingsService.updatePricingRule(id, dto);
  }

  @Delete('pricing-rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete pricing rule' })
  deletePricingRule(@Param('id') id: string) {
    return this.settingsService.deletePricingRule(id);
  }
}

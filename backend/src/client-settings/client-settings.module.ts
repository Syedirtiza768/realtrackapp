import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientSettingsController } from './client-settings.controller.js';
import { ClientSettingsService } from './client-settings.service.js';
import { ClientSettings } from './entities/client-settings.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ClientSettings])],
  controllers: [ClientSettingsController],
  providers: [ClientSettingsService],
  exports: [ClientSettingsService, TypeOrmModule],
})
export class ClientSettingsModule {}

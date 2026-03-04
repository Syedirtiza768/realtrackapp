import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRule } from './entities/automation-rule.entity.js';
import { AutomationService } from './automation.service.js';
import { AutomationController } from './automation.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([AutomationRule])],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}

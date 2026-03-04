import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingTemplate } from './entities/listing-template.entity.js';
import { TemplateService } from './template.service.js';
import { TemplateController } from './template.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ListingTemplate])],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

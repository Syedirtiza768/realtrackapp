import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationGateway } from './notification.gateway.js';
import { NotificationTriggers } from './notification-triggers.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationGateway, NotificationTriggers],
  exports: [NotificationsService],
})
export class NotificationsModule {}

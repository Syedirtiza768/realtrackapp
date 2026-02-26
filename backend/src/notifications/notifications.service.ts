import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from './entities/notification.entity.js';
import type { NotificationsQueryDto } from './dto/notifications-query.dto.js';

export interface CreateNotificationPayload {
  recipientId?: string;
  type: string;
  title: string;
  body?: string;
  icon?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /* ─── Create notification ─── */

  async create(payload: CreateNotificationPayload): Promise<Notification> {
    const notif = this.notifRepo.create({
      recipientId: payload.recipientId ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      icon: payload.icon ?? null,
      severity: payload.severity ?? 'info',
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      actionUrl: payload.actionUrl ?? null,
    });

    const saved = await this.notifRepo.save(notif);

    // Emit event for WebSocket gateway to pick up
    this.eventEmitter.emit('notification.created', saved);

    return saved;
  }

  /* ─── List notifications ─── */

  async findAll(dto: NotificationsQueryDto) {
    const qb = this.notifRepo.createQueryBuilder('n');

    if (dto.recipientId) {
      qb.andWhere('(n.recipientId = :rid OR n.recipientId IS NULL)', {
        rid: dto.recipientId,
      });
    }
    if (dto.type) qb.andWhere('n.type = :type', { type: dto.type });
    if (dto.severity) qb.andWhere('n.severity = :sev', { sev: dto.severity });

    qb.andWhere('n.dismissed = false');

    const limit = dto.limit ?? 50;
    const offset = dto.offset ?? 0;

    const [items, total] = await qb
      .orderBy('n.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { items, total, limit, offset };
  }

  /* ─── Unread count ─── */

  async getUnreadCount(recipientId?: string): Promise<number> {
    const qb = this.notifRepo
      .createQueryBuilder('n')
      .where('n.read = false')
      .andWhere('n.dismissed = false');

    if (recipientId) {
      qb.andWhere('(n.recipientId = :rid OR n.recipientId IS NULL)', {
        rid: recipientId,
      });
    }

    return qb.getCount();
  }

  /* ─── Mark as read ─── */

  async markAsRead(id: string): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');

    notif.read = true;
    notif.readAt = new Date();
    return this.notifRepo.save(notif);
  }

  /* ─── Mark all as read ─── */

  async markAllAsRead(recipientId?: string): Promise<number> {
    const qb = this.notifRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ read: true, readAt: new Date() })
      .where('read = false');

    if (recipientId) {
      qb.andWhere('(recipientId = :rid OR recipientId IS NULL)', {
        rid: recipientId,
      });
    }

    const result = await qb.execute();
    return result.affected ?? 0;
  }

  /* ─── Dismiss ─── */

  async dismiss(id: string): Promise<void> {
    const result = await this.notifRepo.update(id, { dismissed: true });
    if (result.affected === 0) throw new NotFoundException('Notification not found');
  }

  /* ─── Cleanup old notifications ─── */

  async cleanupOld(daysToKeep = 90): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await this.notifRepo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('createdAt < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}

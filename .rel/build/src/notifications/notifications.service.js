"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const notification_entity_js_1 = require("./entities/notification.entity.js");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    notifRepo;
    eventEmitter;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(notifRepo, eventEmitter) {
        this.notifRepo = notifRepo;
        this.eventEmitter = eventEmitter;
    }
    async create(payload) {
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
        this.eventEmitter.emit('notification.created', saved);
        return saved;
    }
    async findAll(dto) {
        const qb = this.notifRepo.createQueryBuilder('n');
        if (dto.recipientId) {
            qb.andWhere('(n.recipientId = :rid OR n.recipientId IS NULL)', {
                rid: dto.recipientId,
            });
        }
        if (dto.type)
            qb.andWhere('n.type = :type', { type: dto.type });
        if (dto.severity)
            qb.andWhere('n.severity = :sev', { sev: dto.severity });
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
    async getUnreadCount(recipientId) {
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
    async markAsRead(id) {
        const notif = await this.notifRepo.findOne({ where: { id } });
        if (!notif)
            throw new common_1.NotFoundException('Notification not found');
        notif.read = true;
        notif.readAt = new Date();
        return this.notifRepo.save(notif);
    }
    async markAllAsRead(recipientId) {
        const qb = this.notifRepo
            .createQueryBuilder()
            .update(notification_entity_js_1.Notification)
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
    async dismiss(id) {
        const result = await this.notifRepo.update(id, { dismissed: true });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Notification not found');
    }
    async cleanupOld(daysToKeep = 90) {
        const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const result = await this.notifRepo
            .createQueryBuilder()
            .delete()
            .from(notification_entity_js_1.Notification)
            .where('createdAt < :cutoff', { cutoff })
            .execute();
        return result.affected ?? 0;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_js_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map
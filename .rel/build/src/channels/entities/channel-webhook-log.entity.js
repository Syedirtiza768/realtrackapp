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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelWebhookLog = void 0;
const typeorm_1 = require("typeorm");
let ChannelWebhookLog = class ChannelWebhookLog {
    id;
    channel;
    eventType;
    externalId;
    payload;
    processingStatus;
    processingError;
    processedAt;
    createdAt;
};
exports.ChannelWebhookLog = ChannelWebhookLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChannelWebhookLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ChannelWebhookLog.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ChannelWebhookLog.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_id', type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], ChannelWebhookLog.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ChannelWebhookLog.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'processing_status',
        type: 'varchar',
        length: 20,
        default: 'received',
    }),
    __metadata("design:type", String)
], ChannelWebhookLog.prototype, "processingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processing_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ChannelWebhookLog.prototype, "processingError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ChannelWebhookLog.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelWebhookLog.prototype, "createdAt", void 0);
exports.ChannelWebhookLog = ChannelWebhookLog = __decorate([
    (0, typeorm_1.Entity)('channel_webhook_logs'),
    (0, typeorm_1.Index)('idx_webhook_log_channel', ['channel'])
], ChannelWebhookLog);
//# sourceMappingURL=channel-webhook-log.entity.js.map
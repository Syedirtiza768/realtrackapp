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
exports.ChannelConnection = void 0;
const typeorm_1 = require("typeorm");
let ChannelConnection = class ChannelConnection {
    id;
    channel;
    userId;
    organizationId;
    accountName;
    externalAccountId;
    encryptedTokens;
    tokenExpiresAt;
    scope;
    status;
    lastSyncAt;
    lastError;
    createdAt;
    updatedAt;
};
exports.ChannelConnection = ChannelConnection;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChannelConnection.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ChannelConnection.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChannelConnection.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'account_name',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "accountName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'external_account_id',
        type: 'varchar',
        length: 200,
        nullable: true,
    }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "externalAccountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encrypted_tokens', type: 'text' }),
    __metadata("design:type", String)
], ChannelConnection.prototype, "encryptedTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "tokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'active',
    }),
    __metadata("design:type", String)
], ChannelConnection.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_sync_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ChannelConnection.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelConnection.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ChannelConnection.prototype, "updatedAt", void 0);
exports.ChannelConnection = ChannelConnection = __decorate([
    (0, typeorm_1.Entity)('channel_connections'),
    (0, typeorm_1.Index)('idx_channel_conn_user', ['userId'])
], ChannelConnection);
//# sourceMappingURL=channel-connection.entity.js.map
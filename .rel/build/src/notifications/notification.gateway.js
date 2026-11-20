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
var NotificationGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const event_emitter_1 = require("@nestjs/event-emitter");
const socket_io_1 = require("socket.io");
let NotificationGateway = NotificationGateway_1 = class NotificationGateway {
    jwt;
    logger = new common_1.Logger(NotificationGateway_1.name);
    server;
    constructor(jwt) {
        this.jwt = jwt;
    }
    handleConnection(client) {
        const token = client.handshake.auth?.token;
        if (!token) {
            this.logger.warn(`Rejected WS connection ${client.id}: missing token`);
            client.disconnect(true);
            return;
        }
        let userId;
        try {
            const payload = this.jwt.verify(token);
            if (!payload?.sub) {
                throw new Error('missing sub');
            }
            userId = payload.sub;
        }
        catch {
            this.logger.warn(`Rejected WS connection ${client.id}: invalid token`);
            client.disconnect(true);
            return;
        }
        void client.join(`user:${userId}`);
        client.data.userId = userId;
        this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleNotificationCreated(notification) {
        if (notification.recipientId) {
            this.server
                .to(`user:${notification.recipientId}`)
                .emit('notification', notification);
        }
        else {
            this.server.emit('notification', notification);
        }
    }
};
exports.NotificationGateway = NotificationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationGateway.prototype, "server", void 0);
__decorate([
    (0, event_emitter_1.OnEvent)('notification.created'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Function]),
    __metadata("design:returntype", void 0)
], NotificationGateway.prototype, "handleNotificationCreated", null);
exports.NotificationGateway = NotificationGateway = NotificationGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: [
                'http://localhost:3191',
                'http://localhost:5173',
                'https://app.omnicoreholding.com',
            ],
        },
        namespace: '/notifications',
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], NotificationGateway);
//# sourceMappingURL=notification.gateway.js.map
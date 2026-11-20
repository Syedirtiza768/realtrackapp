import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { Notification } from './entities/notification.entity.js';
export declare class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwt;
    private readonly logger;
    server: Server;
    constructor(jwt: JwtService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleNotificationCreated(notification: Notification): void;
}

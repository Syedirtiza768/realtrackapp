import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import type { Notification } from './entities/notification.entity.js';

interface WsJwtPayload {
  sub: string;
  email?: string;
  role?: string;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3191',
      'http://localhost:5173',
      'https://mhn.realtrackapp.com',
    ],
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Rejected WS connection ${client.id}: missing token`);
      client.disconnect(true);
      return;
    }

    let userId: string;
    try {
      const payload = this.jwt.verify<WsJwtPayload>(token);
      if (!payload?.sub) {
        throw new Error('missing sub');
      }
      userId = payload.sub;
    } catch {
      this.logger.warn(`Rejected WS connection ${client.id}: invalid token`);
      client.disconnect(true);
      return;
    }

    void client.join(`user:${userId}`);
    client.data.userId = userId;
    this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /* ─── Listen for notification.created events from EventEmitter2 ─── */

  @OnEvent('notification.created')
  handleNotificationCreated(notification: Notification) {
    if (notification.recipientId) {
      // Send to specific user room
      this.server
        .to(`user:${notification.recipientId}`)
        .emit('notification', notification);
    } else {
      // Broadcast to all connected clients
      this.server.emit('notification', notification);
    }
  }
}

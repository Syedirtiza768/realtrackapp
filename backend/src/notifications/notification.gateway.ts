import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import type { Notification } from './entities/notification.entity.js';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3191', 'http://localhost:5173', 'https://mhn.realtrackapp.com'],
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId as string | undefined;
    if (userId) {
      void client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    } else {
      this.logger.log(`Client connected: ${client.id} (anonymous)`);
    }
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

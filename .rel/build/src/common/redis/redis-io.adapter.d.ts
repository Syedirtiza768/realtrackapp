import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';
export declare class RedisIoAdapter extends IoAdapter {
    private readonly pubClient;
    private readonly subClient;
    private readonly logger;
    private adapterConstructor;
    constructor(app: INestApplication, pubClient: Redis, subClient: Redis);
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): any;
}

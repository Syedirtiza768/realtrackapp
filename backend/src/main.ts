import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { AppModule } from './app.module';
import { APP_REDIS } from './common/redis/app-redis.constants.js';
import { RedisIoAdapter } from './common/redis/redis-io.adapter.js';
import type Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // preserve raw body for webhook HMAC verification
  });

  if (process.env.REDIS_SOCKET_ADAPTER === 'true') {
    const pubClient = app.get<Redis>(APP_REDIS);
    const subClient = pubClient.duplicate();
    const redisAdapter = new RedisIoAdapter(app, pubClient, subClient);
    await redisAdapter.connectToRedis();
    app.useWebSocketAdapter(redisAdapter);
  }

  // Gzip/deflate compression — cuts JSON payload size ~70-80%
  app.use(compression({ level: 6, threshold: 1024 }));

  // CORS — trim entries so "origin1, origin2" and Docker defaults match browser Origin exactly
  const defaultCorsOrigins = [
    'http://localhost:3911', // npm run dev (vite)
    'http://localhost:8050', // docker compose frontend (FRONTEND_PORT)
    'https://mhn.realtrackapp.com',
    'http://mhn.realtrackapp.com',
  ];
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultCorsOrigins;
  app.enableCors({ origin: corsOrigins });

  app.setGlobalPrefix('api');

  // Global validation pipe (D3 fix)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger API docs (D13 fix) — enabled in non-production
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RealTrackApp API')
      .setDescription('Multi-channel motor parts platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 4191);
}
bootstrap();

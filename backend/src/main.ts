import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // preserve raw body for webhook HMAC verification
  });

  // Gzip/deflate compression — cuts JSON payload size ~70-80%
  app.use(compression({ level: 6, threshold: 1024 }));

  // CORS — environment-driven (D5 fix)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3191', 'https://mhn.realtrackapp.com'];
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

import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Gzip/deflate compression — cuts JSON payload size ~70-80%
  app.use(compression({ level: 6, threshold: 1024 }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3191', 'https://mhn.realtrackapp.com'],
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 4191);
}
bootstrap();

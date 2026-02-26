import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:4191', 'https://mhn.realtrackapp.com'],
  });
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3191);
}
bootstrap();

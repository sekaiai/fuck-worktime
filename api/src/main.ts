import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:10001';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  app.enableCors({
    origin: isDevelopment ? ['http://localhost:10001', corsOrigin] : corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 10002);
  console.log('port', port)
  await app.listen(port);
}

bootstrap();

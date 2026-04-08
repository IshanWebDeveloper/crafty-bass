import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { ConsoleLogger } from '@nestjs/common';
import { writeFileSync } from 'node:fs';
import helmet from 'helmet';
import compression from 'compression';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { cleanupOpenApiDoc } from 'nestjs-zod';

function formatError(err: unknown): string {
  if (err instanceof Error && typeof err.stack === 'string') {
    return err.stack;
  }

  return String(err);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: new ConsoleLogger({
      prefix: 'backend',
      ['logLevels']: ['error', 'warn', 'debug', 'log'],
      colors: true,
      json: true,
      forceConsole: true,
      timestamp: true,
    }),
  });
  const loggerMiddleware = new LoggerMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    loggerMiddleware.use(req, res, next),
  );
  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // Response compression (gzip/brotli — reduces payload sizes ~60-80%)
  app.use(compression());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  try {
    // Swagger / OpenAPI
    const openApiDoc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Crafty Bass API')
        .setDescription(
          'Back-end API for Crafty Bass project. Provides endpoints for user authentication, product management, order processing, and more.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup('api', app, cleanupOpenApiDoc(openApiDoc));
  } catch (err) {
    console.error('CRITICAL SWAGGER ERROR');
    writeFileSync('swagger-error-debug.txt', formatError(err));
  }

  // Enable graceful shutdown (frees ports on Ctrl+C)
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
}
void bootstrap();

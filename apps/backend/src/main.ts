import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { writeFileSync } from 'node:fs';
import type { Application, NextFunction, Request, Response } from 'express';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { LoggerMiddleware } from './common/middleware/logger.middleware.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { ConsoleLogger } from '@nestjs/common';

const AUTH_ATTEMPT_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/forget-password',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
];

function isAuthAttemptEndpoint(path: string): boolean {
  return AUTH_ATTEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

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

  // Global API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/auth/{*path}'],
  });

  // Mount better-auth for Express 5 compatibility since @thallesp/nestjs-better-auth doesn't use the correct wildcard yet
  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance() as Application;

  // Stricter rate limiting only on authentication attempt endpoints.
  // Important: do not throttle session checks (e.g. /get-session) to avoid false-positive 429s.
  const authLimiter = rateLimit({
    skip: (req: Request) =>
      process.env.NODE_ENV !== 'production' || !isAuthAttemptEndpoint(req.path),
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7', // Sets RateLimit-* and Retry-After headers
    legacyHeaders: false,
    message: {
      statusCode: 429,
      message: 'Too many authentication attempts. Please try again later.',
      error: 'Too Many Requests',
    },
  });
  expressInstance.use('/api/auth', authLimiter);

  expressInstance.all('/api/auth/*splat', toNodeHandler(auth));

  try {
    // Swagger / OpenAPI
    const openApiDoc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('StreetGadgetz E-Commerce API')
        .setDescription(
          'Back-end API for StreetGadgetz — authentication, product catalogue, orders, payments, and customer support.',
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error('Error starting the application:', err);
  writeFileSync('startup-error.txt', formatError(err));
  process.exit(1);
});

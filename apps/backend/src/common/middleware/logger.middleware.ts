import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggerMiddleware.name);
  private readonly noisyExactPaths = new Set(['/api', '/api/', '/api-json']);
  private readonly noisyPathPrefixes = ['/api/swagger', '/api/favicon'];
  private readonly keyPathPrefixes = [
    '/api/v1/orders',
    '/api/v1/payments',
    '/api/v1/admin',
    '/api/v1/support',
    '/api/auth',
  ];

  private shouldLog(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
  ): boolean {
    if (method === 'OPTIONS' || method === 'HEAD') {
      return false;
    }

    if (statusCode >= 500) {
      return true;
    }

    if (statusCode >= 400) {
      return true;
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    const isKeyPath = this.keyPathPrefixes.some((prefix) =>
      path.startsWith(prefix),
    );

    if (isKeyPath) {
      return true;
    }

    if (durationMs >= 1000) {
      return true;
    }

    const isNoisyPath =
      this.noisyExactPaths.has(path) ||
      this.noisyPathPrefixes.some((prefix) => path.startsWith(prefix));

    if (isNoisyPath) {
      return false;
    }

    return false;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const method = req.method.toUpperCase();
    const url = req.originalUrl ?? req.url;
    const path = url.split('?')[0] ?? url;

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const statusCode = res.statusCode;

      if (!this.shouldLog(method, path, statusCode, durationMs)) {
        return;
      }

      const line = `${method} ${url} ${statusCode} - ${durationMs}ms`;

      if (statusCode >= 500) {
        this.logger.error(line);
        return;
      }

      if (statusCode >= 400) {
        this.logger.warn(line);
        return;
      }

      this.logger.log(line);
    });

    next();
  }
}

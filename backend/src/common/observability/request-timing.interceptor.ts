import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Adds X-Response-Time-Ms on every response and logs slow requests.
 */
@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);
  private readonly slowThresholdMs: number;

  constructor(config: ConfigService) {
    this.slowThresholdMs = Number(
      config.get<string>('SLOW_REQUEST_MS', '2000'),
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.recordTiming(req, res, start),
        error: () => this.recordTiming(req, res, start),
      }),
    );
  }

  private recordTiming(req: Request, res: Response, start: bigint): void {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const rounded = Math.round(durationMs * 100) / 100;

    if (!res.headersSent) {
      res.setHeader('X-Response-Time-Ms', String(rounded));
    }

    if (durationMs >= this.slowThresholdMs) {
      this.logger.warn(
        `Slow request ${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${rounded}ms`,
      );
    }
  }
}

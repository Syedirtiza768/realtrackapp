import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
export declare class RequestTimingInterceptor implements NestInterceptor {
    private readonly logger;
    private readonly slowThresholdMs;
    constructor(config: ConfigService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private recordTiming;
}

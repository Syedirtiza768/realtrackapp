"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RequestTimingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestTimingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let RequestTimingInterceptor = RequestTimingInterceptor_1 = class RequestTimingInterceptor {
    logger = new common_1.Logger(RequestTimingInterceptor_1.name);
    slowThresholdMs;
    constructor(config) {
        this.slowThresholdMs = Number(config.get('SLOW_REQUEST_MS', '2000'));
    }
    intercept(context, next) {
        const http = context.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const start = process.hrtime.bigint();
        return next.handle().pipe((0, rxjs_1.tap)({
            next: () => this.recordTiming(req, res, start),
            error: () => this.recordTiming(req, res, start),
        }));
    }
    recordTiming(req, res, start) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const rounded = Math.round(durationMs * 100) / 100;
        if (!res.headersSent) {
            res.setHeader('X-Response-Time-Ms', String(rounded));
        }
        if (durationMs >= this.slowThresholdMs) {
            this.logger.warn(`Slow request ${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${rounded}ms`);
        }
    }
};
exports.RequestTimingInterceptor = RequestTimingInterceptor;
exports.RequestTimingInterceptor = RequestTimingInterceptor = RequestTimingInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RequestTimingInterceptor);
//# sourceMappingURL=request-timing.interceptor.js.map
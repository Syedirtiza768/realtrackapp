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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSessionService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const app_redis_constants_js_1 = require("../common/redis/app-redis.constants.js");
let AuthSessionService = class AuthSessionService {
    redis;
    jwt;
    constructor(redis, jwt) {
        this.redis = redis;
        this.jwt = jwt;
    }
    async revokeBearerToken(authorization) {
        const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token)
            return;
        const payload = this.jwt.decode(token);
        if (!payload?.jti)
            return;
        const ttlSeconds = Math.max(1, (payload.exp ?? Math.floor(Date.now() / 1000) + 14_400) -
            Math.floor(Date.now() / 1000));
        await this.redis.set(`auth:revoked:${payload.jti}`, '1', 'EX', ttlSeconds);
    }
    async assertNotRevoked(jti) {
        if (!jti)
            return;
        if (await this.redis.exists(`auth:revoked:${jti}`)) {
            throw new common_1.UnauthorizedException('Session has been signed out');
        }
    }
};
exports.AuthSessionService = AuthSessionService;
exports.AuthSessionService = AuthSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(app_redis_constants_js_1.APP_REDIS)),
    __metadata("design:paramtypes", [Function, jwt_1.JwtService])
], AuthSessionService);
//# sourceMappingURL=auth-session.service.js.map
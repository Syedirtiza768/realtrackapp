"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const compression_1 = __importDefault(require("compression"));
const app_module_1 = require("./app.module");
const app_redis_constants_js_1 = require("./common/redis/app-redis.constants.js");
const redis_io_adapter_js_1 = require("./common/redis/redis-io.adapter.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        rawBody: true,
    });
    app.useBodyParser('text', {
        type: ['text/xml', 'application/xml', 'application/soap+xml'],
        limit: '2mb',
    });
    if (process.env.REDIS_SOCKET_ADAPTER === 'true') {
        const pubClient = app.get(app_redis_constants_js_1.APP_REDIS);
        const subClient = pubClient.duplicate();
        const redisAdapter = new redis_io_adapter_js_1.RedisIoAdapter(app, pubClient, subClient);
        await redisAdapter.connectToRedis();
        app.useWebSocketAdapter(redisAdapter);
    }
    app.use((0, compression_1.default)({ level: 6, threshold: 1024 }));
    const defaultCorsOrigins = [
        'http://localhost:3911',
        'http://localhost:8050',
        'https://app.omnicoreholding.com',
        'http://app.omnicoreholding.com',
    ];
    const corsOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : defaultCorsOrigins;
    app.enableCors({ origin: corsOrigins });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    if (process.env.NODE_ENV !== 'production') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Omni Core API')
            .setDescription('Multi-channel motor parts platform API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    await app.listen(process.env.PORT ?? 4191);
}
bootstrap();
//# sourceMappingURL=main.js.map
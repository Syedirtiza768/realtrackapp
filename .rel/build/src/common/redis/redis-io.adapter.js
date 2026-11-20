"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const common_1 = require("@nestjs/common");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    pubClient;
    subClient;
    logger = new common_1.Logger(RedisIoAdapter.name);
    adapterConstructor = null;
    constructor(app, pubClient, subClient) {
        super(app);
        this.pubClient = pubClient;
        this.subClient = subClient;
    }
    async connectToRedis() {
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(this.pubClient, this.subClient);
        this.logger.log('Socket.IO Redis adapter configured');
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map
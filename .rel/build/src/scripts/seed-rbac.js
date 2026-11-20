"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const rbac_seed_service_1 = require("../rbac/rbac-seed.service");
const rbac_service_1 = require("../rbac/rbac.service");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const rbac = app.get(rbac_service_1.RbacService);
        const seed = app.get(rbac_seed_service_1.RbacSeedService);
        await rbac.syncFromRegistry();
        await rbac.syncLegacyUserRoles();
        await seed.seedDemoUsers();
        console.log('RBAC seed completed');
    }
    finally {
        await app.close();
    }
}
void main();
//# sourceMappingURL=seed-rbac.js.map
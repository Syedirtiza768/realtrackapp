"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const app_module_js_1 = require("../app.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const business_industrial_image_intake_service_js_1 = require("../verticals/business-industrial-image-intake.service.js");
const business_industrial_image_intake_job_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-job.entity.js");
async function main() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn'],
    });
    try {
        const jobs = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob));
        const users = app.get((0, typeorm_1.getRepositoryToken)(user_entity_js_1.User));
        const latestJob = await jobs.findOne({
            where: { createdByUserId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
            order: { createdAt: 'DESC' },
        });
        if (!latestJob?.createdByUserId)
            throw new Error('No B&I intake operator was found');
        const user = await users.findOne({
            where: { id: latestJob.createdByUserId, active: true },
        });
        if (!user)
            throw new Error('The latest B&I intake operator is unavailable');
        const intake = app.get(business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService);
        const result = await intake.refreshBusinessIndustrialPrices(user, latestJob.organizationId, 200, (progress) => console.log(JSON.stringify({ phase: 'progress', ...progress })), true);
        console.log(JSON.stringify({
            phase: 'complete',
            processed: result.processed,
            updated: result.updated,
            skipped: result.skipped,
            skippedSkus: result.results
                .filter((row) => row.status === 'skipped')
                .map((row) => row.sku),
            published: false,
        }));
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=refresh-missing-business-industrial-prices.js.map
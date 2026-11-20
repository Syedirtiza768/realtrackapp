"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const bullmq_1 = require("@nestjs/bullmq");
const typeorm_1 = require("typeorm");
const app_module_js_1 = require("../app.module.js");
function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}
function option(name) {
    const prefix = `--${name}=`;
    return process.argv
        .find((arg) => arg.startsWith(prefix))
        ?.slice(prefix.length);
}
async function main() {
    const apply = hasFlag('apply');
    const limit = Number(option('limit') ?? '0');
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    try {
        const dataSource = app.get(typeorm_1.DataSource);
        const queue = app.get((0, bullmq_1.getQueueToken)('listing-optimization'));
        const rows = await dataSource.query(`
        SELECT id, sku
          FROM catalog_products
         WHERE fitment_status = 'pending'
         ORDER BY id
      `);
        const targets = limit > 0 ? rows.slice(0, limit) : rows;
        console.log(`${apply ? 'QUEUE' : 'DRY RUN'}: ${targets.length} pending fitment product(s) ` +
            `(query returned ${rows.length})`);
        if (!apply)
            return;
        let queued = 0;
        let existing = 0;
        for (const target of targets) {
            const jobId = `pending-fitment-publish-v1-${target.id}`;
            const found = await queue.getJob(jobId);
            if (found) {
                existing += 1;
                continue;
            }
            await queue.add('optimize-and-publish-fitment', {
                productId: target.id,
                marketplace: 'US',
                force: true,
                publishAfterOptimization: true,
            }, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 1000 },
            });
            queued += 1;
        }
        console.log(`Queued ${queued}; already present ${existing}`);
    }
    finally {
        await app.close();
    }
}
main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
//# sourceMappingURL=queue-pending-fitment-publish.js.map
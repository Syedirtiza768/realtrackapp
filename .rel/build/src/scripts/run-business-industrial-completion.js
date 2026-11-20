"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const app_module_js_1 = require("../app.module.js");
const user_entity_js_1 = require("../auth/entities/user.entity.js");
const business_industrial_image_intake_service_js_1 = require("../verticals/business-industrial-image-intake.service.js");
const business_industrial_image_intake_group_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-group.entity.js");
const business_industrial_image_intake_job_entity_js_1 = require("../verticals/entities/business-industrial-image-intake-job.entity.js");
const LUNA_MODEL = 'openai/gpt-5.6-luna-20260709';
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1kZ9x4dSwrptDEYreYcfo4mYaYYA2plY5?usp=drive_link';
const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed']);
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runDriveFolder(intake, jobs, groups, user, folderUrl) {
    const queued = await intake.createDriveJob(user, {
        folderUrl,
        maxItems: 200,
        autoCreateDrafts: true,
        skipFolderNames: [],
    });
    console.log(JSON.stringify({ phase: 'queued', source: folderUrl, job: queued }));
    const startedAt = Date.now();
    const deadline = startedAt + 4 * 60 * 60 * 1000;
    let lastProgress = '';
    let current = null;
    while (Date.now() < deadline) {
        current = await jobs.findOne({ where: { id: queued.id } });
        if (!current)
            throw new Error('The queued intake job disappeared');
        const progress = [
            current.status,
            current.processedFolders,
            current.processedImages,
            current.groupedParts,
        ].join('/');
        if (progress !== lastProgress) {
            const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 1);
            const rate = current.processedImages / elapsedSeconds;
            const etaSeconds = current.totalImages > current.processedImages && rate > 0
                ? Math.ceil((current.totalImages - current.processedImages) / rate)
                : null;
            console.log(JSON.stringify({
                phase: 'progress',
                source: folderUrl,
                status: current.status,
                percent: current.totalImages > 0
                    ? Math.round((current.processedImages / current.totalImages) * 100)
                    : null,
                etaSeconds,
                processedFolders: current.processedFolders,
                processedImages: current.processedImages,
                totalFolders: current.totalFolders,
                totalImages: current.totalImages,
                groupedParts: current.groupedParts,
                failedFolders: current.failedFolders,
            }));
            lastProgress = progress;
        }
        if (TERMINAL_STATUSES.has(current.status))
            break;
        await delay(5000);
    }
    if (!current || !TERMINAL_STATUSES.has(current.status))
        throw new Error('Timed out waiting for the B&I Drive intake worker');
    if (current.status === 'failed')
        throw new Error(current.errorMessage || 'B&I Drive intake failed');
    const importedGroups = await groups.find({
        where: { jobId: current.id, organizationId: current.organizationId },
    });
    const groupCounts = importedGroups.reduce((counts, group) => {
        counts[group.detectionStatus] =
            (counts[group.detectionStatus] ?? 0) + 1;
        return counts;
    }, {});
    return {
        organizationId: current.organizationId,
        id: current.id,
        status: current.status,
        totalFolders: current.totalFolders,
        totalImages: current.totalImages,
        processedFolders: current.processedFolders,
        processedImages: current.processedImages,
        groupedParts: current.groupedParts,
        failedFolders: current.failedFolders,
        groups: groupCounts,
        groupsWithCatalogProducts: importedGroups.filter((group) => Boolean(group.catalogProductId)).length,
    };
}
async function main() {
    const userId = process.argv[2]?.trim();
    const folderUrls = process.argv
        .slice(3)
        .map((value) => value.trim())
        .filter(Boolean);
    if (!folderUrls.length)
        folderUrls.push(DRIVE_FOLDER_URL);
    if (!userId)
        throw new Error('Usage: node dist/src/scripts/run-business-industrial-completion.js <existing-bni-admin-user-id> [drive-folder-url ...]');
    process.env.BUSINESS_INDUSTRIAL_AI_MODEL = LUNA_MODEL;
    const app = await core_1.NestFactory.createApplicationContext(app_module_js_1.AppModule, {
        logger: ['log', 'warn', 'error'],
    });
    try {
        const users = app.get((0, typeorm_1.getRepositoryToken)(user_entity_js_1.User));
        const user = await users.findOne({ where: { id: userId } });
        if (!user || !user.active)
            throw new Error('The supplied B&I admin user does not exist or is inactive');
        const intake = app.get(business_industrial_image_intake_service_js_1.BusinessIndustrialImageIntakeService);
        const jobs = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_job_entity_js_1.BusinessIndustrialImageIntakeJob));
        const groups = app.get((0, typeorm_1.getRepositoryToken)(business_industrial_image_intake_group_entity_js_1.BusinessIndustrialImageIntakeGroup));
        const jobSummaries = [];
        const folderErrors = [];
        for (const folderUrl of folderUrls) {
            try {
                jobSummaries.push(await runDriveFolder(intake, jobs, groups, user, folderUrl));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Drive intake failed';
                folderErrors.push({ folderUrl, message });
                console.error(JSON.stringify({ phase: 'folder-error', source: folderUrl, message }));
            }
        }
        if (!jobSummaries.length)
            throw new Error('All supplied B&I Drive folders failed');
        const organizationId = String(jobSummaries[0].organizationId);
        const pricing = await intake.refreshBusinessIndustrialPrices(user, organizationId, 200, (progress) => {
            console.log(JSON.stringify({ phase: 'pricing-progress', ...progress }));
        });
        const skippedPricingSkus = pricing.results
            .filter((result) => result.status === 'skipped')
            .map((result) => result.sku)
            .filter((sku) => typeof sku === 'string');
        console.log(JSON.stringify({
            phase: 'complete',
            jobs: jobSummaries,
            folderErrors,
            pricing: {
                processed: pricing.processed,
                updated: pricing.updated,
                skipped: pricing.skipped,
                skippedSkus: skippedPricingSkus,
            },
            model: LUNA_MODEL,
            published: false,
        }));
    }
    finally {
        await app.close();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=run-business-industrial-completion.js.map
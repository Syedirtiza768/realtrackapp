"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCreatedByVisibility = applyCreatedByVisibility;
exports.canViewJob = canViewJob;
exports.assertCanAccessJob = assertCanAccessJob;
exports.withCreatedByBackfill = withCreatedByBackfill;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
function applyCreatedByVisibility(qb, alias, viewerId, viewAll) {
    if (viewAll)
        return qb;
    return qb.andWhere(new typeorm_1.Brackets((w) => {
        w.where(`${alias}.createdBy IS NULL`).orWhere(`${alias}.createdBy = :viewerId`, {
            viewerId,
        });
    }));
}
function canViewJob(createdBy, viewerId, viewAll) {
    if (viewAll)
        return true;
    return createdBy === null || createdBy === viewerId;
}
function assertCanAccessJob(createdBy, viewerId, viewAll) {
    if (!canViewJob(createdBy, viewerId, viewAll)) {
        throw new common_1.ForbiddenException('You do not have access to this job');
    }
}
function withCreatedByBackfill(existing, actorId) {
    return existing ?? actorId ?? null;
}
//# sourceMappingURL=job-visibility.js.map
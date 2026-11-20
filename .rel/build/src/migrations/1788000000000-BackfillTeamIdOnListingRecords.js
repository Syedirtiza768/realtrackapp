"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackfillTeamIdOnListingRecords1788000000000 = void 0;
class BackfillTeamIdOnListingRecords1788000000000 {
    name = 'BackfillTeamIdOnListingRecords1788000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE listing_records lr
      SET "team_id" = pj."team_id"
      FROM pipeline_jobs pj
      WHERE lr."pipeline_job_id" = pj.id
        AND lr."team_id" IS NULL
        AND lr."pipeline_job_id" IS NOT NULL
        AND pj."team_id" IS NOT NULL
    `);
    }
    async down(_queryRunner) {
    }
}
exports.BackfillTeamIdOnListingRecords1788000000000 = BackfillTeamIdOnListingRecords1788000000000;
//# sourceMappingURL=1788000000000-BackfillTeamIdOnListingRecords.js.map
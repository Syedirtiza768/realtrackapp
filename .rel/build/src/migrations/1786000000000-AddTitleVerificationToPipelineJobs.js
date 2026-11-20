"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTitleVerificationToPipelineJobs1786000000000 = void 0;
class AddTitleVerificationToPipelineJobs1786000000000 {
    name = 'AddTitleVerificationToPipelineJobs1786000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      ADD COLUMN IF NOT EXISTS "title_verification_status" varchar(32) NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "title_verification_processed" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_total" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_flagged_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "title_verification_cost_usd" numeric(8,4) NOT NULL DEFAULT 0
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      DROP COLUMN IF EXISTS "title_verification_status",
      DROP COLUMN IF EXISTS "title_verification_processed",
      DROP COLUMN IF EXISTS "title_verification_total",
      DROP COLUMN IF EXISTS "title_verification_flagged_count",
      DROP COLUMN IF EXISTS "title_verification_cost_usd"
    `);
    }
}
exports.AddTitleVerificationToPipelineJobs1786000000000 = AddTitleVerificationToPipelineJobs1786000000000;
//# sourceMappingURL=1786000000000-AddTitleVerificationToPipelineJobs.js.map
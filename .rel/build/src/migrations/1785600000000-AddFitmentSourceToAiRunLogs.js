"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFitmentSourceToAiRunLogs1785600000000 = void 0;
class AddFitmentSourceToAiRunLogs1785600000000 {
    name = 'AddFitmentSourceToAiRunLogs1785600000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
        ADD COLUMN IF NOT EXISTS "fitment_source" varchar(20),
        ADD COLUMN IF NOT EXISTS "fitment_rows_pre" integer,
        ADD COLUMN IF NOT EXISTS "fitment_rows_post" integer,
        ADD COLUMN IF NOT EXISTS "tokens_saved_estimate" integer
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
        DROP COLUMN IF EXISTS "fitment_source",
        DROP COLUMN IF EXISTS "fitment_rows_pre",
        DROP COLUMN IF EXISTS "fitment_rows_post",
        DROP COLUMN IF EXISTS "tokens_saved_estimate"
    `);
    }
}
exports.AddFitmentSourceToAiRunLogs1785600000000 = AddFitmentSourceToAiRunLogs1785600000000;
//# sourceMappingURL=1785600000000-AddFitmentSourceToAiRunLogs.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddComplianceScoreToAiRunLogs1775710000000 = void 0;
class AddComplianceScoreToAiRunLogs1775710000000 {
    name = 'AddComplianceScoreToAiRunLogs1775710000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
      ADD COLUMN IF NOT EXISTS "compliance_score" numeric(5,4) NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_run_logs"
      DROP COLUMN IF EXISTS "compliance_score"
    `);
    }
}
exports.AddComplianceScoreToAiRunLogs1775710000000 = AddComplianceScoreToAiRunLogs1775710000000;
//# sourceMappingURL=1775710000000-AddComplianceScoreToAiRunLogs.js.map
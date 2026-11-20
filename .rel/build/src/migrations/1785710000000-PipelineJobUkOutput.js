"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineJobUkOutput1785710000000 = void 0;
class PipelineJobUkOutput1785710000000 {
    name = 'PipelineJobUkOutput1785710000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        ADD COLUMN IF NOT EXISTS "output_uk_path" varchar(1000)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
        DROP COLUMN IF EXISTS "output_uk_path"
    `);
    }
}
exports.PipelineJobUkOutput1785710000000 = PipelineJobUkOutput1785710000000;
//# sourceMappingURL=1785710000000-PipelineJobUkOutput.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOptimizationByMarketplace1775800000000 = void 0;
class AddOptimizationByMarketplace1775800000000 {
    name = 'AddOptimizationByMarketplace1775800000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      ADD COLUMN IF NOT EXISTS "optimization_by_marketplace" jsonb NOT NULL DEFAULT '{}'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "pipeline_jobs"
      DROP COLUMN IF EXISTS "optimization_by_marketplace"
    `);
    }
}
exports.AddOptimizationByMarketplace1775800000000 = AddOptimizationByMarketplace1775800000000;
//# sourceMappingURL=1775800000000-AddOptimizationByMarketplace.js.map
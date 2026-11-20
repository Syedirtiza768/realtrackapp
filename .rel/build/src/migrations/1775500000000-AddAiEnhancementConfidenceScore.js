"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAiEnhancementConfidenceScore1775500000000 = void 0;
class AddAiEnhancementConfidenceScore1775500000000 {
    name = 'AddAiEnhancementConfidenceScore1775500000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_enhancements"
      ADD COLUMN IF NOT EXISTS "confidence_score" real NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "ai_enhancements"
      DROP COLUMN IF EXISTS "confidence_score"
    `);
    }
}
exports.AddAiEnhancementConfidenceScore1775500000000 = AddAiEnhancementConfidenceScore1775500000000;
//# sourceMappingURL=1775500000000-AddAiEnhancementConfidenceScore.js.map
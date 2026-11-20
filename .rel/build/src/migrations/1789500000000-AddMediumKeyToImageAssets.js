"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMediumKeyToImageAssets1789500000000 = void 0;
class AddMediumKeyToImageAssets1789500000000 {
    name = 'AddMediumKeyToImageAssets1789500000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "image_assets"
        ADD COLUMN IF NOT EXISTS "s3_key_medium" varchar(500)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "image_assets"
        DROP COLUMN IF EXISTS "s3_key_medium"
    `);
    }
}
exports.AddMediumKeyToImageAssets1789500000000 = AddMediumKeyToImageAssets1789500000000;
//# sourceMappingURL=1789500000000-AddMediumKeyToImageAssets.js.map
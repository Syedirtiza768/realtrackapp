"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidenImageAssetsBlurhashToText1789600000000 = void 0;
class WidenImageAssetsBlurhashToText1789600000000 {
    name = 'WidenImageAssetsBlurhashToText1789600000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "image_assets"
        ALTER COLUMN "blurhash" TYPE text
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "image_assets"
        ALTER COLUMN "blurhash" TYPE varchar(50)
    `);
    }
}
exports.WidenImageAssetsBlurhashToText1789600000000 = WidenImageAssetsBlurhashToText1789600000000;
//# sourceMappingURL=1789600000000-WidenImageAssetsBlurhashToText.js.map
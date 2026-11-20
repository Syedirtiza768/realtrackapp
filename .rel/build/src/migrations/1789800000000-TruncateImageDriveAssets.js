"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TruncateImageDriveAssets1789800000000 = void 0;
class TruncateImageDriveAssets1789800000000 {
    name = 'TruncateImageDriveAssets1789800000000';
    async up(queryRunner) {
        await queryRunner.query(`DELETE FROM "image_drive_assets"`);
    }
    async down(queryRunner) {
    }
}
exports.TruncateImageDriveAssets1789800000000 = TruncateImageDriveAssets1789800000000;
//# sourceMappingURL=1789800000000-TruncateImageDriveAssets.js.map
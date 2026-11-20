"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPasswordChangeRequired1790700000000 = void 0;
class AddPasswordChangeRequired1790700000000 {
    name = 'AddPasswordChangeRequired1790700000000';
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE "users" ADD COLUMN "password_change_required" boolean NOT NULL DEFAULT false');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE "users" DROP COLUMN "password_change_required"');
    }
}
exports.AddPasswordChangeRequired1790700000000 = AddPasswordChangeRequired1790700000000;
//# sourceMappingURL=1790700000000-AddPasswordChangeRequired.js.map
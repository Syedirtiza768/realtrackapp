"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllUsersPublishAccess1790200000000 = void 0;
class AllUsersPublishAccess1790200000000 {
    name = 'AllUsersPublishAccess1790200000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN store_access_all SET DEFAULT true`);
        await queryRunner.query(`UPDATE users SET store_access_all = true WHERE active = true`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN store_access_all SET DEFAULT false`);
    }
}
exports.AllUsersPublishAccess1790200000000 = AllUsersPublishAccess1790200000000;
//# sourceMappingURL=1790200000000-AllUsersPublishAccess.js.map
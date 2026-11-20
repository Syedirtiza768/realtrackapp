"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStoreAccess1784000000000 = void 0;
const typeorm_1 = require("typeorm");
class UserStoreAccess1784000000000 {
    name = 'UserStoreAccess1784000000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'user_store_assignments',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'gen_random_uuid()',
                },
                { name: 'user_id', type: 'uuid', isNullable: false },
                { name: 'store_id', type: 'uuid', isNullable: false },
                {
                    name: 'access_level',
                    type: 'varchar',
                    length: '20',
                    default: "'view'",
                },
                { name: 'created_at', type: 'timestamptz', default: 'now()' },
            ],
            foreignKeys: [
                {
                    name: 'fk_usa_user',
                    columnNames: ['user_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'users',
                    onDelete: 'CASCADE',
                },
                {
                    name: 'fk_usa_store',
                    columnNames: ['store_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'stores',
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('user_store_assignments', new typeorm_1.TableIndex({ name: 'idx_usa_user', columnNames: ['user_id'] }));
        await queryRunner.createIndex('user_store_assignments', new typeorm_1.TableIndex({ name: 'idx_usa_store', columnNames: ['store_id'] }));
        await queryRunner.createUniqueConstraint('user_store_assignments', new typeorm_1.TableUnique({
            name: 'uq_user_store',
            columnNames: ['user_id', 'store_id'],
        }));
        await queryRunner.addColumn('users', new typeorm_1.TableColumn({
            name: 'store_access_all',
            type: 'boolean',
            default: false,
        }));
        await queryRunner.query(`
      INSERT INTO user_store_assignments (user_id, store_id, access_level)
      SELECT cc.user_id, s.id, 'admin'
      FROM stores s
      JOIN channel_connections cc ON cc.id = s.connection_id
      WHERE cc.user_id IS NOT NULL
      ON CONFLICT (user_id, store_id) DO NOTHING
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DELETE FROM user_store_assignments`);
        await queryRunner.dropColumn('users', 'store_access_all');
        await queryRunner.dropTable('user_store_assignments');
    }
}
exports.UserStoreAccess1784000000000 = UserStoreAccess1784000000000;
//# sourceMappingURL=1784000000000-UserStoreAccess.js.map
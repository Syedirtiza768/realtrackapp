import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex, TableUnique } from 'typeorm';

export class TeamsFoundation1785300000000 implements MigrationInterface {
  name = 'TeamsFoundation1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'teams',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'name', type: 'varchar', length: '100', isNullable: false },
          { name: 'color', type: 'varchar', length: '7', default: "'#3B82F6'" },
          { name: 'active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex('teams', new TableIndex({ name: 'idx_team_active', columnNames: ['active'] }));
    await queryRunner.createUniqueConstraint('teams', new TableUnique({ name: 'uq_team_name', columnNames: ['name'] }));

    await queryRunner.createTable(
      new Table({
        name: 'team_members',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'gen_random_uuid()' },
          { name: 'team_id', type: 'uuid', isNullable: false },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'team_members',
      new TableForeignKey({
        name: 'fk_team_member_team',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'team_members',
      new TableForeignKey({
        name: 'fk_team_member_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex('team_members', new TableIndex({ name: 'idx_team_member_user', columnNames: ['user_id'] }));
    await queryRunner.createIndex('team_members', new TableIndex({ name: 'idx_team_member_team', columnNames: ['team_id'] }));
    await queryRunner.createUniqueConstraint(
      'team_members',
      new TableUnique({ name: 'uq_team_member', columnNames: ['team_id', 'user_id'] }),
    );

    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS pipeline_upload_seq START WITH 1`);

    await queryRunner.addColumns('pipeline_jobs', [
      new TableColumn({ name: 'team_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'condition_label', type: 'varchar', length: '50', isNullable: true }),
      new TableColumn({ name: 'upload_code', type: 'varchar', length: '30', isNullable: true }),
    ]);
    await queryRunner.createIndex(
      'pipeline_jobs',
      new TableIndex({ name: 'idx_pipeline_job_team', columnNames: ['team_id'] }),
    );
    await queryRunner.createForeignKey(
      'pipeline_jobs',
      new TableForeignKey({
        name: 'fk_pipeline_job_team',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.addColumn(
      'listing_records',
      new TableColumn({ name: 'team_id', type: 'uuid', isNullable: true }),
    );
    await queryRunner.createIndex(
      'listing_records',
      new TableIndex({ name: 'idx_listing_team', columnNames: ['team_id'] }),
    );
    await queryRunner.createForeignKey(
      'listing_records',
      new TableForeignKey({
        name: 'fk_listing_team',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.addColumn(
      'catalog_products',
      new TableColumn({ name: 'team_id', type: 'uuid', isNullable: true }),
    );
    await queryRunner.createIndex(
      'catalog_products',
      new TableIndex({ name: 'idx_catalog_team', columnNames: ['team_id'] }),
    );
    await queryRunner.createForeignKey(
      'catalog_products',
      new TableForeignKey({
        name: 'fk_catalog_team',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('catalog_products', 'fk_catalog_team');
    await queryRunner.dropIndex('catalog_products', 'idx_catalog_team');
    await queryRunner.dropColumn('catalog_products', 'team_id');

    await queryRunner.dropForeignKey('listing_records', 'fk_listing_team');
    await queryRunner.dropIndex('listing_records', 'idx_listing_team');
    await queryRunner.dropColumn('listing_records', 'team_id');

    await queryRunner.dropForeignKey('pipeline_jobs', 'fk_pipeline_job_team');
    await queryRunner.dropIndex('pipeline_jobs', 'idx_pipeline_job_team');
    await queryRunner.dropColumns('pipeline_jobs', ['team_id', 'condition_label', 'upload_code']);

    await queryRunner.query(`DROP SEQUENCE IF EXISTS pipeline_upload_seq`);

    await queryRunner.dropTable('team_members');
    await queryRunner.dropTable('teams');
  }
}

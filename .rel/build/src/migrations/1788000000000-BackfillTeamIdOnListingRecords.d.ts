import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class BackfillTeamIdOnListingRecords1788000000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(_queryRunner: QueryRunner): Promise<void>;
}

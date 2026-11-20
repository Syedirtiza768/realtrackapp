import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ListingRecordsBase1708999999990 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

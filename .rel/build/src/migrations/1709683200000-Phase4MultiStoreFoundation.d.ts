import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Phase4MultiStoreFoundation1709683200000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

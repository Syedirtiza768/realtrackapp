import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Phase3MultiTenant1709596800000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

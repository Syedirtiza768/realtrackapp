import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class Phase3Partitioning1709424000000 implements MigrationInterface {
    name: string;
    private tableExists;
    private columnExists;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

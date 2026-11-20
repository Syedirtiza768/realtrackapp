import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateSkuSequence1785200000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

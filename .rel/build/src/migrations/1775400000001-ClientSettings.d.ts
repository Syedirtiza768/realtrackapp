import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ClientSettings1775400000001 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}

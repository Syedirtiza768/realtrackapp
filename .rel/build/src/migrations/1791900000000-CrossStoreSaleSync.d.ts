import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CrossStoreSaleSync1791900000000 implements MigrationInterface {
    name: string;
    up(q: QueryRunner): Promise<void>;
    down(q: QueryRunner): Promise<void>;
}

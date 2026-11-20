import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class PrimemotiveOrderedChanges1791600000000 implements MigrationInterface {
    name: string;
    up(q: QueryRunner): Promise<void>;
    down(q: QueryRunner): Promise<void>;
}
